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
      validUntil: { $gte: new Date() },
    }).sort({ createdAt: -1 });

    res.json({ success: true, coupons });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/validate', verifyToken, async (req, res) => {
  try {
    const { code, items } = req.body;
    // The discount maths needs a real number; a missing amount must never
    // silently produce NaN prices.
    const orderAmount = Number(req.body.orderAmount);
    if (!Number.isFinite(orderAmount) || orderAmount < 0) {
      return res.status(400).json({ success: false, message: 'A valid order amount is required to apply a coupon.' });
    }

    if (!code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required.' });
    }

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
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

    const alreadyUsed = coupon.usedBy.some((u) => u.user.toString() === req.user._id.toString());
    if (alreadyUsed) {
      return res.status(400).json({ success: false, message: 'Coupon already used by you.' });
    }

    if (
      !coupon.applicableCategories?.length &&
      !coupon.applicableBrands?.length &&
      coupon.minOrderAmount > 0 &&
      orderAmount < coupon.minOrderAmount
    ) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required.`,
      });
    }

    /*
     * Scope + base are decided by the SAME module the checkout applies (it
     * prices against the in-scope lines only). Validate without a cart, on a
     * scoped voucher, can only guess; guessing in the customer's favour is how
     * a rejected-at-checkout code gets promised in the UI, so the answer here
     * is the honest 'needs the cart to quote', and unscoped codes keep their
     * historical orderAmount-only behaviour untouched.
     */
    const scoped = coupon.applicableCategories?.length || coupon.applicableBrands?.length ? coupon : null;
    let discount = 0;
    let scopeNote = '';
    if (scoped) {
      const lines = Array.isArray(items) ? items : [];
      if (!lines.length) {
        return res.status(400).json({
          success: false,
          message: 'This coupon has category/brand limits; send the cart lines so it can be quoted honestly.',
          needsCart: true,
        });
      }
      const Product = (await import('../models/Product.js')).default;
      const ids = [...new Set(lines.map((l) => String(l.product || l.productId || l)).filter(Boolean))];
      const docs = await Product.find({ _id: { $in: ids } })
        .select('category brand price')
        .lean();
      const byId = new Map(docs.map((d) => [String(d._id), d]));
      const cartLines = lines.map((l) => {
        const d = byId.get(String(l.product || l.productId || l)) || {};
        const qty = Math.max(1, Number(l.quantity || 1));
        const amount = Number(l.amount ?? Number(d.price || 0) * qty);
        return { category: d.category, brand: d.brand, amount };
      });
      const { couponScopeResult, couponDiscountFor } = await import('../services/couponScope.js');
      const scope = couponScopeResult(scoped, cartLines, orderAmount);
      if (!scope.eligible) return res.status(400).json({ success: false, message: scope.reason });
      if (coupon.minOrderAmount > 0 && scope.base < coupon.minOrderAmount) {
        return res.status(400).json({
          success: false,
          message: `Minimum order amount of ₹${coupon.minOrderAmount} required in ${scope.scopeLabel} - this cart has ₹${Math.round(scope.base)} eligible.`,
        });
      }
      const d = couponDiscountFor(scoped, scope);
      if (!d.ok) return res.status(400).json({ success: false, message: d.reason });
      discount = d.discount;
      scopeNote = `Applies to ${scope.scopeLabel}; quoted on the matching items only.`;
    } else if (coupon.discountType === 'percentage') {
      discount = (orderAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) discount = coupon.maxDiscount;
    } else {
      discount = coupon.discountValue;
    }

    res.json({
      success: true,
      message: 'Coupon applied successfully.',
      note: scopeNote || undefined,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discount: Math.round(discount),
        applicableCategories: coupon.applicableCategories || [],
        applicableBrands: coupon.applicableBrands || [],
      },
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/', verifyToken, verifyAdmin, couponValidation, async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      validFrom,
      validUntil,
      usageLimit,
      applicableCategories,
      applicableBrands,
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
      applicableCategories: applicableCategories || [],
      applicableBrands: applicableBrands || [],
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully.',
      coupon,
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Kit table like every other console list; plain page/limit still works.
    // Status chips are computed server-side from the real clock so the ledger
    // screen and the redemption door agree on what 'expired' means.
    const { buildListQuery, listResponse } = await import('../services/adminQuery.js');
    const nowD = new Date();
    const { query, sort, skip, limit, meta } = buildListQuery(req.query, {
      base: {},
      fields: ['code', 'description'],
      statuses: {
        active: { isActive: true, validFrom: { $lte: nowD }, validUntil: { $gte: nowD } },
        inactive: { isActive: false },
        expired: { validUntil: { $lt: nowD } },
        upcoming: { validFrom: { $gt: nowD } },
        demo: { dataOrigin: 'demo' },
        live: { dataOrigin: 'live' },
      },
      statusField: '_mapped',
      dateField: 'createdAt',
      sortable: { newest: { createdAt: -1 }, code: { code: 1 }, used: { usageCount: -1 } },
    });
    const coupons = await Coupon.find(query).sort(sort).skip(skip).limit(limit);
    const total = await Coupon.countDocuments(query);
    return listResponse(res, 'coupons', coupons, total, meta);
  } catch (error) {
    console.error('Get all coupons error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
