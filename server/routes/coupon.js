import express from 'express';
import Coupon from '../models/Coupon.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';
import { couponValidation } from '../middleware/validate.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    }).sort({ createdAt: -1 });

    res.json({ success: true, coupons });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/validate', verifyToken, async (req, res) => {
  try {
    const { code, orderAmount } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required.' });
    }

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true
    });

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }

    const now = new Date();
    if (now < coupon.validFrom) {
      return res.status(400).json({ success: false, message: 'Coupon is not yet active.' });
    }

    if (now > coupon.validUntil) {
      return res.status(400).json({ success: false, message: 'Coupon has expired.' });
    }

    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached.' });
    }

    const alreadyUsed = coupon.usedBy.some(
      u => u.user.toString() === req.user._id.toString()
    );
    if (alreadyUsed) {
      return res.status(400).json({ success: false, message: 'Coupon already used by you.' });
    }

    if (coupon.minOrderAmount > 0 && orderAmount < coupon.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required.`
      });
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (orderAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = coupon.discountValue;
    }

    res.json({
      success: true,
      message: 'Coupon applied successfully.',
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discount: Math.round(discount)
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/', verifyToken, verifyAdmin, couponValidation, async (req, res) => {
  try {
    const {
      code, description, discountType, discountValue, minOrderAmount,
      maxDiscount, validFrom, validUntil, usageLimit, applicableCategories
    } = req.body;

    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists.' });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      minOrderAmount: minOrderAmount || 0,
      maxDiscount,
      validFrom,
      validUntil,
      usageLimit: usageLimit || 0,
      applicableCategories: applicableCategories || []
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully.',
      coupon
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const coupons = await Coupon.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Coupon.countDocuments();

    res.json({
      success: true,
      coupons,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all coupons error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
