import express from 'express';
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator';
import Seller from '../models/Seller.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Subscription from '../models/Subscription.js';
import { sellerRegisterValidation, loginValidation } from '../middleware/validate.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';
import { verifySeller } from '../middleware/auth.js';
import { sendOTP } from '../services/email.js';
import { createOrder as createRazorpayOrder } from '../services/razorpay.js';

const router = express.Router();

const generateSellerToken = (sellerId) => {
  return jwt.sign({ id: sellerId, sellerId }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

router.post('/register', authLimiter, sellerRegisterValidation, async (req, res) => {
  try {
    const {
      name, email, phone, password, gstNumber, aadharNumber, panNumber,
      bankAccount, storeName, storeDescription
    } = req.body;

    const existingSeller = await Seller.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingSeller) {
      if (existingSeller.email === email) {
        return res.status(400).json({ success: false, message: 'Email already registered.' });
      }
      if (existingSeller.phone === phone) {
        return res.status(400).json({ success: false, message: 'Phone number already registered.' });
      }
    }

    const phoneOtp = otpGenerator.generate('6789', { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false });

    const seller = new Seller({
      name, email, phone, password, gstNumber, aadharNumber, panNumber,
      bankAccount, storeName, storeDescription,
      phoneOtp,
      phoneOtpExpiry: new Date(Date.now() + 10 * 60 * 1000)
    });

    await seller.save();

    await sendOTP(email, phoneOtp, 'phone');

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your phone with the OTP sent.',
      sellerId: seller._id
    });
  } catch (error) {
    console.error('Seller register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.', error: error.message });
  }
});

