import express from 'express';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';
import {
  submitForVerification,
  approveVerification,
  rejectVerification,
  getUserVerifications,
  getPendingVerifications,
  getAllVerifications
} from '../services/prescriptionVerification.js';

const router = express.Router();

/**
 * POST /api/prescription-verification/submit
 * Submit prescription for verification (user)
 */
router.post('/submit', verifyToken, async (req, res) => {
  try {
    const { prescriptionId } = req.body;
    const userId = req.user.id;

    if (!prescriptionId) {
      return res.status(400).json({
        success: false,
        message: 'Prescription ID is required'
      });
    }

    const result = await submitForVerification(prescriptionId, userId);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Prescription submitted for verification',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in submit verification route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/prescription-verification/user
 * Get user's prescription verifications
 */
router.get('/user', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await getUserVerifications(userId);

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
    console.error('Error in get user verifications route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/prescription-verification/pending
 * Get all pending verifications (admin)
 */
router.get('/pending', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await getPendingVerifications();

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
    console.error('Error in get pending verifications route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/prescription-verification
 * Get all verifications (admin)
 */
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status, user } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (user) filters.user = user;

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
    console.error('Error in get all verifications route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/prescription-verification/:id/approve
 * Approve prescription verification (admin)
 */
router.post('/:id/approve', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;

    const result = await approveVerification(id, adminId, notes);

    if (result.success) {
      res.json({
        success: true,
        message: 'Prescription verification approved',
        data: result.verification
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in approve verification route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/prescription-verification/:id/reject
 * Reject prescription verification (admin)
 */
router.post('/:id/reject', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const result = await rejectVerification(id, adminId, reason);

    if (result.success) {
      res.json({
        success: true,
        message: 'Prescription verification rejected',
        data: result.verification
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in reject verification route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
