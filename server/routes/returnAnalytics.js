import express from 'express';
import { verifyToken, verifySeller, verifyAdmin } from '../middleware/auth.js';
import {
  getSellerReturnAnalytics,
  getAdminReturnAnalytics
} from '../services/returnAnalytics.js';

const router = express.Router();

/**
 * GET /api/return-analytics/seller
 * Get return analytics for logged-in seller
 */
router.get('/seller', verifyToken, verifySeller, async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const { startDate, endDate } = req.query;

    const result = await getSellerReturnAnalytics(sellerId, { startDate, endDate });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ success: false, message: result.error });
    }
  } catch (error) {
    console.error('Error in seller return analytics route:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/return-analytics/admin
 * Get return analytics for admin (all sellers, state-wise)
 */
router.get('/admin', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const result = await getAdminReturnAnalytics({ startDate, endDate });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ success: false, message: result.error });
    }
  } catch (error) {
    console.error('Error in admin return analytics route:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

export default router;
