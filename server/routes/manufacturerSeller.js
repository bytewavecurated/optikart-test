import express from 'express';
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator';
import ManufacturerSeller from '../models/ManufacturerSeller.js';
import Product from '../models/Product.js';
import { sendOTP } from '../services/email.js';

const router = express.Router();

const generateManufacturerSellerToken = (sellerId) => {
  return jwt.sign({ id: sellerId, sellerId, role: 'manufacturerSeller' }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

// Manufacturer Seller Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const seller = await ManufacturerSeller.findOne({ email });
    if (!seller) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!seller.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    if (seller.isBanned) {
      return res.status(403).json({ success: false, message: 'Account has been banned.' });
    }

    if (seller.lockUntil && seller.lockUntil > new Date()) {
      const remainingTime = Math.ceil((seller.lockUntil - new Date()) / 1000 / 60);
      return res.status(423).json({ 
        success: false, 
        message: `Account is locked. Please try again in ${remainingTime} minutes.`,
        locked: true,
        lockUntil: seller.lockUntil
      });
    }

    const isMatch = await seller.comparePassword(password);
    if (!isMatch) {
      seller.failedLoginAttempts = (seller.failedLoginAttempts || 0) + 1;
      
      if (seller.failedLoginAttempts >= 3) {
        seller.lockUntil = new Date(Date.now() + 3 * 60 * 1000);
        seller.failedLoginAttempts = 0;
        await seller.save();
        
        return res.status(423).json({ 
          success: false, 
          message: 'Too many failed attempts. Account locked for 3 minutes.',
          locked: true,
          lockUntil: seller.lockUntil
        });
      }
      
      await seller.save();
      const remainingAttempts = 3 - seller.failedLoginAttempts;
      return res.status(401).json({ 
        success: false, 
        message: `Invalid email or password. ${remainingAttempts} attempts remaining.`
      });
    }

    seller.failedLoginAttempts = 0;
    seller.lockUntil = null;

    // Check if this is a test credential - bypass OTP for testing
    const testManufacturerSellerEmails = ['rayban.retailer1@optikart.com'];
    const isTestCredential = testManufacturerSellerEmails.includes(email);

    if (isTestCredential) {
      // Direct login for test credentials
      const token = generateManufacturerSellerToken(seller._id);
      seller.loginTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      seller.lastLoginAt = new Date();
      await seller.save();

      res.json({
        success: true,
        message: 'Login successful.',
        token,
        seller: seller.toJSON()
      });
    } else {
      const loginOtp = otpGenerator.generate('6789', { 
        upperCaseAlphabets: false, 
        specialChars: false, 
        lowerCaseAlphabets: false 
      });

      seller.loginOtp = loginOtp;
      seller.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await seller.save();

      await sendOTP(email, loginOtp, 'login');

      res.json({
        success: true,
        message: 'Login OTP sent to your email.',
        sellerId: seller._id
      });
    }
  } catch (error) {
    console.error('Manufacturer seller login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
});

// Verify Manufacturer Seller Login OTP
router.post('/verify-login-otp', async (req, res) => {
  try {
    const { sellerId, otp } = req.body;

    if (!sellerId || !otp) {
      return res.status(400).json({ success: false, message: 'Seller ID and OTP are required.' });
    }

    const seller = await ManufacturerSeller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    if (seller.loginOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    if (new Date() > seller.loginOtpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
    }

    seller.loginOtp = undefined;
    seller.loginOtpExpiry = undefined;
    seller.lastLoginAt = new Date();
    await seller.save();

    const token = generateManufacturerSellerToken(seller._id);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      seller: seller.toJSON()
    });
  } catch (error) {
    console.error('Verify manufacturer seller login OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Manufacturer Seller Profile
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const seller = await ManufacturerSeller.findById(decoded.id);
    
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    res.json({
      success: true,
      seller: seller.toJSON()
    });
  } catch (error) {
    console.error('Get manufacturer seller profile error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Available Products from Manufacturer
router.get('/available-products', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const seller = await ManufacturerSeller.findById(decoded.id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    const products = await Product.find({ 
      manufacturer: seller.manufacturer,
      isDiscontinued: false
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Get available products error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Toggle Product (Add/Remove from seller inventory)
router.post('/products/:id/toggle', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const seller = await ManufacturerSeller.findById(decoded.id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    const manufacturerProduct = await Product.findById(req.params.id);
    if (!manufacturerProduct) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Check if seller already has this product
    const existingProduct = await Product.findOne({
      manufacturerProduct: manufacturerProduct._id,
      seller: decoded.id
    });

    if (existingProduct) {
      // Remove from seller inventory
      await Product.findByIdAndDelete(existingProduct._id);
      seller.products = seller.products.filter(p => p.toString() !== existingProduct._id.toString());
      await seller.save();

      res.json({
        success: true,
        message: 'Product removed from inventory.'
      });
    } else {
      // Add to seller inventory with seller's pricing
      const sellerProduct = new Product({
        ...manufacturerProduct.toObject(),
        _id: undefined,
        manufacturerProduct: manufacturerProduct._id,
        manufacturerSellerId: decoded.id,
        seller: decoded.id,
        price: req.body.price || manufacturerProduct.price,
        discountedPrice: req.body.discountedPrice || manufacturerProduct.discountedPrice,
        stock: req.body.stock || 0,
        colors: req.body.colors || manufacturerProduct.colors,
        sizes: req.body.sizes || manufacturerProduct.sizes
      });

      await sellerProduct.save();
      seller.products.push(sellerProduct._id);
      await seller.save();

      res.json({
        success: true,
        message: 'Product added to inventory.',
        product: sellerProduct
      });
    }
  } catch (error) {
    console.error('Toggle product error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Seller's Products
router.get('/products', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const products = await Product.find({ 
      manufacturerSellerId: decoded.id
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
