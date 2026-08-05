import express from 'express';
import Order from '../models/Order.js';
import Seller from '../models/Seller.js';
import { verifyToken, verifySeller, verifyAdmin } from '../middleware/auth.js';
import * as shiprocketService from '../services/shiprocket.js';
import { sendPickupAlert } from '../services/email.js';

const router = express.Router();

router.post('/create-order', verifySeller, async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      seller: req.seller._id
    })
      .populate('items.product', 'title')
      .populate('user', 'name email phone');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (!['confirmed', 'packed'].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: 'Order must be confirmed or packed to create shipping.' });
    }

    const seller = await Seller.findById(req.seller._id);

    const orderDetails = {
      orderId: order.orderNumber,
      orderDate: order.createdAt.toISOString().split('T')[0],
      pickupDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      billingCustomerName: order.shippingAddress.name.split(' ')[0],
      billingLastName: order.shippingAddress.name.split(' ').slice(1).join(' ') || '',
      billingAddress: order.shippingAddress.street,
      billingCity: order.shippingAddress.city,
      billingPincode: order.shippingAddress.pincode,
      billingState: order.shippingAddress.state,
      billingEmail: order.shippingAddress.email || order.user.email,
      billingPhone: order.shippingAddress.phone,
      items: order.items.map(item => ({
        name: item.product?.title || 'Eyewear Product',
        sku: `SKU-${order.orderNumber}`,
        quantity: item.quantity,
        price: item.price
      })),
      paymentMethod: order.paymentStatus === 'completed' ? 'Prepaid' : 'COD',
      shippingCharges: order.deliveryCharge,
      subtotal: order.subtotal
    };

    const result = await shiprocketService.createOrder(orderDetails);

    if (!result.success) {
      return res.status(500).json({ success: false, message: 'Failed to create Shiprocket order.', error: result.error });
    }

    order.shiprocketOrderId = result.orderId?.toString();
    order.shiprocketTrackingId = result.awbCode;
    await order.save();

    res.json({
      success: true,
      message: 'Shiprocket order created.',
      data: {
        orderId: result.orderId,
        shipmentId: result.shipmentId,
        awbCode: result.awbCode,
        courierId: result.courierId,
        courierName: result.courierName
      }
    });
  } catch (error) {
    console.error('Create Shiprocket order error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/pickup', verifySeller, async (req, res) => {
  try {
    const { orderId, pickupDate, pickupTime } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      seller: req.seller._id
    }).populate('user', 'email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (!order.shiprocketOrderId) {
      return res.status(400).json({ success: false, message: 'Shiprocket order not created yet.' });
    }

    const pickupDetails = {
      shipmentId: order.shiprocketOrderId,
      pickupDate: pickupDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      pickupTime: pickupTime || '13:00-16:00',
      packageCount: order.items.reduce((sum, item) => sum + item.quantity, 1),
      packageType: 'small'
    };

    const result = await shiprocketService.schedulePickup(pickupDetails);

    if (!result.success) {
      return res.status(500).json({ success: false, message: 'Failed to schedule pickup.', error: result.error });
    }

    order.pickupDate = new Date(pickupDetails.pickupDate);
    order.orderStatus = 'picked_up';
    await order.save();

    const seller = await Seller.findById(req.seller._id);
    await sendPickupAlert(seller.email, {
      orderNumber: order.orderNumber,
      pickupDate: pickupDetails.pickupDate,
      address: order.shippingAddress.street
    });

    res.json({
      success: true,
      message: 'Pickup scheduled successfully.',
      data: {
        pickupDate: result.pickupDate,
        pickupTime: result.pickupTime,
        pickupLocation: result.pickupLocation
      }
    });
  } catch (error) {
    console.error('Schedule pickup error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/tracking/:orderId', verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (!order.shiprocketTrackingId) {
      return res.status(400).json({ success: false, message: 'No tracking information available.' });
    }

    const tracking = await shiprocketService.getTracking(order.shiprocketTrackingId);

    if (!tracking.success) {
      return res.status(500).json({ success: false, message: 'Failed to fetch tracking info.', error: tracking.error });
    }

    res.json({
      success: true,
      tracking: {
        status: tracking.trackingStatus,
        lastEvent: tracking.lastEvent,
        lastLocation: tracking.lastLocation,
        shipmentStatus: tracking.shipmentStatus,
        trackingUrl: order.shiprocketTrackingUrl,
        awbCode: order.shiprocketTrackingId
      }
    });
  } catch (error) {
    console.error('Get tracking error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/webhook', express.json(), async (req, res) => {
  try {
    const { event, data } = req.body;

    console.log('Shiprocket webhook received:', event, data);

    if (data?.awb) {
      const order = await Order.findOne({ shiprocketTrackingId: data.awb });

      if (order) {
        switch (event) {
          case 'ORDER_PICKUP_GENERATED':
            order.orderStatus = 'picked_up';
            break;
          case 'ORDER_IN_TRANSIT':
            order.orderStatus = 'in_transit';
            break;
          case 'ORDER_DELIVERED':
            order.orderStatus = 'delivered';
            order.deliveryDate = new Date();
            break;
          case 'ORDER_CANCELLED':
            order.orderStatus = 'cancelled';
            break;
          case 'ORDER_RTO_INITIATED':
            order.orderStatus = 'return_requested';
            break;
          case 'ORDER_RTO_DELIVERED':
            order.orderStatus = 'returned';
            break;
        }

        await order.save();
      }
    }

    res.json({ success: true, message: 'Webhook processed.' });
  } catch (error) {
    console.error('Shiprocket webhook error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing error.', error: error.message });
  }
});

export default router;
