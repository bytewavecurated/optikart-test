import express from 'express';
import { verifyToken, verifyAdmin, verifyPrescriptionVerifier } from '../middleware/auth.js';
import {
  submitForVerification,
  approveVerification,
  rejectVerification,
  getUserVerifications,
  getPendingVerifications,
  getAllVerifications
} from '../services/prescriptionVerification.js';

import Prescription from '../models/Prescription.js';
import PrescriptionVerification from '../models/PrescriptionVerification.js';

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
router.get('/pending', verifyToken, verifyPrescriptionVerifier, async (req, res) => {
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
router.get('/', verifyToken, verifyPrescriptionVerifier, async (req, res) => {
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
/*
 * A clearer photograph than the one the customer uploaded is a normal outcome of
 * checking - the scan is blurry, the numbers are cut off, the wrong page came
 * through. Without a way to attach the better copy here, the verifier's only
 * option is to reject and hope the customer uploads it somewhere else, and the
 * conversation ends up in email with nothing recorded on the prescription.
 *
 * The previous file is kept: prescription images are evidence, and overwriting
 * what a customer sent destroys the thing a later decision may need to refer to.
 */
router.patch('/:id/document', verifyToken, verifyPrescriptionVerifier, async (req, res) => {
  try {
    const fileUrl = String(req.body?.fileUrl || '').trim();
    const note = String(req.body?.note || '').trim().slice(0, 300);
    if (!/^(\/uploads\/|https:\/\/)/.test(fileUrl)) {
      return res.status(400).json({ success: false, message: 'Attach a file through the upload endpoint first; send back the /uploads/prescriptions/... address it returns.' });
    }

    const verification = await PrescriptionVerification.findById(req.params.id);
    if (!verification) return res.status(404).json({ success: false, message: 'Verification not found.' });

    const prescription = await Prescription.findById(verification.prescription);
    if (!prescription) return res.status(404).json({ success: false, message: 'Prescription not found.' });

    if (!Array.isArray(prescription.previousFiles)) {
      prescription.previousFiles = [];
    }
    if (prescription.fileUrl && !prescription.previousFiles.includes(prescription.fileUrl)) {
      prescription.previousFiles.push(prescription.fileUrl);
    }
    prescription.fileUrl = fileUrl;
    if (note) prescription.notes = [prescription.notes, `Verifier note: ${note}`].filter(Boolean).join('\n');
    await prescription.save();

    prescription.validatedBy = req.user.id || req.user._id;
    prescription.validatedAt = new Date();
    await prescription.save();

    res.json({ success: true, message: 'Document attached to the prescription.', fileUrl, previousFiles: prescription.previousFiles });
  } catch (error) {
    console.error('Attach prescription document error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/:id/approve', verifyToken, verifyPrescriptionVerifier, async (req, res) => {
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
router.post('/:id/reject', verifyToken, verifyPrescriptionVerifier, async (req, res) => {
  try {
    const { id } = req.params;
    const reason = String(req.body?.reason || '').trim();
    // A rejection with no reason cannot be acted on: the customer has to know
    // whether to re-upload, wear old glasses, or see an optometrist.
    if (!reason) {
      return res.status(400).json({ success: false, message: 'A rejection needs a short reason for the customer.' });
    }
    const adminId = req.user.id;

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
