import express from 'express';
import { verifyToken, verifySeller, verifyAdmin } from '../middleware/auth.js';
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

    const result = await sellerAcceptOrder(id, sellerId);

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

    const result = await sellerRejectOrder(id, sellerId, reason);

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

    const result = await adminAssignOrder(id, sellerId, adminNotes);

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
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await getOrderRouting(id);

    if (result.success) {
      res.json({
        success: true,
        data: result.routing
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get order routing:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/order-routing
 * Get all order routings (admin)
 */
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
