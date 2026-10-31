import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator';
import Executive from '../models/Executive.js';
import ExecutiveStaff from '../models/ExecutiveStaff.js';
import User from '../models/User.js';
import Seller from '../models/Seller.js';
import Order from '../models/Order.js';
import { verifyToken, verifyAdmin, verifyExecutive } from '../middleware/auth.js';
import { sendOTP, sendOrderStatusNotification } from '../services/email.js';
import { settleDeliveredOrder } from '../services/commissionTracking.js';

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
    // Second-factor OTP may only be skipped outside production, and only
    // for the well-known seededdemo accounts whose password is also public.
    const allowOtpBypass = process.env.NODE_ENV !== 'production' && process.env.AUTH_OTP_BYPASS !== 'false';
    const isTestCredential = allowOtpBypass && testExecutiveEmails.includes(email);

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
      const loginOtp = otpGenerator.generate(6, { 
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
        requiresOTP: true,
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

// Executive dashboard endpoints
router.get('/dashboard/stats', verifyExecutive, async (req, res) => {
  try {
    const executiveId = req.executive._id;
    const scoped = { assignedExecutive: executiveId };

    const [totalOrders, delivered, inProgress, pending] = await Promise.all([
      Order.countDocuments(scoped),
      Order.countDocuments({ ...scoped, orderStatus: 'delivered' }),
      Order.countDocuments({ ...scoped, orderStatus: { $in: ['packed', 'picked_up', 'in_transit'] } }),
      Order.countDocuments({ ...scoped, orderStatus: { $in: ['pending', 'confirmed'] } })
    ]);

    // Executives that are not yet attached to orders still get a meaningful
    // view of the queue they are responsible for.
    let queue = 0;
    if (totalOrders === 0) {
      queue = await Order.countDocuments({
        orderStatus: { $in: ['pending', 'confirmed', 'packed'] },
        assignmentStatus: { $in: ['pending', 'pending_acceptance', 'assigned', 'admin_required'] }
      });
    }

    res.json({
      success: true,
      data: {
        totalOrders: totalOrders || queue,
        completedOrders: delivered,
        inProgressOrders: inProgress,
        pendingOrders: pending || queue,
        department: req.executive.department || 'delivery'
      }
    });
  } catch (error) {
    console.error('Executive stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/deliveries/assigned', verifyExecutive, async (req, res) => {
  try {
    const executiveId = req.executive._id;

    let orders = await Order.find({ assignedExecutive: executiveId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('user', 'name email phone')
      .populate('seller', 'storeName phone email address city')
      .populate('assignedDeliveryPartner', 'name phone email vehicleType status')
      .populate('items.product', 'title images brand')
      .lean();

    // Nothing assigned yet: show the active delivery queue instead.
    if (orders.length === 0) {
      orders = await Order.find({ orderStatus: { $in: ['confirmed', 'packed', 'picked_up', 'in_transit'] } })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('user', 'name email phone')
        .populate('seller', 'storeName phone email address city')
        .populate('assignedDeliveryPartner', 'name phone email vehicleType status')
        .populate('items.product', 'title images brand')
        .lean();
    }

    const deliveries = orders.map((o) => ({
      _id: o._id,
      orderId: o.orderId,
      orderStatus: o.orderStatus,
      assignmentStatus: o.assignmentStatus,
      paymentStatus: o.paymentStatus,
      totalAmount: o.totalAmount,
      deliveryCharge: o.deliveryCharge,
      deliveryFee: o.deliveryFee || 0,
      deliveryDistanceKm: o.deliveryDistanceKm || 0,
      deliveryAssignmentMode: o.deliveryAssignmentMode || 'none',
      trackingId: o.shiprocketTrackingId || '',
      trackingUrl: o.shiprocketTrackingUrl || '',
      createdAt: o.createdAt,
      deliveredAt: o.deliveredAt || null,
      customer: o.user ? { name: o.user.name, email: o.user.email, phone: o.user.phone } : null,
      seller: o.seller ? {
        storeName: o.seller.storeName,
        phone: o.seller.phone,
        email: o.seller.email,
        city: o.seller.address?.city || '',
        address: [o.seller.address?.street, o.seller.address?.city, o.seller.address?.pincode].filter(Boolean).join(', ')
      } : null,
      deliveryPartner: o.assignedDeliveryPartner ? {
        name: o.assignedDeliveryPartner.name,
        phone: o.assignedDeliveryPartner.phone,
        email: o.assignedDeliveryPartner.email,
        vehicleType: o.assignedDeliveryPartner.vehicleType,
        status: o.assignedDeliveryPartner.status
      } : null,
      shippingAddress: o.shippingAddress,
      pickupLocation: o.pickupLocation || null,
      deliveryLocation: o.deliveryLocation || null,
      deliveryJourney: o.deliveryJourney || [],
      items: (o.items || []).map((it) => ({
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        image: it.product?.images?.[0] || '',
        brand: it.product?.brand || '',
        variant: it.variant || {},
        lensConfig: it.lensConfig || null
      }))
    }));

    res.json({ success: true, data: deliveries });
  } catch (error) {
    console.error('Executive deliveries error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/deliveries/:id', verifyExecutive, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('seller', 'storeName phone email address')
      .populate('assignedDeliveryPartner', 'name phone email vehicleType status currentLocation')
      .populate('items.product', 'title images brand')
      .lean();

    if (!order) return res.json({ success: true, data: null });

    res.json({
      success: true,
      data: {
        _id: order._id,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        customer: order.user ? { name: order.user.name, email: order.user.email, phone: order.user.phone } : null,
        seller: order.seller ? { storeName: order.seller.storeName, phone: order.seller.phone } : null,
        deliveryPartner: order.assignedDeliveryPartner
          ? { name: order.assignedDeliveryPartner.name, phone: order.assignedDeliveryPartner.phone } : null,
        shippingAddress: order.shippingAddress,
        pickupLocation: order.pickupLocation || null,
        deliveryLocation: order.deliveryLocation || null,
        deliveryJourney: order.deliveryJourney || [],
        trackingId: order.shiprocketTrackingId || '',
        trackingUrl: order.shiprocketTrackingUrl || '',
        items: (order.items || []).map((it) => ({
          name: it.name, quantity: it.quantity, price: it.price,
          image: it.product?.images?.[0] || '', lensConfig: it.lensConfig || null
        }))
      }
    });
  } catch (error) {
    console.error('Executive delivery detail error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/deliveries/:id/status', verifyExecutive, async (req, res) => {
  try {
    const { status, note } = req.body;
    const allowed = ['pending', 'confirmed', 'packed', 'picked_up', 'in_transit', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery status.' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    order.orderStatus = status;
    order.deliveryJourney.push({ status, note: note || 'Updated by executive', at: new Date() });
    if (status === 'delivered') {
      order.deliveredAt = new Date();
      order.deliveryDate = new Date();
    }
    await order.save();

    await settleDeliveredOrder(order);

    try {
      const withBuyer = await Order.findById(order._id).populate('user', 'email name');
      if (withBuyer?.user?.email) {
        await sendOrderStatusNotification(withBuyer.user.email, withBuyer, status);
      }
    } catch (mailErr) {
      console.error('Order status email skipped:', mailErr.message);
    }

    res.json({ success: true, message: 'Delivery status updated.', order });
  } catch (error) {
    console.error('Executive delivery status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Customers served by this executive (distinct buyers on their orders).
router.get('/customers', verifyExecutive, async (req, res) => {
  try {
    const orders = await Order.find({ assignedExecutive: req.executive._id })
      .select('user totalAmount orderStatus createdAt')
      .populate('user', 'name email phone')
      .lean();

    const byUser = {};
    orders.forEach((o) => {
      const uid = o.user?._id?.toString();
      if (!uid) return;
      if (!byUser[uid]) {
        byUser[uid] = {
          _id: uid,
          name: o.user.name,
          email: o.user.email,
          phone: o.user.phone,
          orders: 0,
          spent: 0,
          lastOrderAt: o.createdAt
        };
      }
      byUser[uid].orders += 1;
      byUser[uid].spent += o.totalAmount || 0;
      if (o.createdAt && new Date(o.createdAt) > new Date(byUser[uid].lastOrderAt)) {
        byUser[uid].lastOrderAt = o.createdAt;
      }
    });

    res.json({ success: true, data: Object.values(byUser) });
  } catch (error) {
    console.error('Executive customers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reports for this executive: status split, revenue handled and daily volume.
router.get('/reports', verifyExecutive, async (req, res) => {
  try {
    const executiveId = req.executive._id;

    const [statusSplit, revenueAgg, dailyAgg] = await Promise.all([
      Order.aggregate([
        { $match: { assignedExecutive: new mongoose.Types.ObjectId(executiveId) } },
        { $group: { _id: '$orderStatus', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } }
      ]),
      Order.aggregate([
        { $match: { assignedExecutive: new mongoose.Types.ObjectId(executiveId) } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 },
                    deliveryFees: { $sum: '$deliveryFee' }, distances: { $sum: '$deliveryDistanceKm' } } }
      ]),
      Order.aggregate([
        { $match: { assignedExecutive: new mongoose.Types.ObjectId(executiveId) } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
        { $sort: { _id: 1 } },
        { $limit: 30 }
      ])
    ]);

    const totals = revenueAgg[0] || { total: 0, count: 0, deliveryFees: 0, distances: 0 };

    res.json({
      success: true,
      data: {
        byStatus: statusSplit.map((s) => ({ status: s._id, count: s.count, amount: s.amount })),
        totals: {
          orders: totals.count,
          revenue: totals.total,
          deliveryFees: totals.deliveryFees,
          distanceKm: Math.round((totals.distances || 0) * 100) / 100
        },
        daily: dailyAgg.map((d) => ({ date: d._id, count: d.count, amount: d.amount }))
      }
    });
  } catch (error) {
    console.error('Executive reports error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
