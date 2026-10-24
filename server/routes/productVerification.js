import express from 'express';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';
import {
  getPendingProducts,
  verifyProduct,
  rejectProduct,
  getVerificationStats
} from '../services/productVerification.js';

const router = express.Router();

/**
 * GET /api/product-verification/pending
 * Get all pending products for verification
 */
router.get('/pending', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { manufacturer, brand, category } = req.query;
    const result = await getPendingProducts({ manufacturer, brand, category });
    
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
 * POST /api/product-verification/:productId/verify
 * Verify a product
 */
router.post('/:productId/verify', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { productId } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;
    
    const result = await verifyProduct(productId, adminId, notes);
    
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
 * POST /api/product-verification/:productId/reject
 * Reject a product (mark for correction)
 */
router.post('/:productId/reject', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { productId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;
    
    if (!reason) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required' });
    }
    
    const result = await rejectProduct(productId, adminId, reason);
    
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
 * GET /api/product-verification/stats
 * Get verification statistics
 */
router.get('/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await getVerificationStats();
    
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
