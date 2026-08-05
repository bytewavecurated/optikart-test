import express from 'express';
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator';
import User from '../models/User.js';
import { registerValidation, loginValidation } from '../middleware/validate.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';
import { verifyToken } from '../middleware/auth.js';
import { sendOTP, sendPasswordReset } from '../services/email.js';

const router = express.Router();

const generateToken = (userId) => {
  return jwt.sign({ id: userId, userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

router.post('/register', authLimiter, registerValidation, async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ success: false, message: 'Email already registered.' });
      }
      if (existingUser.phone === phone) {
        return res.status(400).json({ success: false, message: 'Phone number already registered.' });
      }
    }

    const user = new User({ name, email, phone, password });
    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.', error: error.message });
  }
});

router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingTime = Math.ceil((user.lockUntil - new Date()) / 1000 / 60);
      return res.status(423).json({ 
        success: false, 
        message: `Account is locked. Please try again in ${remainingTime} minutes.`,
        locked: true,
        lockUntil: user.lockUntil
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment failed login attempts
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      
      // Lock account after 3 failed attempts for 3 minutes
      if (user.failedLoginAttempts >= 3) {
        user.lockUntil = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes
        user.failedLoginAttempts = 0; // Reset after locking
        await user.save();
        
        return res.status(423).json({ 
          success: false, 
          message: 'Too many failed attempts. Account locked for 3 minutes.',
          locked: true,
          lockUntil: user.lockUntil
        });
      }
      
      await user.save();
      const remainingAttempts = 3 - user.failedLoginAttempts;
      return res.status(401).json({ 
        success: false, 
        message: `Invalid email or password. ${remainingAttempts} attempts remaining.`
      });
    }

    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    // Check if this is a test credential - bypass OTP for testing
    const testEmails = ['testuser@optikart.com', 'demo@optikart.com', 'samedayopticians@gmail.com'];
    const isTestCredential = testEmails.includes(email);

    if (isTestCredential) {
      // Direct login for test credentials
      const token = generateToken(user._id);
      user.loginTokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for users
      user.lastLoginAt = new Date();
      await user.save();

      res.json({
        success: true,
        message: 'Login successful.',
        token,
        user: user.toJSON()
      });
    } else {
      // Generate OTP for login verification (production flow)
      const otp = otpGenerator.generate('6789', { 
        upperCaseAlphabets: false, 
        specialChars: false, 
        lowerCaseAlphabets: false,
        length: 6
      });

      user.loginOtp = otp;
      user.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await user.save();

      // Send OTP to email
      await sendOTP(user.email, otp, 'login');

      res.json({
        success: true,
        message: 'OTP sent to your email. Please verify to complete login.',
        requiresOTP: true,
        email: user.email
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
});

router.post('/send-otp', otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone number is required.' });
    }

    const otp = otpGenerator.generate('6789', { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false });

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Phone number not registered.' });
    }

    user.resetOtp = otp;
    user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTP(user.email, otp, 'login');

    res.json({
      success: true,
      message: 'OTP sent successfully.',
      otp
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error sending OTP.', error: error.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required.' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Phone number not registered.' });
    }

    if (!user.resetOtp || user.resetOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    if (new Date() > user.resetOtpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
    }

    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;
    user.loginTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'OTP verified successfully.',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying OTP.', error: error.message });
  }
});

// Verify login OTP - completes login after OTP verification
router.post('/verify-login-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!user.loginOtp || user.loginOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    if (new Date() > user.loginOtpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
    }

    // Clear OTP and generate token
    user.loginOtp = undefined;
    user.loginOtpExpiry = undefined;
    user.loginTokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for users
    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Verify login OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying OTP.', error: error.message });
  }
});

router.post('/logout', verifyToken, async (req, res) => {
  try {
    req.user.loginTokenExpiry = null;
    await req.user.save();

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Server error during logout.', error: error.message });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user.toJSON()
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/update-profile', verifyToken, async (req, res) => {
  try {
    const { name, phone, avatar, addresses } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (avatar) updateData.avatar = avatar;
    if (addresses) updateData.addresses = addresses;

    if (phone) {
      const existingPhone = await User.findOne({ phone, _id: { $ne: userId } });
      if (existingPhone) {
        return res.status(400).json({ success: false, message: 'Phone number already in use.' });
      }
    }

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true });

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile.', error: error.message });
  }
});

