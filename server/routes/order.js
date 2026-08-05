import express from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import Coupon from '../models/Coupon.js';
import { verifyToken } from '../middleware/auth.js';
import { orderValidation } from '../middleware/validate.js';
import { sendOrderConfirmation } from '../services/email.js';

const router = express.Router();

router.post('/', verifyToken, orderValidation, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, couponCode, prescription } = req.body;
    const userId = req.user._id;

    const productDetails = [];
    let subtotal = 0;
    const sellerItems = {};

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({ success: false, message: `Product ${item.product} not found.` });
      }

      if (!product.isActive) {
        return res.status(400).json({ success: false, message: `Product "${product.title}" is no longer available.` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for "${product.title}".` });
      }

      const price = product.discountedPrice || product.price;
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      const sellerId = product.seller.toString();
      if (!sellerItems[sellerId]) {
        sellerItems[sellerId] = [];
      }
      sellerItems[sellerId].push({
        product: product._id,
        variant: item.variant || {},
        quantity: item.quantity,
        price
      });

      productDetails.push({ product, quantity: item.quantity });
    }

    let couponDiscount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
      });

      if (!coupon) {
        return res.status(400).json({ success: false, message: 'Invalid or expired coupon.' });
      }

      if (coupon.minOrderAmount > 0 && subtotal < coupon.minOrderAmount) {
        return res.status(400).json({ success: false, message: `Minimum order amount of ₹${coupon.minOrderAmount} required.` });
      }

      if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
        return res.status(400).json({ success: false, message: 'Coupon usage limit reached.' });
      }

      const alreadyUsed = coupon.usedBy.some(u => u.user.toString() === userId.toString());
      if (alreadyUsed) {
        return res.status(400).json({ success: false, message: 'Coupon already used by you.' });
      }

      if (coupon.discountType === 'percentage') {
        couponDiscount = (subtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
          couponDiscount = coupon.maxDiscount;
        }
      } else {
        couponDiscount = coupon.discountValue;
      }
    }

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const deliveryCharge = totalItems * 16;
    const platformFee = Math.round(subtotal * 0.02);
    const totalAmount = subtotal + deliveryCharge + platformFee - couponDiscount;

    const orders = [];

    for (const [sellerId, sellerItemsList] of Object.entries(sellerItems)) {
      const sellerSubtotal = sellerItemsList.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const sellerItemCount = sellerItemsList.reduce((sum, item) => sum + item.quantity, 0);
      const sellerDeliveryCharge = sellerItemCount * 16;
      const sellerPlatformFee = Math.round(sellerSubtotal * 0.02);

      let sellerCouponDiscount = 0;
      if (couponDiscount > 0) {
        sellerCouponDiscount = Math.round((couponDiscount * sellerSubtotal) / subtotal);
      }

      const sellerTotal = sellerSubtotal + sellerDeliveryCharge + sellerPlatformFee - sellerCouponDiscount;

      const order = new Order({
        user: userId,
        seller: sellerId,
        items: sellerItemsList,
        shippingAddress,
        subtotal: sellerSubtotal,
        deliveryCharge: sellerDeliveryCharge,
        platformFee: sellerPlatformFee,
        totalAmount: sellerTotal,
        paymentMethod: paymentMethod || 'razorpay',
        paymentStatus: 'pending',
        orderStatus: 'pending',
        couponApplied: couponCode ? couponCode.toUpperCase() : undefined,
        couponDiscount: sellerCouponDiscount,
        prescription
      });

      await order.save();
      orders.push(order);
    }

    for (const { product, quantity } of productDetails) {
      product.stock -= quantity;
      await product.save();
    }

    if (couponCode && couponDiscount > 0) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      if (coupon) {
        coupon.usedBy.push({
          user: userId,
          orderId: orders[0]._id,
          usedAt: new Date()
        });
        coupon.usageCount += 1;
        await coupon.save();
      }
    }

    await Cart.findOneAndUpdate(
      { user: userId },
      { items: [], totalItems: 0 }
    );

    await sendOrderConfirmation(req.user.email, orders[0]);

    res.status(201).json({
      success: true,
      message: 'Order(s) created successfully.',
      orders
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const userId = req.user._id;

    const query = { user: userId };
    if (status) query.orderStatus = status;

    const orders = await Order.find(query)
      .populate('items.product', 'title images price')
      .populate('seller', 'storeName storeLogo')
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

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    })
      .populate('items.product', 'title images price brand')
      .populate('seller', 'storeName storeLogo')
      .populate('user', 'name email phone');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const cancellableStatuses = ['pending', 'confirmed'];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage.' });
    }

    order.orderStatus = 'cancelled';
    order.cancellationReason = reason || 'Cancelled by user';
    order.paymentStatus = 'refunded';

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    await order.save();

    res.json({
      success: true,
      message: 'Order cancelled successfully.',
      order
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/:id/return', verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Return can only be requested for delivered orders.' });
    }

    if (order.orderStatus === 'return_requested' || order.orderStatus === 'returned') {
      return res.status(400).json({ success: false, message: 'Return already requested for this order.' });
    }

    const deliveryDays = (new Date() - order.deliveryDate) / (1000 * 60 * 60 * 24);
    if (deliveryDays > 7) {
      return res.status(400).json({ success: false, message: 'Return window of 7 days has expired.' });
    }

    order.orderStatus = 'return_requested';
    order.returnReason = reason || 'Return requested by user';
    await order.save();

    res.json({
      success: true,
      message: 'Return request submitted successfully.',
      order
    });
  } catch (error) {
    console.error('Return order error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/:id/review', verifyToken, async (req, res) => {
  try {
    const { rating, review, productId } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    }

    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Can only review delivered orders.' });
    }

    const targetProductId = productId || order.items[0]?.product;
    const product = await Product.findById(targetProductId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const existingReview = product.ratings.find(r => r.user.toString() === req.user._id.toString());
    if (existingReview) {
      existingReview.rating = rating;
      existingReview.review = review || '';
      existingReview.createdAt = new Date();
    } else {
      product.ratings.push({
        user: req.user._id,
        rating,
        review: review || '',
        createdAt: new Date()
      });
      product.totalReviews = (product.totalReviews || 0) + 1;
    }

    const totalRating = product.ratings.reduce((sum, r) => sum + r.rating, 0);
    product.totalRatings = product.ratings.length;
    
    await product.save();

    res.json({ success: true, message: existingReview ? 'Review updated.' : 'Review submitted.', product: { totalRatings: product.totalRatings, totalReviews: product.totalReviews } });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