router.post('/verify-phone', async (req, res) => {
  try {
    const { sellerId, otp } = req.body;

    if (!sellerId || !otp) {
      return res.status(400).json({ success: false, message: 'Seller ID and OTP are required.' });
    }

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    if (seller.phoneOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    if (new Date() > seller.phoneOtpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
    }

    seller.phoneOtp = undefined;
    seller.phoneOtpExpiry = undefined;
    await seller.save();

    res.json({
      success: true,
      message: 'Phone verified successfully. You can now login.'
    });
  } catch (error) {
    console.error('Verify phone error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;

    const seller = await Seller.findOne({ email });
    if (!seller) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!seller.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    // Check if account is locked
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
      // Increment failed login attempts
      seller.failedLoginAttempts = (seller.failedLoginAttempts || 0) + 1;
      
      // Lock account after 3 failed attempts for 3 minutes
      if (seller.failedLoginAttempts >= 3) {
        seller.lockUntil = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes
        seller.failedLoginAttempts = 0; // Reset after locking
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

    // Reset failed attempts on successful login
    seller.failedLoginAttempts = 0;
    seller.lockUntil = null;

    // Check if this is a test credential - bypass OTP for testing
    const testSellerEmails = ['opticalworld@gmail.com', 'visioncare@gmail.com', 'lensstudio@gmail.com', 'eyefashion@gmail.com'];
    const isTestCredential = testSellerEmails.includes(email);

    if (isTestCredential) {
      // Direct login for test credentials
      const token = generateSellerToken(seller._id);
      seller.loginTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours for sellers
      seller.lastLoginAt = new Date();
      seller.isOnline = true;
      await seller.save();

      res.json({
        success: true,
        message: 'Login successful.',
        token,
        seller: seller.toJSON()
      });
    } else {
      // Generate OTP for login verification (production flow)
      const loginOtp = otpGenerator.generate('6789', { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false });

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
    console.error('Seller login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
});

router.post('/verify-login-otp', async (req, res) => {
  try {
    const { sellerId, otp } = req.body;

    if (!sellerId || !otp) {
      return res.status(400).json({ success: false, message: 'Seller ID and OTP are required.' });
    }

    const seller = await Seller.findById(sellerId);
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
    seller.isOnline = true;
    await seller.save();

    const token = generateSellerToken(seller._id);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      seller: seller.toJSON()
    });
  } catch (error) {
    console.error('Verify login OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/logout', verifySeller, async (req, res) => {
  try {
    req.seller.isOnline = false;
    await req.seller.save();

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Seller logout error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/me', verifySeller, async (req, res) => {
  try {
    res.json({
      success: true,
      seller: req.seller.toJSON()
    });
  } catch (error) {
    console.error('Get seller profile error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/update-profile', verifySeller, async (req, res) => {
  try {
    const {
      storeName, storeDescription, storeLogo, storeBanner
    } = req.body;

    const updateData = {};
    if (storeName) updateData.storeName = storeName;
    if (storeDescription !== undefined) updateData.storeDescription = storeDescription;
    if (storeLogo) updateData.storeLogo = storeLogo;
    if (storeBanner) updateData.storeBanner = storeBanner;

    const seller = await Seller.findByIdAndUpdate(req.seller._id, updateData, { new: true, runValidators: true });

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      seller: seller.toJSON()
    });
  } catch (error) {
    console.error('Update seller profile error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/subscribe', verifySeller, async (req, res) => {
  try {
    const sellerId = req.seller._id;

    const amount = 500;
    const gstAmount = 90;
    const totalAmount = 590;

    const razorpayOrder = await createRazorpayOrder(totalAmount, 'INR', `seller_sub_${sellerId}_${Date.now()}`);

    if (!razorpayOrder.success) {
      return res.status(500).json({ success: false, message: 'Failed to create payment order.', error: razorpayOrder.error });
    }

    res.json({
      success: true,
      orderId: razorpayOrder.orderId,
      amount: totalAmount * 100,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/orders', verifySeller, async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { seller: sellerId };
    if (status) query.orderStatus = status;

    const orders = await Order.find(query)
      .populate('items.product', 'title images price')
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get seller orders error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/orders/:id/status', verifySeller, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const sellerId = req.seller._id;

    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['packed', 'cancelled'],
      packed: ['picked_up'],
      picked_up: ['in_transit'],
      in_transit: ['delivered']
    };

    const order = await Order.findOne({ _id: id, seller: sellerId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (!validTransitions[order.orderStatus] || !validTransitions[order.orderStatus].includes(status)) {
      return res.status(400).json({ success: false, message: `Cannot transition from ${order.orderStatus} to ${status}.` });
    }

    order.orderStatus = status;
    if (status === 'delivered') {
      order.deliveryDate = new Date();
    }
    await order.save();

    res.json({
      success: true,
      message: `Order status updated to ${status}.`,
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/orders/:id/pack', verifySeller, async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.seller._id;

    const order = await Order.findOne({ _id: id, seller: sellerId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.orderStatus !== 'confirmed') {
      return res.status(400).json({ success: false, message: 'Order must be confirmed before packing.' });
    }

    order.orderStatus = 'packed';
    await order.save();

    res.json({
      success: true,
      message: 'Order marked as packed.',
      order
    });
  } catch (error) {
    console.error('Pack order error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/analytics', verifySeller, async (req, res) => {
  try {
    const sellerId = req.seller._id;

    const totalOrders = await Order.countDocuments({ seller: sellerId });
    const pendingOrders = await Order.countDocuments({ seller: sellerId, orderStatus: 'pending' });
    const confirmedOrders = await Order.countDocuments({ seller: sellerId, orderStatus: 'confirmed' });
    const deliveredOrders = await Order.countDocuments({ seller: sellerId, orderStatus: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ seller: sellerId, orderStatus: 'cancelled' });

    const revenueResult = await Order.aggregate([
      { $match: { seller: sellerId, paymentStatus: 'completed', orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, avgOrderValue: { $avg: '$totalAmount' } } }
    ]);

    const totalRevenue = revenueResult[0]?.totalRevenue || 0;
    const avgOrderValue = revenueResult[0]?.avgOrderValue || 0;

    const totalProducts = await Product.countDocuments({ seller: sellerId });
    const activeProducts = await Product.countDocuments({ seller: sellerId, isActive: true });

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const recentOrders = await Order.find({
      seller: sellerId,
      createdAt: { $gte: last7Days }
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      analytics: {
        totalOrders,
        pendingOrders,
        confirmedOrders,
        deliveredOrders,
        cancelledOrders,
        totalRevenue,
        avgOrderValue: Math.round(avgOrderValue),
        totalProducts,
        activeProducts,
        recentOrders: recentOrders.length
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/pickups', verifySeller, async (req, res) => {
  try {
    const sellerId = req.seller._id;

    const orders = await Order.find({
      seller: sellerId,
      orderStatus: { $in: ['packed', 'picked_up'] },
      pickupDate: { $exists: true, $ne: null }
    }).sort({ pickupDate: 1 }).limit(20);

    res.json({
      success: true,
      pickups: orders.map(order => ({
        orderId: order._id,
        orderNumber: order.orderNumber,
        pickupDate: order.pickupDate,
        status: order.orderStatus,
        trackingId: order.shiprocketTrackingId,
        trackingUrl: order.shiprocketTrackingUrl
      }))
    });
  } catch (error) {
    console.error('Get pickups error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/products/:id/offer', verifySeller, async (req, res) => {
  try {
    const { type, value, startFrom, endAt } = req.body;

    const product = await Product.findOne({ _id: req.params.id, seller: req.seller._id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found or not owned by you.' });
    }

    if (product.isUnderSaleEvent) {
      return res.status(400).json({ success: false, message: 'Cannot modify offers while product is under a platform sale event.' });
    }

    product.sellerOffer = {
      type: type || 'none',
      value: value || 0,
      isActive: type && type !== 'none' && value > 0,
      startFrom: startFrom ? new Date(startFrom) : undefined,
      endAt: endAt ? new Date(endAt) : undefined
    };

    if (product.sellerOffer.isActive && product.sellerOffer.type === 'percentage') {
      product.discountedPrice = Math.round(product.price * (1 - product.sellerOffer.value / 100));
      product.effectivePrice = product.discountedPrice;
    } else {
      product.discountedPrice = product.price;
      product.effectivePrice = product.price;
    }

    await product.save();

    res.json({ success: true, message: 'Offer updated successfully.', product });
  } catch (error) {
    console.error('Update offer error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/products/:id/offer', verifySeller, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, seller: req.seller._id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found or not owned by you.' });
    }

    if (product.isUnderSaleEvent) {
      return res.status(400).json({ success: false, message: 'Cannot remove offer while product is under a platform sale event.' });
    }

    product.sellerOffer = { type: 'none', value: 0, isActive: false };
    product.discountedPrice = product.price;
    product.effectivePrice = product.price;
    await product.save();

    res.json({ success: true, message: 'Offer removed successfully.', product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