router.post('/forgot-password', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Email not registered.' });
    }

    const otp = otpGenerator.generate('6789', { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false });

    user.resetOtp = otp;
    user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendPasswordReset(email, otp);

    res.json({
      success: true,
      message: 'Password reset OTP sent to your email.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Email not registered.' });
    }

    if (!user.resetOtp || user.resetOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    if (new Date() > user.resetOtpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
    }

    user.password = newPassword;
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/prescriptions', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('prescriptions');
    res.json({ success: true, prescriptions: user.prescriptions || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/prescriptions', verifyToken, async (req, res) => {
  try {
    const { fileUrl, prescriptionType, lensType, notes, eyePower } = req.body;
    
    if (!fileUrl) {
      return res.status(400).json({ success: false, message: 'Prescription file is required.' });
    }

    const user = await User.findById(req.user._id);
    
    const prescription = {
      fileUrl,
      prescriptionType: prescriptionType || 'single_vision',
      lensType: lensType || '',
      notes: notes || '',
      eyePower: eyePower || {},
      uploadedAt: new Date()
    };
    
    user.prescriptions.push(prescription);
    await user.save();
    
    res.status(201).json({ 
      success: true, 
      message: 'Prescription saved successfully.',
      prescription: user.prescriptions[user.prescriptions.length - 1]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/prescriptions/:prescriptionId', verifyToken, async (req, res) => {
  try {
    const { prescriptionType, lensType, notes, eyePower, fileUrl } = req.body;
    
    const user = await User.findById(req.user._id);
    const prescription = user.prescriptions.id(req.params.prescriptionId);
    
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found.' });
    }
    
    if (prescriptionType) prescription.prescriptionType = prescriptionType;
    if (lensType) prescription.lensType = lensType;
    if (notes !== undefined) prescription.notes = notes;
    if (eyePower) prescription.eyePower = eyePower;
    if (fileUrl) prescription.fileUrl = fileUrl;
    
    await user.save();
    
    res.json({ success: true, message: 'Prescription updated successfully.', prescription });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/prescriptions/:prescriptionId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const prescription = user.prescriptions.id(req.params.prescriptionId);
    
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found.' });
    }
    
    user.prescriptions.pull(req.params.prescriptionId);
    await user.save();
    
    res.json({ success: true, message: 'Prescription deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/addresses', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('addresses');
    res.json({ success: true, addresses: user.addresses || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/addresses', verifyToken, async (req, res) => {
  try {
    const { name, street, city, state, pincode, phone, isDefault } = req.body;
    
    if (!street || !city || !state || !pincode || !phone) {
      return res.status(400).json({ success: false, message: 'All address fields are required.' });
    }
    
    const user = await User.findById(req.user._id);
    
    const address = { name: name || user.name, street, city, state, pincode, phone, isDefault: isDefault || false };
    
    if (address.isDefault) {
      user.addresses.forEach(addr => { addr.isDefault = false; });
    }
    
    if (user.addresses.length === 0) {
      address.isDefault = true;
    }
    
    user.addresses.push(address);
    await user.save();
    
    res.status(201).json({ 
      success: true, 
      message: 'Address added successfully.',
      addresses: user.addresses
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/addresses/:addressId', verifyToken, async (req, res) => {
  try {
    const { name, street, city, state, pincode, phone, isDefault } = req.body;
    
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);
    
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found.' });
    }
    
    if (name) address.name = name;
    if (street) address.street = street;
    if (city) address.city = city;
    if (state) address.state = state;
    if (pincode) address.pincode = pincode;
    if (phone) address.phone = phone;
    if (isDefault !== undefined) {
      address.isDefault = isDefault;
      if (isDefault) {
        user.addresses.forEach(addr => { 
          if (addr._id.toString() !== req.params.addressId) addr.isDefault = false; 
        });
      }
    }
    
    await user.save();
    
    res.json({ success: true, message: 'Address updated successfully.', addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/addresses/:addressId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);
    
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found.' });
    }
    
    user.addresses.pull(req.params.addressId);
    await user.save();
    
    res.json({ success: true, message: 'Address deleted successfully.', addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
