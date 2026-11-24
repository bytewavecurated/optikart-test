import express from 'express';
import { stampOtp, matchOtp } from '../services/otpCode.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';
import { verifyToken } from '../middleware/auth.js';
import { signSession, logoutHandler } from '../services/session.js';
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator';
import User from '../models/User.js';
import { describeOtpDelivery, sendOTP } from '../services/email.js';
import { otpBypassAllowed } from '../config/authMode.js';

const router = express.Router();

/*
 * Ends this session server-side. Without it, signing out only discarded the
 * token in one browser, and any other copy of that string kept working until it
 * expired on its own. See services/session.js.
 */
router.post('/logout', verifyToken, logoutHandler('admin'));

const generateAdminToken = (userId) => {
  return signSession({ id: userId, userId, role: 'admin' }, { expiresIn: '7d' });
};

// Admin login with OTP and 2 attempt limit, 5 min lockout
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const admin = await User.findOne({ email, role: 'admin' });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    // Check if account is locked (5 minutes for admin)
    if (admin.lockUntil && admin.lockUntil > new Date()) {
      const remainingTime = Math.ceil((admin.lockUntil - new Date()) / 1000 / 60);
      return res.status(423).json({
        success: false,
        message: `Account is locked. Please try again in ${remainingTime} minutes.`,
        locked: true,
        lockUntil: admin.lockUntil,
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      // Increment failed login attempts
      admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;

      // Lock account after 2 failed attempts for 5 minutes (admin specific)
      if (admin.failedLoginAttempts >= 2) {
        admin.lockUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        admin.failedLoginAttempts = 0; // Reset after locking
        await admin.save();

        return res.status(423).json({
          success: false,
          message: 'Too many failed attempts. Account locked for 5 minutes.',
          locked: true,
          lockUntil: admin.lockUntil,
        });
      }

      await admin.save();
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Reset failed attempts on successful password check
    admin.failedLoginAttempts = 0;
    admin.lockUntil = null;

    // Check if this is a test credential - bypass OTP for testing
    const testAdminEmails = ['samedayopticians@gmail.com'];
    // Second-factor OTP may only be skipped outside production, and only
    // for the well-known seededdemo accounts whose password is also public.
    const isTestCredential = otpBypassAllowed(testAdminEmails, email);

    if (isTestCredential) {
      // Direct login for test credentials
      const token = generateAdminToken(admin._id);
      admin.loginTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      admin.lastLoginAt = new Date();
      await admin.save();

      res.json({
        success: true,
        message: 'Login successful.',
        token,
        admin: admin.toJSON(),
      });
    } else {
      // Generate OTP for login verification (production flow)
      const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        specialChars: false,
        lowerCaseAlphabets: false,
        length: 6,
      });

      stampOtp(admin, 'loginOtp', otp);
      admin.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await admin.save();

      // Send OTP to email
      const delivery = describeOtpDelivery(await sendOTP(admin.email, otp, 'login'), { purpose: 'admin sign-in' });
      if (!delivery.ok) {
        return res.status(delivery.status).json({ success: false, message: delivery.message, reason: delivery.reason });
      }

      res.json({
        success: true,
        message: delivery.message,
        devCode: delivery.devCode,
        requiresOTP: true,
        email: admin.email,
      });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
});

// Verify admin login OTP
router.post('/verify-otp', otpLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const admin = await User.findOne({ email, role: 'admin' });
    /*
     * NOT FOUND, WRONG CODE and EXPIRED now answer one identical sentence. The old
     * 404 "X not found" was a free oracle for enumerating console identities -
     * and the digest lookup returns false for all three cases anyway, so the
     * separate guards carried disclosure for zero diagnostic value.
     */
    if (!matchOtp(admin, 'loginOtp', otp) || !(admin && admin.loginOtpExpiry && new Date() <= admin.loginOtpExpiry)) {
      return res.status(400).json({ success: false, message: 'The code is invalid or has expired.' });
    }

    // Clear OTP and generate token
    admin.loginOtp = undefined;
    admin.loginOtpExpiry = undefined;
    admin.loginTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    admin.lastLoginAt = new Date();
    await admin.save();

    const token = generateAdminToken(admin._id);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      admin: admin.toJSON(),
    });
  } catch (error) {
    console.error('Admin verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying OTP.', error: error.message });
  }
});

export default router;
