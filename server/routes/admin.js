import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Seller from '../models/Seller.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Subscription from '../models/Subscription.js';
import Coupon from '../models/Coupon.js';
import StaffRole from '../models/StaffRole.js';
import Notification from '../models/Notification.js';
import { verifyToken, verifyAdmin, verifyStaff } from '../middleware/auth.js';

const router = express.Router();

router.get('/dashboard', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalSellers = await Seller.countDocuments();
    const verifiedSellers = await Seller.countDocuments({ isVerified: true });
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });
    const deliveredOrders = await Order.countDocuments({ orderStatus: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ orderStatus: 'cancelled' });

    const revenueResult = await Order.aggregate([
      { $match: { paymentStatus: 'completed', orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, avgOrderValue: { $avg: '$totalAmount' } } }
    ]);

    const totalRevenue = revenueResult[0]?.totalRevenue || 0;
    const avgOrderValue = Math.round(revenueResult[0]?.avgOrderValue || 0);

    const totalProducts = await Product.countDocuments({ isActive: true });

    const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });

    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const recentOrders = await Order.aggregate([
      { $match: { createdAt: { $gte: last30Days } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } }
    ]);

    const topSellers = await Order.aggregate([
      { $match: { paymentStatus: 'completed', orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: '$seller', totalRevenue: { $sum: '$totalAmount' }, orderCount: { $sum: 1 } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'sellers', localField: '_id', foreignField: '_id', as: 'seller' } },
      { $unwind: '$seller' },
      { $project: { storeName: '$seller.storeName', totalRevenue: 1, orderCount: 1 } }
    ]);

    res.json({
      success: true,
      dashboard: {
        totalUsers,
        totalSellers,
        verifiedSellers,
        totalOrders,
        pendingOrders,
        deliveredOrders,
        cancelledOrders,
        totalRevenue,
        avgOrderValue,
        totalProducts,
        activeSubscriptions,
        recentOrders,
        topSellers
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = { role: 'user' };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({ success: true, users, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot delete admin user.' });
    }

    user.isActive = false;
    await user.save();

    res.json({ success: true, message: 'User deactivated successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/sellers', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { storeName: { $regex: search, $options: 'i' } },
        { sellerId: { $regex: search, $options: 'i' } },
        { gstNumber: { $regex: search, $options: 'i' } },
        { panNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const sellers = await Seller.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Seller.countDocuments(query);

    res.json({ success: true, sellers, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/sellers/:id/verify', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    seller.isVerified = true;
    seller.verifiedBy = req.user._id;
    seller.verifiedAt = new Date();
    await seller.save();

    await Notification.create({
      seller: seller._id,
      type: 'system',
      title: 'Account Verified',
      message: `Congratulations! Your seller account "${seller.storeName}" has been verified.`
    });

    res.json({ success: true, message: 'Seller verified successfully.', seller });
  } catch (error) {
    console.error('Verify seller error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/sellers/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    seller.isActive = false;
    await seller.save();

    await Product.updateMany({ seller: seller._id }, { isActive: false });

    res.json({ success: true, message: 'Seller deactivated successfully.' });
  } catch (error) {
    console.error('Delete seller error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/orders', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const query = {};

    if (status) query.orderStatus = status;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('seller', 'storeName')
      .populate('items.product', 'title')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/subscriptions', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = {};
    if (status) query.status = status;

    const subscriptions = await Subscription.find(query)
      .populate('seller', 'storeName name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Subscription.countDocuments(query);

    res.json({
      success: true,
      subscriptions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/revenue', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    let dateFormat;
    switch (period) {
      case 'daily': dateFormat = '%Y-%m-%d'; break;
      case 'weekly': dateFormat = '%Y-W%V'; break;
      case 'yearly': dateFormat = '%Y'; break;
      default: dateFormat = '%Y-%m';
    }

    const revenue = await Order.aggregate([
      { $match: { paymentStatus: 'completed', orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
          platformFees: { $sum: '$platformFee' },
          deliveryCharges: { $sum: '$deliveryCharge' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const totalRevenue = revenue.reduce((sum, r) => sum + r.revenue, 0);
    const totalPlatformFees = revenue.reduce((sum, r) => sum + r.platformFees, 0);
    const totalDeliveryCharges = revenue.reduce((sum, r) => sum + r.deliveryCharges, 0);

    res.json({
      success: true,
      revenue: {
        breakdown: revenue,
        totalRevenue,
        totalPlatformFees,
        totalDeliveryCharges,
        netRevenue: totalPlatformFees
      }
    });
  } catch (error) {
    console.error('Revenue error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/staff', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { email, name, role, permissions } = req.body;

    if (!email || !name || !role) {
      return res.status(400).json({ success: false, message: 'Email, name, and role are required.' });
    }

    const existingStaff = await StaffRole.findOne({ email });
    if (existingStaff) {
      return res.status(400).json({ success: false, message: 'Staff with this email already exists.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists.' });
    }

    const tempPassword = `Staff${Date.now()}@`;
    const user = new User({
      name,
      email,
      password: tempPassword,
      role: 'staff'
    });
    await user.save();

    const staff = new StaffRole({
      admin: req.user._id,
      email,
      name,
      role,
      permissions: permissions || []
    });
    await staff.save();

    res.status(201).json({
      success: true,
      message: 'Staff account created successfully.',
      staff,
      tempPassword
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/staff', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const staff = await StaffRole.find()
      .populate('admin', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, staff });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/staff/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const staff = await StaffRole.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found.' });
    }

    staff.isActive = false;
    await staff.save();

    await User.findOneAndUpdate({ email: staff.email }, { isActive: false });

    res.json({ success: true, message: 'Staff deactivated successfully.' });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/staff/:id/permissions', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { permissions } = req.body;

    const staff = await StaffRole.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found.' });
    }

    staff.permissions = permissions || [];
    await staff.save();

    res.json({ success: true, message: 'Permissions updated.', staff });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/coupons', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, coupons });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/coupons', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const coupon = new Coupon(req.body);
    coupon.code = coupon.code.toUpperCase();
    await coupon.save();

    res.status(201).json({ success: true, message: 'Coupon created.', coupon });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/coupons/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }
    res.json({ success: true, message: 'Coupon updated.', coupon });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/coupons/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Coupon deleted.' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/seller-payouts', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const payouts = await Order.aggregate([
      { $match: { paymentStatus: 'completed', orderStatus: 'delivered' } },
      {
        $group: {
          _id: '$seller',
          totalPayout: { $sum: { $subtract: ['$totalAmount', '$platformFee'] } },
          totalPlatformFee: { $sum: '$platformFee' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalPayout: -1 } },
      { $lookup: { from: 'sellers', localField: '_id', foreignField: '_id', as: 'seller' } },
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          sellerName: '$seller.storeName',
          sellerEmail: '$seller.email',
          bankAccount: '$seller.bankAccount',
          totalPayout: 1,
          totalPlatformFee: 1,
          orderCount: 1
        }
      }
    ]);

    res.json({ success: true, payouts });
  } catch (error) {
    console.error('Seller payouts error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/delivery', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const orders = await Order.find({
      orderStatus: { $in: ['in_transit', 'delivered'] }
    })
      .populate('user', 'name phone email')
      .populate('seller', 'storeName')
      .sort({ updatedAt: -1 })
      .limit(50);

    const inTransit = orders.filter(o => o.orderStatus === 'in_transit');
    const delivered = orders.filter(o => o.orderStatus === 'delivered');

    res.json({
      success: true,
      delivery: {
        inTransit: inTransit.length,
        delivered: delivered.length,
        orders
      }
    });
  } catch (error) {
    console.error('Delivery error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/pickups', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const orders = await Order.find({
      orderStatus: { $in: ['packed', 'picked_up'] },
      pickupDate: { $exists: true, $ne: null }
    })
      .populate('seller', 'storeName')
      .sort({ pickupDate: 1 })
      .limit(50);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayPickups = orders.filter(o => {
      const pd = new Date(o.pickupDate);
      return pd >= today && pd < tomorrow;
    });

    const upcomingPickups = orders.filter(o => new Date(o.pickupDate) >= tomorrow);

    res.json({
      success: true,
      pickups: {
        today: todayPickups,
        upcoming: upcomingPickups,
        total: orders.length
      }
    });
  } catch (error) {
    console.error('Pickups error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Ban/Unban User
router.put('/users/:id/ban', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { isBanned, isShadowBanned, banReason } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isBanned: isBanned !== undefined ? isBanned : undefined,
        isShadowBanned: isShadowBanned !== undefined ? isShadowBanned : undefined,
        banReason: banReason || '',
        bannedBy: req.user.id,
        bannedAt: isBanned || isShadowBanned ? new Date() : null
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User ban status updated', user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Ban/Unban Seller
router.put('/sellers/:id/ban', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { isBanned, isShadowBanned, banReason } = req.body;
    
    const seller = await Seller.findByIdAndUpdate(
      req.params.id,
      {
        isBanned: isBanned !== undefined ? isBanned : undefined,
        isShadowBanned: isShadowBanned !== undefined ? isShadowBanned : undefined,
        banReason: banReason || '',
        bannedBy: req.user.id,
        bannedAt: isBanned || isShadowBanned ? new Date() : null
      },
      { new: true }
    );

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    res.json({ success: true, message: 'Seller ban status updated', seller });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get user by ID
router.get('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get user orders
router.get('/users/:id/orders', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.id })
      .sort({ createdAt: -1 })
      .populate('seller', 'storeName');
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get seller by ID
router.get('/sellers/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id).select('-password');
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    res.json({ success: true, data: seller });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get seller products
router.get('/sellers/:id/products', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const products = await Product.find({ seller: req.params.id })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get seller orders
router.get('/sellers/:id/orders', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const orders = await Order.find({ seller: req.params.id })
      .sort({ createdAt: -1 })
      .populate('user', 'name email');
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
