import express from 'express';
import { verifyToken, verifySeller, verifyAdmin } from '../middleware/auth.js';
import OrderRouting from '../models/OrderRouting.js';
import { acceptRouting, rejectRouting, adminAssign, sweepExpiredOffers, findCandidates } from '../services/orderProximity.js';
import {
  routeOrder,
  sellerAcceptOrder,
  sellerRejectOrder,
  adminAssignOrder,
  aiAutoAssignOrder,
  getOrderRouting,
  getAllOrderRoutings
} from '../services/orderRouting.js';

const router = express.Router();

/**
 * POST /api/order-routing/route
 * Route order to nearby sellers (triggered after order creation)
 */
router.post('/route', verifyToken, async (req, res) => {
  try {
    const { orderId, customerLocation } = req.body;

    if (!orderId || !customerLocation) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and customer location are required'
      });
    }

    const result = await routeOrder(orderId, customerLocation);

    if (result.success) {
      res.json({
        success: true,
        message: 'Order routed to nearby sellers',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || result.error
      });
    }
  } catch (error) {
    console.error('Error in route order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/order-routing/:id/accept
 * Seller accepts order
 */
router.post('/:id/accept', verifySeller, async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.seller._id;

    const result = await acceptRouting(id, sellerId, req.app.get('io'));

    if (result.success) {
      res.json({
        success: true,
        message: 'Order accepted - it is now yours to prepare.'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in accept order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/order-routing/:id/reject
 * Seller rejects order
 */
router.post('/:id/reject', verifySeller, async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.seller._id;
    const { reason } = req.body;

    const result = await rejectRouting(id, sellerId, reason);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in reject order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/order-routing/:id/assign
 * Admin assigns order to seller
 */
router.post('/:id/assign', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { sellerId, adminNotes } = req.body;

    if (!sellerId) {
      return res.status(400).json({
        success: false,
        message: 'Seller ID is required'
      });
    }

    const result = await adminAssign(id, sellerId, req.app.get('io'), adminNotes);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in assign order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/order-routing/:id/auto-assign
 * AI auto-assigns order
 */
router.post('/:id/auto-assign', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await aiAutoAssignOrder(id);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          assignedSeller: result.assignedSeller,
          score: result.score
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error in auto-assign order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/order-routing/:id
 * Get order routing details
 */
/**
 * GET /api/order-routing/queue
 * Orders still awaiting a seller (used by the admin Order Assignment screen).
 * Literal path is declared before the '/:id' lookup so it is never swallowed.
 */
router.get('/queue', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : { status: { $in: ['routing', 'seller_contacted', 'admin_required'] } };

    const routings = await OrderRouting.find(filter)
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate('nearbySellers.seller', 'name storeName email phone rating city address')
      .populate('order', 'orderNumber orderStatus totalAmount items shippingAddress paymentStatus createdAt')
      .populate('assignedSeller', 'storeName phone');

    const queue = routings
      .filter((r) => r.order)
      .map((r) => ({
        routingId: r._id,
        orderId: r.order?._id,
        orderNumber: r.order?.orderNumber,
        orderStatus: r.order?.orderStatus,
        totalAmount: r.order?.totalAmount,
        placedAt: r.order?.createdAt,
        destination: [r.order?.shippingAddress?.street, r.order?.shippingAddress?.city, r.order?.shippingAddress?.pincode]
          .filter(Boolean).join(', '),
        status: r.status,
        timeoutAt: r.timeoutAt,
        assignedBy: r.assignedBy,
        assignedSeller: r.assignedSeller ? { _id: r.assignedSeller._id, storeName: r.assignedSeller.storeName } : null,
        adminNotes: r.adminNotes || '',
        candidates: (r.nearbySellers || []).map((entry) => ({
          sellerId: entry.seller?._id || entry.seller,
          storeName: entry.seller?.storeName || entry.seller?.name || 'Unknown seller',
          phone: entry.seller?.phone || '',
          email: entry.seller?.email || '',
          city: entry.seller?.city || entry.seller?.address?.city || '',
          rating: entry.seller?.rating || 0,
          distanceKm: entry.distance,
          response: entry.response || 'pending'
        }))
      }));

    res.json({ success: true, queue, count: queue.length });
  } catch (error) {
    console.error('Routing queue error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/order-routing/sweep
 * Force the 30-minute expiry pass now (admin or a cron endpoint).
 */
router.post('/sweep', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await sweepExpiredOffers(req.app.get('io'));
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Routing sweep error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Callers hold an order id or a routing id; accept either, and always
    // populate the contact details an admin needs to phone a seller directly.
    let routing = await OrderRouting.findOne({ order: id })
      .populate('nearbySellers.seller', 'name storeName email phone rating city address location isVerified')
      .populate('assignedSeller', 'name storeName email phone')
      .populate('order', 'orderNumber orderStatus totalAmount items shippingAddress');

    if (!routing) {
      routing = await OrderRouting.findById(id)
        .populate('nearbySellers.seller', 'name storeName email phone rating city address location isVerified')
        .populate('assignedSeller', 'name storeName email phone')
        .populate('order', 'orderNumber orderStatus totalAmount items shippingAddress');
    }

    if (!routing) return res.status(404).json({ success: false, message: 'Routing not found for this order.' });

    const candidates = (routing.nearbySellers || []).map((entry) => ({
      sellerId: entry.seller?._id || entry.seller,
      storeName: entry.seller?.storeName || entry.seller?.name || 'Unknown seller',
      contactPhone: entry.seller?.phone || '',
      contactEmail: entry.seller?.email || '',
      city: entry.seller?.city || entry.seller?.address?.city || '',
      rating: entry.seller?.rating || 0,
      distanceKm: entry.distance,
      hasProduct: entry.hasProduct !== false,
      response: entry.response || 'pending',
      contactedAt: entry.contactedAt || null,
      respondedAt: entry.respondedAt || null
    }));

    return res.json({
      success: true,
      data: routing,
      candidates,
      // True once all five sellers declined or timed out and the order is
      // waiting on an administrator.
      awaitingAdmin: routing.status === 'admin_required' || candidates.every((c) => c.response !== 'pending') && routing.status !== 'seller_accepted' && routing.status !== 'admin_assigned'
    });
  } catch (error) {
    console.error('Order routing lookup failed:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status, assignedBy } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (assignedBy) filters.assignedBy = assignedBy;

    const result = await getAllOrderRoutings(filters);

    if (result.success) {
      res.json({
        success: true,
        data: result.routings
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get all order routings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
