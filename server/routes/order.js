import express from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import Coupon from '../models/Coupon.js';
import { verifyToken } from '../middleware/auth.js';
import { deductStockForOrder, restoreStockForOrder, matchVariant } from '../services/stockMovement.js';
import { startRouting } from '../services/orderProximity.js';
import { orderValidation } from '../middleware/validate.js';
import { sendOrderConfirmation, sendOrderStatusNotification } from '../services/email.js';

const router = express.Router();

// Rs. 59 per product line on platform-run deliveries.
const SELF_DELIVERY_FEE_PER_ITEM = 59;

router.post('/', verifyToken, orderValidation, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, couponCode, prescription } = req.body;
    const userId = req.user._id;

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

      // Price and availability come from the exact colour/size the buyer chose,
      // not just the product-level defaults.
      const chosenVariant = matchVariant(product, item.variant || {});
      const available = chosenVariant
        ? (chosenVariant.stock || 0)
        : (product.stock || 0);

      if (available < item.quantity) {
        const which = chosenVariant
          ? ` (${[chosenVariant.color, chosenVariant.size].filter(Boolean).join(' / ')})`
          : '';
        return res.status(400).json({ success: false, message: `Insufficient stock for "${product.title}"${which}. Only ${available} available.` });
      }

      const variantPrice = chosenVariant ? (chosenVariant.discountedPrice || chosenVariant.price) : null;
      const price = variantPrice || product.discountedPrice || product.price;
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
      // Charged to the customer up front for every order. If the platform ends up
      // delivering it (instead of Shiprocket) a further flat Rs. 59 per product
      // line is added, billed alongside the miscellaneous charges; that choice is
      // only known once routing completes, so it is stored as a quote and applied
      // by the delivery-fee recalculation at pickup time.
      const sellerSelfDeliveryCharge = 0;

      let sellerCouponDiscount = 0;
      if (couponDiscount > 0) {
        sellerCouponDiscount = Math.round((couponDiscount * sellerSubtotal) / subtotal);
      }

      const sellerTotal = sellerSubtotal + sellerDeliveryCharge + sellerPlatformFee + sellerSelfDeliveryCharge - sellerCouponDiscount;

      // Calculate commission (3% of subtotal after discounts)
      const commissionPercentage = 3;
      const commissionBase = sellerSubtotal - sellerCouponDiscount;
      const commissionAmount = Math.round(commissionBase * (commissionPercentage / 100));
      const sellerPayoutAmount = commissionBase - commissionAmount;

      const order = new Order({
        user: userId,
        seller: sellerId,
        items: sellerItemsList,
        shippingAddress,
        subtotal: sellerSubtotal,
        deliveryCharge: sellerDeliveryCharge,
        platformFee: sellerPlatformFee,
        selfDeliveryCharge: sellerSelfDeliveryCharge,
        totalAmount: sellerTotal,
        paymentMethod: paymentMethod || 'razorpay',
        paymentStatus: 'pending',
        orderStatus: 'pending',
        couponApplied: couponCode ? couponCode.toUpperCase() : undefined,
        couponDiscount: sellerCouponDiscount,
        prescription,
        // Commission tracking
        commissionPercentage,
        commissionAmount,
        sellerPayoutAmount,
        commissionPaid: false
      });

      await order.save();
      orders.push(order);

      // Deduct the exact colour/size the buyer chose for this seller's stock.
      const report = await deductStockForOrder(order, req.app.get('io'));
      if (report.shortages.length) {
        // Roll the whole checkout back rather than overselling.
        await Promise.all(orders.map((o) => Order.updateOne({ _id: o._id }, { orderStatus: 'cancelled', cancellationReason: 'Stock unavailable at checkout' })));
        await Promise.all(orders.map((o) => restoreStockForOrder(o, req.app.get('io'), { reason: 'checkout-rollback' })));
        return res.status(409).json({
          success: false,
          message: 'Some items sold out while you were checking out. Please review your cart.'
        });
      }
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

    // Hand each order to proximity routing: up to five nearby sellers who stock
    // the exact configuration are offered it in turn. If nobody is nearby the
    // order lands in the admin queue instead.
    try {
      for (const placed of orders) {
        await startRouting(placed, req.app.get('io'));
      }
    } catch (routeErr) {
      // Routing failure must never lose a placed order.
      console.error('Order routing skipped:', routeErr.message);
    }

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
    // Only money actually collected can be refunded; unpaid COD was never paid.
    if (order.paymentStatus === 'completed') {
      order.paymentStatus = 'refunded';
    }

    await order.save();

    // Return the goods to the exact colour/size they came from.
    await restoreStockForOrder(order, req.app.get('io'), { reason: 'cancellation' });


    try {
      const withBuyer = await Order.findById(order._id).populate('user', 'email name');
      if (withBuyer?.user?.email) {
        await sendOrderStatusNotification(withBuyer.user.email, withBuyer, 'cancelled');
      }
    } catch (mailErr) {
      console.error('Cancellation email skipped:', mailErr.message);
    }
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


    try {
      const withBuyer = await Order.findById(order._id).populate('user', 'email name');
      if (withBuyer?.user?.email) {
        await sendOrderStatusNotification(withBuyer.user.email, withBuyer, 'return_requested');
      }
    } catch (mailErr) {
      console.error('Return email skipped:', mailErr.message);
    }
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
