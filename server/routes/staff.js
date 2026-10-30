import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Blog from '../models/Blog.js';
import Review from '../models/Review.js';
import ReturnRequest from '../models/ReturnRequest.js';
import { verifyToken, verifyStaff } from '../middleware/auth.js';

const router = express.Router();

// Every route below is for staff accounts (a User with a matching StaffRole).
// verifyStaff resolves req.staff (role + permissions) and lets admins through.

const objectId = (id) => new mongoose.Types.ObjectId(id);

// GET /api/staff/overview
// Counters for whichever queue the signed-in staff member owns.
router.get('/overview', verifyStaff, async (req, res) => {
  try {
    const role = req.staff ? req.staff.role : req.user.staffRole;

    const [
      pendingOrders, inTransit, openReturns, pendingProducts,
      publishedBlogs, draftBlogs, pendingReviews
    ] = await Promise.all([
      Order.countDocuments({ orderStatus: 'pending' }),
      Order.countDocuments({ orderStatus: { $in: ['packed', 'picked_up', 'in_transit'] } }),
      ReturnRequest.countDocuments({ status: { $in: ['requested', 'approved', 'picked_up'] } }),
      Product.countDocuments({ verificationStatus: 'pending' }),
      Blog.countDocuments({ isPublished: true }),
      Blog.countDocuments({ isPublished: false }),
      Review.countDocuments({ isApproved: false })
    ]);

    const queues = {
      blog_manager: [
        { key: 'draftBlogs', label: 'Draft posts', value: draftBlogs },
        { key: 'publishedBlogs', label: 'Published posts', value: publishedBlogs }
      ],
      delivery_manager: [
        { key: 'pendingOrders', label: 'Orders awaiting dispatch', value: pendingOrders },
        { key: 'inTransit', label: 'In transit', value: inTransit }
      ],
      pickup_manager: [
        { key: 'inTransit', label: 'Awaiting pickup', value: inTransit },
        { key: 'pendingOrders', label: 'Not yet confirmed', value: pendingOrders }
      ],
      seller_manager: [
        { key: 'pendingProducts', label: 'Products awaiting verification', value: pendingProducts }
      ],
      doc_verifier: [
        { key: 'pendingProducts', label: 'Documents to verify', value: pendingProducts }
      ],
      user_manager: [
        { key: 'pendingReviews', label: 'Reviews to moderate', value: pendingReviews }
      ],
      finance_manager: [
        { key: 'openReturns', label: 'Open returns', value: openReturns }
      ]
    };

    res.json({
      success: true,
      role,
      permissions: (req.staff && req.staff.permissions) || req.user.permissions || [],
      queues: queues[role] || queues.seller_manager,
      totals: { pendingOrders, inTransit, openReturns, pendingProducts, publishedBlogs, draftBlogs, pendingReviews }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/staff/orders - dispatch work list
router.get('/orders', verifyStaff, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 25 } = req.query;
    const query = {};
    if (status) query.orderStatus = status;
    if (search) {
      query.$or = [
        { orderId: { $regex: String(search), $options: 'i' } },
        { 'shippingAddress.city': { $regex: String(search), $options: 'i' } }
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate('user', 'name email phone')
        .populate('seller', 'storeName')
        .lean(),
      Order.countDocuments(query)
    ]);

    res.json({ success: true, orders, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/staff/products - verification work list
router.get('/products', verifyStaff, async (req, res) => {
  try {
    const { verification: v, brand, search, page = 1, limit = 25 } = req.query;
    const query = {};
    if (v) query.verificationStatus = v;
    if (brand) query.brand = brand;
    if (search) {
      query.$or = [
        { title: { $regex: String(search), $options: 'i' } },
        { brand: { $regex: String(search), $options: 'i' } },
        { modelNumber: { $regex: String(search), $options: 'i' } }
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate('seller', 'storeName')
        .lean(),
      Product.countDocuments(query)
    ]);

    res.json({ success: true, products, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/staff/blogs - content work list
router.get('/blogs', verifyStaff, async (req, res) => {
  try {
    const { search } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: String(search), $options: 'i' } },
        { category: { $regex: String(search), $options: 'i' } }
      ];
    }
    const blogs = await Blog.find(query).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, blogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/staff/returns - returns work list
router.get('/returns', verifyStaff, async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};
    if (status) query.status = status;
    const rows = await ReturnRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate({ path: 'order', select: 'orderId user seller', populate: { path: 'user', select: 'name email' } })
      .lean();

    let list = rows;
    if (search) {
      const q = String(search).toLowerCase();
      list = rows.filter((r) =>
        [r.order?.orderId, r.order?.user?.name, r.reason, r.status]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
    }

    res.json({ success: true, returns: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
