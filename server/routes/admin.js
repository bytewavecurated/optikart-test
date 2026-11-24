import express from 'express';
import { validateBrandListOwnership, clashMessage } from '../services/brandOwnership.js';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Seller from '../models/Seller.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import StaffRole from '../models/StaffRole.js';
import Notification from '../models/Notification.js';
import { verifyToken, verifyAdmin, verifyStaff } from '../middleware/auth.js';
import {
  adminQueue as adminListingQueues,
  decideAsAdmin as decideListingAsAdmin,
} from '../services/listingApproval.js';
import Executive from '../models/Executive.js';
import Manufacturer from '../models/Manufacturer.js';
import ManufacturerSeller from '../models/ManufacturerSeller.js';

import { buildListQuery, listResponse } from '../services/adminQuery.js';
const router = express.Router();

/*
 * The platform half of the supply-claim check, and the rows that predate the
 * rule. Grandfathered listings keep selling - silently emptying the storefront
 * would be its own kind of damage - but they are listed labelled, so a human
 * can decide rather than the system pretending they were verified.
 */
router.get('/listing-approvals', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const queues = await adminListingQueues();
    res.json({ success: true, ...queues });
  } catch (error) {
    console.error('Listing approvals error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/listing-approvals/decide', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { listingKind, listingId, decision, reason } = req.body || {};
    const result = await decideListingAsAdmin({
      listingKind,
      id: listingId,
      decision,
      reason,
      actorLabel: req.user.name || req.user.email || 'admin',
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Listing approval decision error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});
/*
 * The coupon form used to post field names the model never had (`type`,
 * `value`, `minOrder`) and omitted a required `validFrom`, so creating a coupon
 * from the admin panel always failed - and failed as a 500 "Server error",
 * because mongoose raised the validation and the handler had no branch for it.
 * Fields are named against the model here and a rejected value comes back as
 * that field plus the reason.
 */
const COUPON_TYPES = ['percentage', 'fixed'];

function couponFromBody(body = {}, { partial = false } = {}) {
  const out = {};
  const errors = [];
  const has = (k) => body[k] !== undefined && body[k] !== null && body[k] !== '';

  if (!partial || has('code')) {
    if (!has('code')) errors.push({ field: 'code', message: 'Coupon code is required' });
    else out.code = String(body.code).trim().toUpperCase();
  }
  if (!partial || has('discountType')) {
    const t = String(body.discountType || '').trim();
    if (!COUPON_TYPES.includes(t)) {
      errors.push({ field: 'discountType', message: `Discount type must be ${COUPON_TYPES.join(' or ')}` });
    } else out.discountType = t;
  }
  if (!partial || has('discountValue')) {
    const v = Number(body.discountValue);
    if (!Number.isFinite(v) || v <= 0)
      errors.push({ field: 'discountValue', message: 'Discount value must be a number above zero' });
    else if (out.discountType === 'percentage' && v > 100)
      errors.push({ field: 'discountValue', message: 'A percentage discount cannot exceed 100' });
    else out.discountValue = v;
  }
  ['minOrderAmount', 'maxDiscount', 'usageLimit'].forEach((k) => {
    if (!has(k)) return;
    const n = Number(body[k]);
    if (!Number.isFinite(n) || n < 0) errors.push({ field: k, message: `${k} must be zero or more` });
    else out[k] = n;
  });
  ['validFrom', 'validUntil'].forEach((k) => {
    if (!partial || has(k)) {
      const d = new Date(body[k]);
      if (Number.isNaN(d.getTime())) errors.push({ field: k, message: `${k} must be a real date` });
      else out[k] = d;
    }
  });
  if (out.validFrom && out.validUntil && out.validUntil <= out.validFrom) {
    errors.push({ field: 'validUntil', message: 'The coupon would expire before it starts' });
  }
  if (has('description')) out.description = String(body.description).slice(0, 300);
  if (has('isActive')) out.isActive = !!body.isActive;
  if (Array.isArray(body.applicableCategories)) {
    out.applicableCategories = body.applicableCategories.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
  }
  return { out, errors };
}

// GET /api/admin/me - the signed-in administrator's own profile.
router.get('/me', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id).select('-password -__v');
    if (!admin) return res.status(404).json({ success: false, message: 'Admin account not found.' });
    res.json({ success: true, admin });
  } catch (error) {
    console.error('Admin me error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

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
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, avgOrderValue: { $avg: '$totalAmount' } } },
    ]);

    const totalRevenue = revenueResult[0]?.totalRevenue || 0;
    const avgOrderValue = Math.round(revenueResult[0]?.avgOrderValue || 0);

    const totalProducts = await Product.countDocuments({ isActive: true });

    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const recentOrders = await Order.aggregate([
      { $match: { createdAt: { $gte: last30Days } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const topSellers = await Order.aggregate([
      { $match: { paymentStatus: 'completed', orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: '$seller', totalRevenue: { $sum: '$totalAmount' }, orderCount: { $sum: 1 } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'sellers', localField: '_id', foreignField: '_id', as: 'seller' } },
      { $unwind: '$seller' },
      { $project: { storeName: '$seller.storeName', totalRevenue: 1, orderCount: 1 } },
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
        recentOrders,
        topSellers,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { query, sort, skip, limit, meta } = buildListQuery(req.query, {
      base: { role: 'user' },
      fields: ['name', 'email', 'phone', 'userId'],
      statuses: {
        // map form inside the ONE normalizer: semantics stay in the query
        // built correctly, and search never gets collateral damage.
        active: { $and: [{ isActive: true }, { isBanned: { $ne: true } }] },
        inactive: { $or: [{ isActive: false }, { isBanned: true }] },
      },
      statusField: '_mapped',
      sortable: { createdAt: { createdAt: -1 }, name: { name: 1 }, joined: { createdAt: -1 } },
    });
    const users = await User.find(query).select('-password').sort(sort).skip(skip).limit(limit);
    const total = await User.countDocuments(query);
    return listResponse(res, 'users', users, total, meta);
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
    const { query, sort, skip, limit, meta } = buildListQuery(req.query, {
      fields: ['name', 'email', 'phone', 'storeName', 'sellerId', 'gstNumber', 'panNumber'],
      statuses: {
        verified: { isVerified: true },
        unverified: { isVerified: false },
        // 'pending' is the word the old dashboard chips used for unverified:
        // keep the alias, map it to the real column, do not invent a state.
        pending: { isVerified: false },
        inactive: { isActive: false },
        banned: { isBanned: true },
      },
      statusField: '_mapped',
      sortable: {
        createdAt: { createdAt: -1 },
        joined: { createdAt: -1 },
        storeName: { storeName: 1 },
        rating: { rating: -1 },
        sales: { totalSales: -1 },
      },
    });
    const sellers = await Seller.find(query).select('-password').sort(sort).skip(skip).limit(limit);
    const total = await Seller.countDocuments(query);
    return listResponse(res, 'sellers', sellers, total, meta);
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
      message: `Congratulations! Your seller account "${seller.storeName}" has been verified.`,
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
    const { query, sort, skip, limit, meta } = buildListQuery(req.query, {
      fields: ['orderNumber'],
      codeFields: ['orderNumber'],
      statuses: [
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'returned',
      ],
      statusField: 'orderStatus',
      sortable: { createdAt: { createdAt: -1 }, updated: { updatedAt: -1 }, amount: { totalAmount: -1 } },
    });
    // admin order search must also find the human: resolve buyer/seller text
    // to ids server-side, then fold them into the same $or the client asked
    // for. An id-less search string is then just the orderNumber clause.
    const term = meta.filters.search;
    if (term) {
      // esc first, rx only ever from esc: one escape path, every use.
      const esc = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = { $regex: esc, $options: 'i' };
      const buyerIds = await User.find({ $or: [{ name: rx }, { email: rx }, { phone: rx }, { userId: rx }] })
        .select('_id')
        .lean();
      const sellerIds = await Seller.find({ $or: [{ storeName: rx }, { email: rx }, { sellerId: rx }] })
        .select('_id')
        .lean();
      const clauses = [{ orderNumber: rx }];
      if (buyerIds.length) clauses.push({ user: { $in: buyerIds.map((u) => u._id) } });
      if (sellerIds.length) clauses.push({ seller: { $in: sellerIds.map((s) => s._id) } });
      query.$and = [...(query.$and || []), { $or: clauses }];
    }
    const orders = await Order.find(query)
      .populate('user', 'name email phone userId')
      .populate('seller', 'storeName')
      .populate('items.product', 'title')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    const total = await Order.countDocuments(query);
    return listResponse(res, 'orders', orders, total, meta);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/revenue', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    let dateFormat;
    switch (period) {
      case 'daily':
        dateFormat = '%Y-%m-%d';
        break;
      case 'weekly':
        dateFormat = '%Y-W%V';
        break;
      case 'yearly':
        dateFormat = '%Y';
        break;
      default:
        dateFormat = '%Y-%m';
    }

    const revenue = await Order.aggregate([
      { $match: { paymentStatus: 'completed', orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
          platformFees: { $sum: '$platformFee' },
          deliveryCharges: { $sum: '$deliveryCharge' },
        },
      },
      { $sort: { _id: 1 } },
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
        netRevenue: totalPlatformFees,
      },
    });
  } catch (error) {
    console.error('Revenue error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/staff', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { email, name, role, permissions, password } = req.body;

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

    // Admin supplies the login credentials (fall back to a generated one), so
    // the staff account is actually usable instead of an unknowable password.
    let tempPassword = password;
    if (!tempPassword) {
      tempPassword = `Staff${Date.now()}@`;
    }
    const user = new User({
      name,
      email,
      password: tempPassword,
      role: 'staff',
    });
    await user.save();

    const staff = new StaffRole({
      admin: req.user._id,
      email,
      name,
      role,
      permissions: permissions || [],
    });
    await staff.save();

    res.status(201).json({
      success: true,
      message: 'Staff account created successfully.',
      staff,
      tempPassword,
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/staff', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { query, sort, skip, limit, meta } = buildListQuery(req.query, {
      fields: ['name', 'email', 'role', 'permissions'],
      statuses: { active: { isActive: true }, inactive: { isActive: false } },
      statusField: '_mapped',
      dateField: 'assignedAt',
      sortable: { createdAt: { createdAt: -1 }, name: { name: 1 }, assignedAt: { assignedAt: -1 } },
    });
    const staff = await StaffRole.find(query).populate('admin', 'name email').sort(sort).skip(skip).limit(limit);
    const total = await StaffRole.countDocuments(query);
    return listResponse(res, 'staff', staff, total, meta);
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
    const now = new Date();
    const { query, sort, skip, limit, meta } = buildListQuery(req.query, {
      fields: ['code', 'title', 'description', 'couponCode'],
      statuses: {
        // a voucher is 'active' when the clock is inside its window; said
        // with plain date clauses (computed now), never $expr gymnastics.
        active: { isActive: true, startsAt: { $lte: now }, endsAt: { $gte: now } },
        expired: { endsAt: { $lt: now } },
        inactive: { isActive: false },
        scheduled: { isActive: true, startsAt: { $gt: now } },
      },
      statusField: '_mapped',
      sortable: {
        createdAt: { createdAt: -1 },
        code: { code: 1 },
        used: { usedCount: -1 },
        endsAt: { endsAt: 1 },
      },
      dateField: 'createdAt',
    });
    const coupons = await Coupon.find(query).sort(sort).skip(skip).limit(limit);
    const total = await Coupon.countDocuments(query);
    return listResponse(res, 'coupons', coupons, total, meta);
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/coupons', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { out, errors } = couponFromBody(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Fix the highlighted fields.', errors });
    }
    const clash = await Coupon.findOne({ code: out.code });
    if (clash) {
      return res.status(409).json({
        success: false,
        message: `The code ${out.code} already exists.`,
        errors: [{ field: 'code', message: 'already in use' }],
      });
    }
    const coupon = await Coupon.create(out);
    res.status(201).json({ success: true, message: 'Coupon created.', coupon });
  } catch (error) {
    if (error && error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Fix the highlighted fields.',
        errors: Object.entries(error.errors).map(([field, e]) => ({ field, message: e.message })),
      });
    }
    console.error('Create coupon error:', error);
    res.status(500).json({ success: false, message: 'The coupon could not be saved.', error: error.message });
  }
});

