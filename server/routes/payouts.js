import express from 'express';
import { verifyAdmin, verifySeller } from '../middleware/auth.js';
import {
  calculateSellerPayout,
  processPendingPayouts,
  getSellerPayoutHistory,
  getAllPayouts,
  getPayoutSummary
} from '../services/sellerPayout.js';

const router = express.Router();

/**
 * @route   POST /api/payouts/calculate
 * @desc    Calculate payout for a seller for a given period
 * @access  Admin
 */
router.post('/calculate', verifyAdmin, async (req, res) => {
  try {
    const { sellerId, startDate, endDate } = req.body;

    if (!sellerId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide sellerId, startDate, and endDate'
      });
    }

    const result = await calculateSellerPayout(sellerId, startDate, endDate);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Payout calculated successfully',
      data: {
        payout: result.payout,
        orderCount: result.orderCount
      }
    });
  } catch (error) {
    console.error('Error calculating payout:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/payouts/process
 * @desc    Process all pending payouts
 * @access  Admin
 */
router.post('/process', verifyAdmin, async (req, res) => {
  try {
    const result = await processPendingPayouts();

    res.json({
      success: true,
      message: 'Payout processing completed',
      data: result
    });
  } catch (error) {
    console.error('Error processing payouts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/payouts/history
 * @desc    Get seller's payout history
 * @access  Seller
 */
router.get('/history', verifySeller, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const payouts = await getSellerPayoutHistory(req.seller._id, limit);

    res.json({
      success: true,
      data: payouts
    });
  } catch (error) {
    console.error('Error getting payout history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/payouts
 * @desc    Get all payouts (admin view)
 * @access  Admin
 */
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const { status, limit } = req.query;
    const filters = {};
    
    if (status) {
      filters.status = status;
    }

    const payouts = await getAllPayouts(filters, parseInt(limit) || 50);

    res.json({
      success: true,
      data: payouts
    });
  } catch (error) {
    console.error('Error getting payouts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/payouts/summary
 * @desc    Get payout summary statistics
 * @access  Admin
 */
router.get('/summary', verifyAdmin, async (req, res) => {
  try {
    const summary = await getPayoutSummary();

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting payout summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
