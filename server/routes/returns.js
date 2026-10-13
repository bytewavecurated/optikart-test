import express from 'express';
import { verifyToken, verifySeller, verifyAdmin } from '../middleware/auth.js';
import {
  createReturnRequest,
  approveReturnRequest,
  rejectReturnRequest,
  markAsPickedUp,
  markAsReceived,
  processReturnRefund,
  getUserReturns,
  getSellerReturns,
  getAllReturns
} from '../services/returns.js';

const router = express.Router();

/**
 * POST /api/returns
 * Create a return request (user)
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { orderId, items, reason } = req.body;
    const userId = req.user.id;

    if (!orderId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and items are required'
      });
    }

    const result = await createReturnRequest(orderId, userId, items, reason);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Return request created successfully',
        data: result.returnRequest
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in create return route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/returns/user
 * Get user's return requests
 */
router.get('/user', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await getUserReturns(userId);

    if (result.success) {
      res.json({
        success: true,
        data: result.returns
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get user returns route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/returns/seller
 * Get seller's return requests
 */
router.get('/seller', verifyToken, verifySeller, async (req, res) => {
  try {
    const sellerId = req.user.id;

    const result = await getSellerReturns(sellerId);

    if (result.success) {
      res.json({
        success: true,
        data: result.returns
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get seller returns route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/returns
 * Get all return requests (admin)
 */
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status, seller, user } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (seller) filters.seller = seller;
    if (user) filters.user = user;

    const result = await getAllReturns(filters);

    if (result.success) {
      res.json({
        success: true,
        data: result.returns
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get all returns route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/returns/:id/approve
 * Approve a return request (admin/seller)
 */
router.post('/:id/approve', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const result = await approveReturnRequest(id, adminNotes);

    if (result.success) {
      res.json({
        success: true,
        message: 'Return request approved successfully',
        data: result.returnRequest,
        shippingLabel: result.shippingLabel
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in approve return route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/returns/:id/reject
 * Reject a return request (admin/seller)
 */
router.post('/:id/reject', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const result = await rejectReturnRequest(id, reason);

    if (result.success) {
      res.json({
        success: true,
        message: 'Return request rejected',
        data: result.returnRequest
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in reject return route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/returns/:id/picked-up
 * Mark return as picked up (seller/admin)
 */
router.post('/:id/picked-up', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await markAsPickedUp(id);

    if (result.success) {
      res.json({
        success: true,
        message: 'Return marked as picked up',
        data: result.returnRequest
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in mark as picked up route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/returns/:id/received
 * Mark return as received (seller/admin)
 */
router.post('/:id/received', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await markAsReceived(id);

    if (result.success) {
      res.json({
        success: true,
        message: 'Return marked as received',
        data: result.returnRequest
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in mark as received route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/returns/:id/refund
 * Process refund for a return (admin)
 */
router.post('/:id/refund', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await processReturnRefund(id);

    if (result.success) {
      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: result.returnRequest,
        refundId: result.refundId
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in process refund route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
