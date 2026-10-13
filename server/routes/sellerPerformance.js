import express from 'express';
import { verifyToken, verifySeller, verifyAdmin } from '../middleware/auth.js';
import {
  calculateSellerMetrics,
  getSellerBadge,
  getAllSellersWithMetrics
} from '../services/sellerPerformance.js';

const router = express.Router();

/**
 * GET /api/seller-performance/metrics
 * Get current seller's performance metrics
 */
router.get('/metrics', verifyToken, verifySeller, async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const { startDate, endDate } = req.query;

    const dateRange = {};
    if (startDate && endDate) {
      dateRange.startDate = startDate;
      dateRange.endDate = endDate;
    }

    const result = await calculateSellerMetrics(sellerId, dateRange);

    if (result.success) {
      const badge = getSellerBadge(result.metrics);
      
      res.json({
        success: true,
        data: {
          metrics: result.metrics,
          badge
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get seller metrics route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/seller-performance/:sellerId/metrics
 * Get specific seller's performance metrics (admin)
 */
router.get('/:sellerId/metrics', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { startDate, endDate } = req.query;

    const dateRange = {};
    if (startDate && endDate) {
      dateRange.startDate = startDate;
      dateRange.endDate = endDate;
    }

    const result = await calculateSellerMetrics(sellerId, dateRange);

    if (result.success) {
      const badge = getSellerBadge(result.metrics);
      
      res.json({
        success: true,
        data: {
          metrics: result.metrics,
          badge
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get seller metrics route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/seller-performance/all
 * Get all sellers with performance metrics (admin)
 */
router.get('/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateRange = {};
    if (startDate && endDate) {
      dateRange.startDate = startDate;
      dateRange.endDate = endDate;
    }

    const result = await getAllSellersWithMetrics(dateRange);

    if (result.success) {
      res.json({
        success: true,
        data: result.sellers
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get all sellers route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
