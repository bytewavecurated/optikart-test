import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  addToWishlistWithPrice,
  getUserWishlistWithPriceInfo,
  checkWishlistPriceDrops
} from '../services/wishlistAlerts.js';

const router = express.Router();

/**
 * POST /api/wishlist-alerts/add
 * Add product to wishlist with price tracking
 */
router.post('/add', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const result = await addToWishlistWithPrice(userId, productId);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Product added to wishlist',
        data: result.wishlist
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || result.error
      });
    }
  } catch (error) {
    console.error('Error in add to wishlist route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/wishlist-alerts
 * Get user wishlist with price drop information
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await getUserWishlistWithPriceInfo(userId);

    if (result.success) {
      res.json({
        success: true,
        data: result.wishlist
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get wishlist route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/wishlist-alerts/check-price-drops
 * Manually trigger price drop check (admin only)
 */
router.post('/check-price-drops', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const result = await checkWishlistPriceDrops();

    if (result.success) {
      res.json({
        success: true,
        message: `Sent ${result.notificationsSent} price drop notifications`,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in check price drops route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
