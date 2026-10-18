import express from 'express';
import { verifyToken, verifySeller, verifyAdmin } from '../middleware/auth.js';
import {
  getSellerInventoryAnalytics,
  getInventoryHealthScore
} from '../services/inventoryAnalytics.js';

const router = express.Router();

/**
 * GET /api/inventory-analytics/seller
 * Get inventory analytics for logged-in seller
 */
router.get('/seller', verifyToken, verifySeller, async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const { startDate, endDate } = req.query;

    const result = await getSellerInventoryAnalytics(sellerId, { startDate, endDate });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ success: false, message: result.error });
    }
  } catch (error) {
    console.error('Error in seller inventory analytics route:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/inventory-analytics/seller/health
 * Get inventory health score for logged-in seller
 */
router.get('/seller/health', verifyToken, verifySeller, async (req, res) => {
  try {
    const sellerId = req.seller._id;

    const result = await getInventoryHealthScore(sellerId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ success: false, message: result.error });
    }
  } catch (error) {
    console.error('Error in seller inventory health route:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

export default router;
