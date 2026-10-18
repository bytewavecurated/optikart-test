import express from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/auth.js';
import {
  checkReturnEligibility,
  createCustomerReturnRequest,
  uploadReturnImages,
  getUserReturnRequests,
  cancelReturnRequest
} from '../services/customerReturnPortal.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  }
});

/**
 * GET /api/customer-returns/eligibility/:orderId
 * Check if order is eligible for return
 */
router.get('/eligibility/:orderId', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const result = await checkReturnEligibility(orderId, userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ success: false, message: result.message, ...result });
    }
  } catch (error) {
    console.error('Error in check eligibility route:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/customer-returns
 * Create return request
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { orderId, items, reason, description } = req.body;
    const userId = req.user.id;

    if (!orderId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and items are required'
      });
    }

    const result = await createCustomerReturnRequest(orderId, userId, items, reason, description);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('Error in create return route:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/customer-returns/:returnId/images
 * Upload images for return request
 */
router.post('/:returnId/images', verifyToken, upload.array('images', 5), async (req, res) => {
  try {
    const { returnId } = req.params;

    const result = await uploadReturnImages(req.files, returnId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('Error in upload images route:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/customer-returns/my-returns
 * Get user's return requests
 */
router.get('/my-returns', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const result = await getUserReturnRequests(userId, status);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('Error in get user returns route:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/customer-returns/:returnId/cancel
 * Cancel return request
 */
router.post('/:returnId/cancel', verifyToken, async (req, res) => {
  try {
    const { returnId } = req.params;
    const userId = req.user.id;

    const result = await cancelReturnRequest(returnId, userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('Error in cancel return route:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

export default router;
