import express from 'express';
import { verifyToken, verifyAdmin, verifyManufacturer } from '../middleware/auth.js';
import {
  submitProductForVerification,
  verifyProduct,
  rejectProduct,
  manufacturerAcceptProduct,
  getManufacturerPendingVerifications,
  getAllVerifications,
  checkExpiredAcceptances
} from '../services/productVerification.js';

const router = express.Router();

/**
 * POST /api/product-verification/submit
 * Submit product for verification (manufacturer)
 */
router.post('/submit', verifyToken, verifyManufacturer, async (req, res) => {
  try {
    const { productId } = req.body;
    const manufacturerId = req.manufacturer._id;
    const submittedById = req.user.id;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const result = await submitProductForVerification(productId, manufacturerId, submittedById);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Product submitted for verification',
        data: result.verification
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in submit product for verification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/product-verification/:id/verify
 * Verify product (admin)
 */
router.post('/:id/verify', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const { notes } = req.body;

    const result = await verifyProduct(id, adminId, notes);

    if (result.success) {
      res.json({
        success: true,
        message: 'Product verified successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in verify product:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/product-verification/:id/reject
 * Reject product (admin)
 */
router.post('/:id/reject', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const { reason, updateRequired } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const result = await rejectProduct(id, adminId, reason, updateRequired);

    if (result.success) {
      res.json({
        success: true,
        message: 'Product rejected',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in reject product:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/product-verification/:id/accept
 * Manufacturer accepts verified product
 */
router.post('/:id/accept', verifyToken, verifyManufacturer, async (req, res) => {
  try {
    const { id } = req.params;
    const manufacturerId = req.manufacturer._id;

    const result = await manufacturerAcceptProduct(id, manufacturerId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Product accepted',
        data: result.verification
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in accept product:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/product-verification/manufacturer/pending
 * Get manufacturer's pending verifications
 */
router.get('/manufacturer/pending', verifyToken, verifyManufacturer, async (req, res) => {
  try {
    const manufacturerId = req.manufacturer._id;

    const result = await getManufacturerPendingVerifications(manufacturerId);

    if (result.success) {
      res.json({
        success: true,
        data: result.verifications
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get manufacturer pending verifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/product-verification
 * Get all verifications (admin)
 */
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status, manufacturer } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (manufacturer) filters.manufacturer = manufacturer;

    const result = await getAllVerifications(filters);

    if (result.success) {
      res.json({
        success: true,
        data: result.verifications
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get all verifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/product-verification/check-expired
 * Check for expired acceptances (admin/cron)
 */
router.post('/check-expired', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await checkExpiredAcceptances();

    if (result.success) {
      res.json({
        success: true,
        message: `Processed ${result.expiredCount} expired verifications`,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in check expired acceptances:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
