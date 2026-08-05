import express from 'express';
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator';
import User from '../models/User.js';
import { sendOTP } from '../services/email.js';

const router = express.Router();

const generateAdminToken = (userId) => {
  return jwt.sign({ id: userId, userId, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Admin login with OTP and 2 attempt limit, 5 min lockout
router.post('/login', async (req, res) => {
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
        lockUntil: admin.lockUntil
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
          lockUntil: admin.lockUntil
        });
      }
      
      await admin.save();
      const remainingAttempts = 2 - admin.failedLoginAttempts;
      return res.status(401).json({ 
        success: false, 
        message: `Invalid email or password. ${remainingAttempts} attempt(s) remaining.`
      });
    }

    // Reset failed attempts on successful password check
    admin.failedLoginAttempts = 0;
    admin.lockUntil = null;

    // Check if this is a test credential - bypass OTP for testing
    const testAdminEmails = ['samedayopticians@gmail.com'];
    const isTestCredential = testAdminEmails.includes(email);

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
        user: admin.toJSON()
      });
    } else {
      // Generate OTP for login verification (production flow)
      const otp = otpGenerator.generate('6789', { 
        upperCaseAlphabets: false, 
        specialChars: false, 
        lowerCaseAlphabets: false,
        length: 6
      });

      admin.loginOtp = otp;
      admin.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await admin.save();

      // Send OTP to email
      await sendOTP(admin.email, otp, 'login');

      res.json({
        success: true,
        message: 'OTP sent to your email. Please verify to complete login.',
        requiresOTP: true,
        email: admin.email
      });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
});

// Verify admin login OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const admin = await User.findOne({ email, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    if (!admin.loginOtp || admin.loginOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    if (new Date() > admin.loginOtpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
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
      user: admin.toJSON()
    });
  } catch (error) {
    console.error('Admin verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying OTP.', error: error.message });
  }
});

export default router;