router.put('/coupons/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { out, errors } = couponFromBody(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Fix the highlighted fields.', errors });
    }
    // runValidators matters here: without it an edited coupon can be written
    // into a state the model forbids, such as a 150 percent discount.
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { $set: out }, { new: true, runValidators: true });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }
    res.json({ success: true, message: 'Coupon updated.', coupon });
  } catch (error) {
    if (error && error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Fix the highlighted fields.',
        errors: Object.entries(error.errors).map(([field, e]) => ({ field, message: e.message })),
      });
    }
    console.error('Update coupon error:', error);
    res.status(500).json({ success: false, message: 'The coupon could not be saved.', error: error.message });
  }
});

router.delete('/coupons/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const removed = await Coupon.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ success: false, message: 'Coupon not found.' });
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
          orderCount: { $sum: 1 },
        },
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
          orderCount: 1,
        },
      },
    ]);

    res.json({ success: true, payouts });
  } catch (error) {
    console.error('Seller payouts error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/delivery', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // same clause the board needs (transit + delivered) as a base, so a page
    // and a filter never fight over scope.
    const { query, sort, skip, limit, meta } = buildListQuery(req.query, {
      base: { orderStatus: { $in: ['in_transit', 'delivered'] } },
      fields: ['orderNumber'],
      statuses: { in_transit: { orderStatus: 'in_transit' }, delivered: { orderStatus: 'delivered' } },
      statusField: '_mapped',
      sortable: { updated: { updatedAt: -1 }, created: { createdAt: -1 } },
      dateField: 'updatedAt',
    });
    const term = meta.filters.search;
    if (term) {
      const esc = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = { $regex: esc, $options: 'i' };
      const buyerIds = await User.find({ $or: [{ name: rx }, { email: rx }, { phone: rx }] })
        .select('_id')
        .lean();
      const clauses = [{ orderNumber: rx }];
      if (buyerIds.length) clauses.push({ user: { $in: buyerIds.map((u) => u._id) } });
      query.$and = [...(query.$and || []), { $or: clauses }];
    }
    const orders = await Order.find(query)
      .populate('user', 'name phone email userId')
      .populate('seller', 'storeName')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    const total = await Order.countDocuments(query);
    // board counters independent of the current page, from the same base scope
    const scoped = { orderStatus: { $in: ['in_transit', 'delivered'] } };
    const [inTr, dl] = await Promise.all([
      Order.countDocuments({ ...scoped, orderStatus: 'in_transit' }),
      Order.countDocuments({ ...scoped, orderStatus: 'delivered' }),
    ]);
    return res.json({
      success: true,
      delivery: { inTransit: inTr, delivered: dl },
      orders,
      total,
      page: meta.page,
      limit: meta.limit,
      totalPages: Math.max(1, Math.ceil(total / meta.limit)),
      filters: meta.filters,
      badFilterParams: meta.problems.length ? meta.problems : undefined,
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
      pickupDate: { $exists: true, $ne: null },
    })
      .populate('seller', 'storeName')
      .sort({ pickupDate: 1 })
      .limit(50);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayPickups = orders.filter((o) => {
      const pd = new Date(o.pickupDate);
      return pd >= today && pd < tomorrow;
    });

    const upcomingPickups = orders.filter((o) => new Date(o.pickupDate) >= tomorrow);

    res.json({
      success: true,
      pickups: {
        today: todayPickups,
        upcoming: upcomingPickups,
        total: orders.length,
      },
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
        bannedAt: isBanned || isShadowBanned ? new Date() : null,
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
        bannedAt: isBanned || isShadowBanned ? new Date() : null,
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
    const orders = await Order.find({ user: req.params.id }).sort({ createdAt: -1 }).populate('seller', 'storeName');
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
    const products = await Product.find({ seller: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get seller orders
router.get('/sellers/:id/orders', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const orders = await Order.find({ seller: req.params.id }).sort({ createdAt: -1 }).populate('user', 'name email');
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// ==================== EXECUTIVE MANAGEMENT ====================

// Get all executives
router.get('/executives', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { query, sort, skip, limit, meta } = buildListQuery(req.query, {
      fields: ['name', 'email', 'phone', 'executiveId', 'department'],
      statuses: { active: { isActive: true }, inactive: { isActive: false } },
      statusField: '_mapped',
      sortable: { createdAt: { createdAt: -1 }, name: { name: 1 } },
    });
    // department remains an exact facet (not fuzzy search text): a dropdown
    // that silently doubles as regex would blur ops' org drill-down.
    const dept = String(req.query.department || '').trim();
    if (dept) query.$and = [...(query.$and || []), { department: dept }];
    const executives = await Executive.find(query).select('-password').sort(sort).skip(skip).limit(limit);
    const total = await Executive.countDocuments(query);
    return listResponse(res, 'executives', executives, total, meta);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/executives', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, email, password, phone, department, permissions } = req.body;

    const existingExecutive = await Executive.findOne({ email });
    if (existingExecutive) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const executive = new Executive({
      name,
      email,
      password,
      phone,
      department,
      permissions: permissions || [],
      createdBy: req.user.id,
    });

    await executive.save();

    res.status(201).json({
      success: true,
      message: 'Executive created successfully.',
      executive: executive.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Update executive
router.put('/executives/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, phone, department, permissions, isActive } = req.body;

    const executive = await Executive.findByIdAndUpdate(
      req.params.id,
      { name, phone, department, permissions, isActive },
      { new: true }
    ).select('-password');

    if (!executive) {
      return res.status(404).json({ success: false, message: 'Executive not found.' });
    }

    res.json({ success: true, message: 'Executive updated successfully.', executive });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Delete executive
router.delete('/executives/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const executive = await Executive.findByIdAndDelete(req.params.id);

    if (!executive) {
      return res.status(404).json({ success: false, message: 'Executive not found.' });
    }

    res.json({ success: true, message: 'Executive deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Ban/Unban executive
router.put('/executives/:id/ban', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { isBanned, banReason } = req.body;

    const executive = await Executive.findByIdAndUpdate(
      req.params.id,
      {
        isBanned: isBanned !== undefined ? isBanned : undefined,
        banReason: banReason || '',
        bannedBy: req.user.id,
        bannedAt: isBanned ? new Date() : null,
      },
      { new: true }
    ).select('-password');

    if (!executive) {
      return res.status(404).json({ success: false, message: 'Executive not found.' });
    }

    res.json({ success: true, message: 'Executive ban status updated.', executive });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// ==================== MANUFACTURER MANAGEMENT ====================

// Get all manufacturers
router.get('/manufacturers', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { query, sort, skip, limit, meta } = buildListQuery(req.query, {
      fields: ['name', 'email', 'companyName', 'manufacturerId', 'gstNumber', 'panNumber', 'website'],
      statuses: {
        active: { isActive: true, isBanned: { $ne: true } },
        inactive: { isActive: false },
        banned: { isBanned: true },
        pending_verification: { 'onboarding.state': 'pending_verification' },
        pending_otp: { 'onboarding.state': 'pending_otp' },
        update_requested: { 'onboarding.state': 'update_requested' },
        confirmed: { 'onboarding.state': 'active' },
      },
      statusField: '_mapped',
      sortable: { createdAt: { createdAt: -1 }, name: { name: 1 }, company: { companyName: 1 } },
    });
    const manufacturers = await Manufacturer.find(query).select('-password').sort(sort).skip(skip).limit(limit);
    const total = await Manufacturer.countDocuments(query);
    return listResponse(res, 'data', manufacturers, total, meta);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Create manufacturer
router.post('/manufacturers', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, email, password, phone, companyName, gstNumber, panNumber, address, bank, brands } = req.body;

    /*
     * A manufacturer can be paid, invoiced and audited only as far as its
     * KYC is complete, and everything downstream (brand claims, price
     * approvals, listing decisions) acts on this identity. The desk entry used
     * to accept four fields and flip the account live. Now: the whole record
     * is checked against one completeness table (services/manufacturerOnboarding),
     * and creation produces a PENDING invitation, not a trading partner -
     * the company owns the confirmation via the emailed link, and activation
     * finishes only after their OTP. `brandClash` rules are unchanged.
     */
    {
      const { validateManufacturerKyc, normaliseKycStrings } = await import('../services/manufacturerOnboarding.js');
      const draft = { name, companyName, email, phone, gstNumber, panNumber, address, bank, brands };
      normaliseKycStrings(draft);
      const kycErrors = validateManufacturerKyc(draft);
      if (!password || String(password).length < 8) {
        kycErrors.push({
          field: 'password',
          message: 'A sign-in password of at least 8 characters must be set for the manufacturer.',
        });
      }
      if (kycErrors.length) {
        return res.status(400).json({ success: false, message: 'Manufacturer record incomplete.', errors: kycErrors });
      }
    }

    const existingManufacturer = await Manufacturer.findOne({ email });
    if (existingManufacturer) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }
    /*
     * A brand name may belong to one manufacturer only, so the desk cannot create
     * that clash either - and the admin path is exactly where it would be created
     * in good faith, when adding a second company that happens to trade under a
     * name already recorded. Catching it at the write is what makes the storefront
     * rails safe to group by brand name at all.
     */
    try {
      const list = Array.isArray(brands) ? brands : [];
      const clash = await validateBrandListOwnership(list, null);
      if (clash.clashes.length) {
        return res.status(400).json({
          success: false,
          message: 'One brand name can belong to only one manufacturer.',
          errors: clash.clashes.map((c) => ({ field: 'brands', message: clashMessage(c) })),
        });
      }
    } catch (brandCheckErr) {
      console.error('Brand ownership check failed on manufacturer create:', brandCheckErr);
      return res
        .status(500)
        .json({ success: false, message: 'Brand ownership could not be verified. Nothing was created.' });
    }

    /*
     * brands must be a flat list of strings before it reaches mongoose: a
     * nested or object member used to surface as a 500 spilling validator
     * internals. Coerce or refuse, never leak.
     */
    const brandList = Array.isArray(brands) ? brands : [];
    if (brandList.some((b) => typeof b !== 'string' || !b.trim())) {
      return res.status(400).json({ success: false, message: 'brands must be a flat list of names.' });
    }

    const manufacturer = new Manufacturer({
      name,
      email,
      password,
      phone,
      companyName,
      gstNumber,
      panNumber,
      address,
      bank,
      brands: brandList,
      createdBy: req.user.id,
    });

    await manufacturer.save();

    /*
     * The confirmation mail (and its state) are part of creating the record;
     * a create that could not even attempt delivery says so in the response -
     * the desk must know the company was never given a way to answer.
     */
    const { issueVerificationMail } = await import('../services/manufacturerOnboarding.js');
    const mail = await issueVerificationMail({ m: manufacturer });

    res.status(201).json({
      success: true,
      message:
        'Manufacturer recorded as PENDING VERIFICATION. A confirmation mail went out; the account activates only after the company clicks Verify and completes the OTP' +
        (mail.devToken ? ' (this box has no SMTP; the invitation token is returned for local use).' : '.'),
      manufacturer: manufacturer.toJSON(),
      onboarding: { state: 'pending_verification', mail },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/*
 * Manufacturer onboarding desk: the companies' own "update info" proposals
 * (listUpdateRequests) and the deliberate re-creation that applies them and
 * re-sends the confirmation. Re-create is a POST to the resource it recreates
 * - it must never look like a blind PUT over live records.
 */
router.get('/manufacturer-update-requests', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { listUpdateRequests } = await import('../services/manufacturerOnboarding.js');
    res.json({ success: true, data: await listUpdateRequests() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while listing update requests.' });
  }
});

router.post('/manufacturers/:id/recreate-invitation', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { recreateWithCorrections } = await import('../services/manufacturerOnboarding.js');
    const target = await Manufacturer.findById(req.params.id).select('-password -activationOtp');
    if (!target) return res.status(404).json({ success: false, message: 'Manufacturer not found.' });
    const result = await recreateWithCorrections(target, req.app.get('io'));
    if (!result.ok) {
      return res
        .status(result.errors ? 400 : 409)
        .json({ success: false, message: result.message || 'Rejected.', errors: result.errors });
    }
    res.json({ success: true, message: 'Corrections applied and a fresh confirmation mail sent.', ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during re-create.', error: error.message });
  }
});

/*
 * Re-send the confirmation link for a still-unconfirmed record - for example
 * after the company says the mail never came (check `mailNote` first: a box
 * with an unconfigured SMTP says so HERE instead of the invite dying silently.
 */
router.post('/manufacturers/:id/resend-confirmation', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { issueVerificationMail, onboardingStateOf } = await import('../services/manufacturerOnboarding.js');
    const target = await Manufacturer.findById(req.params.id).select('-password -activationOtp');
    if (!target) return res.status(404).json({ success: false, message: 'Manufacturer not found.' });
    if (onboardingStateOf(target) === 'active') {
      return res
        .status(409)
        .json({ success: false, message: 'This manufacturer is already confirmed and active; nothing to re-send.' });
    }
    const mail = await issueVerificationMail({ m: target });
    res.json({
      success: true,
      message: mail.delivered
        ? 'A fresh confirmation mail is on its way.'
        : mail.devToken
          ? 'No SMTP configured here; the fresh token is returned in `devToken` for local use only.'
          : 'The mail could not be sent on this server; the record stays pending until email is configured.',
      mail,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/*
 * Request metrics, for the people who operate the box. `middleware/
 * requestContext.js` has counted every response since the day it shipped but
 * nothing could read it; operators were left blind to exactly the thing the
 * file logs at them - 5xx trends, the slowest endpoints at a glance, and the
 * last error surfaced with its request id (which is how a support ticket
 * reading "failed for id req_..." becomes a lookup instead of a guess).
 * In-memory and monotonic - a restart resets it and the sentence says so.
 */
/*
 * Security event glance (recommendation #6 monitoring surface).
 * Newest-first ring from services/securityEvents: guard drops, revoked-token
 * use, bad webhook signatures, throttled auth attempts, PHI refusals. Read
 * this from the ops dashboard or a poller; alert on `counts` growth over a
 * scrape window. Durable alerting belongs to the log pipeline (see
 * PRODUCTION-CHECKLIST.md), this endpoint is the live signal.
 */
router.get('/system/security-events', verifyToken, verifyAdmin, async (req, res) => {
  const { securityEvents } = await import('../services/securityEvents.js');
  res.json({ success: true, ...securityEvents() });
});

router.get('/system/metrics', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { metrics, recentErrors } = await import('../middleware/requestContext.js');
    const topSlow = [...(metrics.slowest || [])].sort((a, b) => b.ms - a.ms).slice(0, 12);
    res.json({
      success: true,
      metrics: {
        startedAt: metrics.startedAt,
        uptimeSeconds: Math.round((Date.now() - new Date(metrics.startedAt).getTime()) / 1000),
        requests: metrics.requests,
        byStatusClass: metrics.byStatusClass,
        errorRatio5xx: metrics.requests
          ? Number(((metrics.byStatusClass['5xx'] || 0) / metrics.requests).toFixed(4))
          : 0,
        busiestRoutes: [...(metrics.byRoute || new Map())]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([route, count]) => ({ route, count })),
        slowestCalls: topSlow,
        lastError: metrics.lastError,
        recentErrors, // bounded to `cap` newest-first; see requestContext header for why in-memory is the right size of true
        /*
         * CSP observations (ring-buffered per directive) ride the same panel
         * as every other in-process fact: this is the number an operator
         * watches to decide whether report-mode can become enforce-mode, and
         * it is printed on every read rather than stored elsewhere so a
         * restart clearing it can never pretend it persisted.
         */
        cspMode: process.env.CSP_MODE || 'off',
        cspViolations: (await import('../middleware/securityCsp.js')).cspViolationsSnapshot(),
        note: 'Counters, violations and the recent-errors window live in this process and reset on deploy; that is by design, not an outage (see middleware/requestContext.js). The durable answer is metrics export, not a lying counter.',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error reading metrics.' });
  }
});

/*
 * Desk override: mark an onboarding as confirmed without the company's
 * email cycle - for migrating a manufacturer that completed verification
 * through other means (or an e2e harness that needs a second real tenant
 * but has no mailbox to click). This is deliberately loud: it requires a
 * reason, it stamps who did it, and it notifies the admin pool so an
 * override is never the quiet path around KYC.
 */
router.post('/manufacturers/:id/force-activate', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 8) {
      return res
        .status(400)
        .json({ success: false, message: 'A recorded reason (8+ chars) is required to override confirmation.' });
    }
    const { onboardingStateOf } = await import('../services/manufacturerOnboarding.js');
    const target = await Manufacturer.findById(req.params.id).select('-password');
    if (!target) return res.status(404).json({ success: false, message: 'Manufacturer not found.' });
    const { validateManufacturerKyc } = await import('../services/manufacturerOnboarding.js');
    const kycErrors = validateManufacturerKyc(target);
    if (kycErrors.length && !(req.body && req.body.allowIncompleteKyc === true)) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot activate an incomplete record; fix KYC first (or pass allowIncompleteKyc with an auditor-approved exception).',
        errors: kycErrors,
      });
    }
    await Manufacturer.updateOne(
      { _id: target._id },
      {
        'onboarding.state': 'active',
        'onboarding.activatedAt': new Date(),
        'onboarding.override': {
          by: req.user.id || req.user._id,
          at: new Date(),
          reason,
          incompleteKyc: Boolean(req.body?.allowIncompleteKyc),
        },
        isActive: true,
        activationOtp: null,
        'onboarding.verifyTokenHash': null,
      }
    );
    const { notifyAdmins } = await import('../services/notifications.js');
    await notifyAdmins({
      title: 'Manufacturer confirmation overridden',
      message: `${target.companyName} (${target.email}) was activated without the email cycle by ${req.user.email}: "${reason.slice(0, 140)}"`,
      type: 'system',
      data: { kind: 'manufacturer-override', manufacturerId: String(target._id), reason },
    }).catch(() => {});
    res.json({ success: true, message: 'Activated by desk override; admins were notified.', state: 'active' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Update manufacturer
router.put('/manufacturers/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, phone, companyName, address, brands, isActive } = req.body;

    const manufacturer = await Manufacturer.findByIdAndUpdate(
      req.params.id,
      { name, phone, companyName, address, brands, isActive },
      { new: true }
    ).select('-password');

    if (!manufacturer) {
      return res.status(404).json({ success: false, message: 'Manufacturer not found.' });
    }

    res.json({ success: true, message: 'Manufacturer updated successfully.', manufacturer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Delete manufacturer
router.delete('/manufacturers/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const manufacturer = await Manufacturer.findByIdAndDelete(req.params.id);

    if (!manufacturer) {
      return res.status(404).json({ success: false, message: 'Manufacturer not found.' });
    }

    // Optionally delete all products by this manufacturer
    await Product.deleteMany({ manufacturer: req.params.id });

    res.json({ success: true, message: 'Manufacturer deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Ban/Unban manufacturer
router.put('/manufacturers/:id/ban', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { isBanned, banReason } = req.body;

    const manufacturer = await Manufacturer.findByIdAndUpdate(
      req.params.id,
      {
        isBanned: isBanned !== undefined ? isBanned : undefined,
        banReason: banReason || '',
        bannedBy: req.user.id,
        bannedAt: isBanned ? new Date() : null,
      },
      { new: true }
    ).select('-password');

    if (!manufacturer) {
      return res.status(404).json({ success: false, message: 'Manufacturer not found.' });
    }

    res.json({ success: true, message: 'Manufacturer ban status updated.', manufacturer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get manufacturer products
router.get('/manufacturers/:id/products', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const products = await Product.find({ manufacturer: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get manufacturer sellers
router.get('/manufacturers/:id/sellers', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const sellers = await ManufacturerSeller.find({ manufacturer: req.params.id })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: sellers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get commissions data
router.get('/commissions', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const commissions = await Order.find({
      paymentStatus: 'completed',
      orderStatus: { $ne: 'cancelled' },
    })
      .populate('seller', 'storeName name email')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .select(
        'orderNumber seller subtotal commissionPercentage commissionAmount sellerPayoutAmount commissionPaid commissionPaidAt createdAt'
      );

    res.json({ success: true, data: commissions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/*
 * Cash collected on delivery, reconciled.
 *
 * A cash order is money moving through somebody's hands. Until the amount was
 * recorded when the pickup was confirmed, the platform could tell that a cash
 * order had been paid but not how much was in the envelope - so the only
 * reconciliation available was trust. This is the arithmetic instead: what
 * should have been taken across delivered cash orders in the window, what was
 * actually recorded, the difference as its own number, and the cash-handling
 * charges separated from merchandise, because the ₹39 is the platform's and
 * mixing it into seller figures is how a payout dispute begins.
 *
 * Grouped by partner, so a shift closes against a person rather than a total,
 * and sorted by largest difference first, because that is where asking starts.
 */
router.get('/cash-reconciliation', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 86400000);

    const cashOrders = await Order.find({
      paymentMethod: 'cod',
      orderStatus: 'delivered',
      deliveredAt: { $gte: since },
    })
      .select(
        'orderNumber totalAmount codFee cashCollected cashCollectedAt cashCollectedBy deliveredAt assignedDeliveryPartner seller'
      )
      .lean();

    const due = cashOrders.reduce((n, o) => n + (Number(o.totalAmount) || 0), 0);
    const recorded = cashOrders.reduce((n, o) => n + (Number(o.cashCollected) || 0), 0);
    const handling = cashOrders.reduce((n, o) => n + (Number(o.codFee) || 0), 0);
    const unrecorded = cashOrders.filter((o) => !(Number(o.cashCollected) || 0));

    const byPartner = new Map();
    for (const o of cashOrders) {
      const key = o.assignedDeliveryPartner ? String(o.assignedDeliveryPartner) : o.cashCollectedBy || 'unassigned';
      const row = byPartner.get(key) || { who: key, orders: 0, due: 0, recorded: 0, handling: 0 };
      row.orders += 1;
      row.due += Number(o.totalAmount) || 0;
      row.recorded += Number(o.cashCollected) || 0;
      row.handling += Number(o.codFee) || 0;
      byPartner.set(key, row);
    }

    res.json({
      success: true,
      windowDays: days,
      totals: {
        orders: cashOrders.length,
        due: Math.round(due * 100) / 100,
        recorded: Math.round(recorded * 100) / 100,
        // Anything other than zero here is a person or an order to go and ask.
        discrepancy: Math.round((due - recorded) * 100) / 100,
        cashHandlingCharges: Math.round(handling * 100) / 100,
        merchandise: Math.round((due - handling) * 100) / 100,
      },
      unrecorded: {
        count: unrecorded.length,
        orders: unrecorded.slice(0, 25).map((o) => ({
          orderNumber: o.orderNumber,
          totalAmount: o.totalAmount,
          deliveredAt: o.deliveredAt,
        })),
      },
      byPartner: [...byPartner.values()]
        .map((r) => ({
          ...r,
          due: Math.round(r.due * 100) / 100,
          recorded: Math.round(r.recorded * 100) / 100,
          handling: Math.round(r.handling * 100) / 100,
          difference: Math.round((r.due - r.recorded) * 100) / 100,
        }))
        .sort((a, b) => b.difference - a.difference),
    });
  } catch (error) {
    console.error('Cash reconciliation error:', error);
    res.status(500).json({ success: false, message: 'Could not reconcile the cash.' });
  }
});

export default router;
