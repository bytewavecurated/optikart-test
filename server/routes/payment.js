import express from 'express';
import Order from '../models/Order.js';
import Seller from '../models/Seller.js';
import { verifyToken, verifySeller } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

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

router.post('/verify', verifyToken, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Payment verification details are required.' });
    }

    const verification = verifyOrder(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!verification.verified) {
      return res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }

    if (orderId) {
      const order = await Order.findById(orderId);
      if (order) {
        order.paymentStatus = 'completed';
        order.paymentId = razorpayPaymentId;
        order.orderStatus = 'confirmed';
        await order.save();
      }
    } else {
      const orders = await Order.find({
        user: req.user._id,
        paymentStatus: 'pending'
      }).sort({ createdAt: -1 });

      for (const order of orders) {
        order.paymentStatus = 'completed';
        order.paymentId = razorpayPaymentId;
        order.orderStatus = 'confirmed';
        await order.save();
      }
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

  try {
    const sellerId = req.seller._id;
    const totalAmount = 590;

    const razorpayOrder = await createOrder(totalAmount, 'INR', `seller_sub_${sellerId}_${Date.now()}`);

    if (!razorpayOrder.success) {
    }

    res.json({
      success: true,
      orderId: razorpayOrder.orderId,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const sellerId = req.seller._id;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Payment verification details are required.' });
    }

    const verification = verifyOrder(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!verification.verified) {
      return res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }

      seller: sellerId,
      status: 'active'
    });

    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

      seller: sellerId,
      amount: 500,
      gstAmount: 90,
      totalAmount: 590,
      razorpayPaymentId,
      status: 'active',
      startDate,
      endDate,
      paymentHistory: [{
        date: new Date(),
        amount: 590,
        razorpayPaymentId,
        status: 'success'
      }]
    });


    await Seller.findByIdAndUpdate(sellerId, {
    });

    res.json({
      success: true,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

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
        break;
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
