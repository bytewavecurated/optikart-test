import express from 'express';
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator';
import Executive from '../models/Executive.js';
import ExecutiveStaff from '../models/ExecutiveStaff.js';
import User from '../models/User.js';
import Seller from '../models/Seller.js';
import Order from '../models/Order.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';
import { sendOTP } from '../services/email.js';

const router = express.Router();

const generateExecutiveToken = (executiveId) => {
  return jwt.sign({ id: executiveId, executiveId, role: 'executive' }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

// Executive Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const executive = await Executive.findOne({ email });
    if (!executive) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!executive.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    if (executive.isBanned) {
      return res.status(403).json({ success: false, message: 'Account has been banned.' });
    }

    // Check if account is locked
    if (executive.lockUntil && executive.lockUntil > new Date()) {
      const remainingTime = Math.ceil((executive.lockUntil - new Date()) / 1000 / 60);
      return res.status(423).json({ 
        success: false, 
        message: `Account is locked. Please try again in ${remainingTime} minutes.`,
        locked: true,
        lockUntil: executive.lockUntil
      });
    }

    const isMatch = await executive.comparePassword(password);
    if (!isMatch) {
      executive.failedLoginAttempts = (executive.failedLoginAttempts || 0) + 1;
      
      if (executive.failedLoginAttempts >= 3) {
        executive.lockUntil = new Date(Date.now() + 3 * 60 * 1000);
        executive.failedLoginAttempts = 0;
        await executive.save();
        
        return res.status(423).json({ 
          success: false, 
          message: 'Too many failed attempts. Account locked for 3 minutes.',
          locked: true,
          lockUntil: executive.lockUntil
        });
      }
      
      await executive.save();
      const remainingAttempts = 3 - executive.failedLoginAttempts;
      return res.status(401).json({ 
        success: false, 
        message: `Invalid email or password. ${remainingAttempts} attempts remaining.`
      });
    }

    executive.failedLoginAttempts = 0;
    executive.lockUntil = null;

    // Check if this is a test credential - bypass OTP for testing
    const testExecutiveEmails = ['executive.delivery@optikart.com'];
    const isTestCredential = testExecutiveEmails.includes(email);

    if (isTestCredential) {
      // Direct login for test credentials
      const token = generateExecutiveToken(executive._id);
      executive.loginTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      executive.lastLoginAt = new Date();
      await executive.save();

      res.json({
        success: true,
        message: 'Login successful.',
        token,
        executive: executive.toJSON()
      });
    } else {
      // Generate OTP
      const loginOtp = otpGenerator.generate('6789', { 
        upperCaseAlphabets: false, 
        specialChars: false, 
        lowerCaseAlphabets: false 
      });

      executive.loginOtp = loginOtp;
      executive.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await executive.save();

      await sendOTP(email, loginOtp, 'login');

      res.json({
        success: true,
        message: 'Login OTP sent to your email.',
        executiveId: executive._id
      });
    }
  } catch (error) {
    console.error('Executive login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
});

// Verify Executive Login OTP
router.post('/verify-login-otp', async (req, res) => {
  try {
    const { executiveId, otp } = req.body;

    if (!executiveId || !otp) {
      return res.status(400).json({ success: false, message: 'Executive ID and OTP are required.' });
    }

    const executive = await Executive.findById(executiveId);
    if (!executive) {
      return res.status(404).json({ success: false, message: 'Executive not found.' });
    }

    if (executive.loginOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    if (new Date() > executive.loginOtpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
    }

    executive.loginOtp = undefined;
    executive.loginOtpExpiry = undefined;
    executive.lastLoginAt = new Date();
    await executive.save();

    const token = generateExecutiveToken(executive._id);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      executive: executive.toJSON()
    });
  } catch (error) {
    console.error('Verify executive login OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Executive Profile
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const executive = await Executive.findById(decoded.id);
    
    if (!executive) {
      return res.status(404).json({ success: false, message: 'Executive not found.' });
    }

    res.json({
      success: true,
      executive: executive.toJSON()
    });
  } catch (error) {
    console.error('Get executive profile error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Executive Dashboard Stats
router.get('/dashboard', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const executive = await Executive.findById(decoded.id);
    
    if (!executive) {
      return res.status(404).json({ success: false, message: 'Executive not found.' });
    }

    let stats = {};

    switch (executive.department) {
      case 'users':
        stats.totalUsers = await User.countDocuments();
        stats.activeUsers = await User.countDocuments({ isActive: true });
        break;
      case 'sellers':
        stats.totalSellers = await Seller.countDocuments();
        stats.pendingSellers = await Seller.countDocuments({ isVerified: false });
        break;
      case 'orders':
        stats.totalOrders = await Order.countDocuments();
        stats.pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });
        break;
      case 'delivery':
        stats.totalDeliveries = await Order.countDocuments();
        stats.deliveredOrders = await Order.countDocuments({ orderStatus: 'delivered' });
        break;
      default:
        stats = {};
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Executive Staff
router.get('/staff', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const executive = await Executive.findById(decoded.id);
    
    if (!executive) {
      return res.status(404).json({ success: false, message: 'Executive not found.' });
    }

    const { department } = req.query;
    const query = department ? { department } : {};
    
    const staff = await ExecutiveStaff.find(query).select('-password');
    
    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Add Executive Staff
router.post('/staff', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const executive = await Executive.findById(decoded.id);
    
    if (!executive) {
      return res.status(404).json({ success: false, message: 'Executive not found.' });
    }

    const { name, email, password, role, department } = req.body;

    const existingStaff = await ExecutiveStaff.findOne({ email });
    if (existingStaff) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const staff = new ExecutiveStaff({
      name,
      email,
      password,
      role,
      department: department || executive.department,
      createdBy: executive._id
    });

    await staff.save();

    res.status(201).json({
      success: true,
      message: 'Staff added successfully.',
      data: staff.toJSON()
    });
  } catch (error) {
    console.error('Add staff error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Delete Executive Staff
router.delete('/staff/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const executive = await Executive.findById(decoded.id);
    
    if (!executive) {
      return res.status(404).json({ success: false, message: 'Executive not found.' });
    }

    const staff = await ExecutiveStaff.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found.' });
    }

    await ExecutiveStaff.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Staff deleted successfully.'
    });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Department Data
router.get('/department-data', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const executive = await Executive.findById(decoded.id);
    
    if (!executive) {
      return res.status(404).json({ success: false, message: 'Executive not found.' });
    }

    const { department } = req.query;
    let data = [];

    switch (department) {
      case 'users':
        data = await User.find().select('-password').limit(100);
        break;
      case 'sellers':
        data = await Seller.find().select('-password').limit(100);
        break;
      case 'orders':
        data = await Order.find().populate('user', 'name email').populate('seller', 'storeName').limit(100);
        break;
      case 'delivery':
        data = await Order.find().populate('user', 'name email').populate('seller', 'storeName').limit(100);
        break;
      default:
        data = [];
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get department data error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
