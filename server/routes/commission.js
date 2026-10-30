import express from 'express';
import { verifyToken, verifyAdmin, verifySeller, verifyAnyPrincipal } from '../middleware/auth.js';
import {
  recordCommission,
  getCommissionSummary,
  getSellerCommissionDetails,
  getPendingCommissions
} from '../services/commissionTracking.js';

const router = express.Router();

/**
 * POST /api/commission/record/:orderId
 * Record commission for an order (admin only)
 */
router.post('/record/:orderId', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await recordCommission(orderId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/commission/summary
 * Get commission summary (admin only)
 */
router.get('/summary', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await getCommissionSummary({ startDate, endDate });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/commission/seller/:sellerId
 * Get commission details for a specific seller (admin or seller)
 */
router.get('/seller/:sellerId', verifyAnyPrincipal, async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { startDate, endDate } = req.query;

    // Allowed for the platform admin or for the seller themself.
    const principal = req.principal;
    const isAdmin = principal.decoded && principal.decoded.role === 'admin';
    const isSelf = principal.seller && String(principal.seller._id) === String(sellerId);
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    
    const result = await getSellerCommissionDetails(sellerId, { startDate, endDate });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/commission/my-commission
 * Get commission details for logged-in seller
 */
router.get('/my-commission', verifySeller, async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const { startDate, endDate } = req.query;
    
    const result = await getSellerCommissionDetails(sellerId, { startDate, endDate });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/commission/pending
 * Get pending commissions (admin only)
 */
router.get('/pending', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await getPendingCommissions();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
