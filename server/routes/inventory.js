import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  reserveStock,
  completeReservation,
  cancelReservation,
  getUserReservations,
  bulkUpdateStock,
  checkAvailability,
  getAvailableProducts
} from '../services/inventory.js';
import { verifySeller } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/inventory/reserve
 * Reserve stock for a product
 */
router.post('/reserve', verifyToken, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user.id;

    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and quantity are required'
      });
    }

    const result = await reserveStock(productId, userId, quantity);

    if (result.success) {
      res.json({
        success: true,
        message: 'Stock reserved successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in reserve stock route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/inventory/complete/:reservationId
 * Complete a reservation (convert to order)
 */
router.post('/complete/:reservationId', verifyToken, async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    const io = req.app.get('io');
    const result = await completeReservation(reservationId, orderId, io);

    if (result.success) {
      res.json({
        success: true,
        message: 'Reservation completed successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in complete reservation route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/inventory/cancel/:reservationId
 * Cancel a reservation
 */
router.post('/cancel/:reservationId', verifyToken, async (req, res) => {
  try {
    const { reservationId } = req.params;

    const result = await cancelReservation(reservationId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Reservation cancelled successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in cancel reservation route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/inventory/reservations
 * Get user's active reservations
 */
router.get('/reservations', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await getUserReservations(userId);

    if (result.success) {
      res.json({
        success: true,
        data: result.reservations
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get reservations route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/inventory/bulk-update
 * Bulk update stock for multiple products (seller only)
 */
router.post('/bulk-update', verifySeller, async (req, res) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required'
      });
    }

    // Verify that all products belong to this seller
    const sellerId = req.user.id;
    const Product = (await import('../models/Product.js')).default;
    
    for (const update of updates) {
      const product = await Product.findById(update.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${update.productId} not found`
        });
      }
      if (product.seller.toString() !== sellerId) {
        return res.status(403).json({
          success: false,
          message: `Not authorized to update product ${update.productId}`
        });
      }
    }

    const io = req.app.get('io');
    const result = await bulkUpdateStock(updates, io);

    if (result.success) {
      res.json({
        success: true,
        message: 'Stock updated successfully',
        data: result.results
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in bulk update route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/inventory/check/:productId
 * Check product availability
 */
router.get('/check/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity = 1 } = req.query;

    const result = await checkAvailability(productId, parseInt(quantity));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in check availability route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/inventory/available
 * Get available products (hide out-of-stock)
 */
router.get('/available', async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = '-createdAt', ...query } = req.query;

    const result = await getAvailableProducts(query, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in get available products route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
