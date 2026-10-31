import express from 'express';
import Order from '../models/Order.js';
import Seller from '../models/Seller.js';
import { verifyToken, verifySeller } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';
import { createOrder, verifyOrder } from '../services/razorpay.js';

const router = express.Router();

/**
 * POST /api/payment/create-order
 * Create a Razorpay order for user payments
 */
router.post('/create-order', verifyToken, paymentLimiter, async (req, res) => {
  try {
    const { amount, receipt } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });
    }

    const razorpayOrder = await createOrder(amount, 'INR', receipt);

    if (!razorpayOrder.success) {
      return res.status(500).json({ success: false, message: 'Failed to create payment order.', error: razorpayOrder.error });
    }

    res.json({
      success: true,
      orderId: razorpayOrder.orderId,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/**
 * POST /api/payment/verify
 * Verify Razorpay payment and update order status
 */
router.post('/verify', verifyToken, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId, orderIds } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Payment verification details are required.' });
    }

    const verification = verifyOrder(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!verification.verified) {
      return res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }

    // Which orders does this payment settle? A single checkout is split into
    // one order per seller, so the caller can pass a list. Marking *every*
    // pending order the user happens to have would let one payment silently
    // pay off unrelated unpaid orders, so an explicit reference is required.
    const targetIds = []
      .concat(orderId || [])
      .concat(Array.isArray(orderIds) ? orderIds : []);

    if (targetIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No order reference supplied with this payment.'
      });
    }

    const settled = [];
    for (const id of targetIds) {
      // Only this user's own unpaid orders can be settled.
      const order = await Order.findOne({ _id: id, user: req.user._id });
      if (!order) continue;
      order.paymentStatus = 'completed';
      order.paymentId = razorpayPaymentId;
      order.orderStatus = order.orderStatus === 'pending' ? 'confirmed' : order.orderStatus;
      await order.save();
      settled.push(order.orderNumber);
    }

    if (settled.length === 0) {
      return res.status(400).json({ success: false, message: 'No matching orders were found for this payment.' });
    }

    res.json({
      success: true,
      message: 'Payment verified successfully.'
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/**
 * POST /api/payment/webhook
 * Razorpay webhook handler
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    const crypto = await import('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    switch (event) {
      case 'payment.captured':
        console.log('Payment captured:', payload.payment?.entity?.id);
        break;
      case 'payment.failed':
        console.log('Payment failed:', payload.payment?.entity?.id);
        break;
      default:
        console.log('Unhandled webhook event:', event);
    }

    res.json({ success: true, message: 'Webhook processed.' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing error.', error: error.message });
  }
});

export default router;
