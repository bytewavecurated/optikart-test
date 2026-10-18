import express from 'express';
import { verifyToken, verifyDeliveryPartner } from '../middleware/auth.js';
import {
  optimizeRoute,
  getRouteUpdates
} from '../services/deliveryRouteOptimization.js';

const router = express.Router();

/**
 * GET /api/delivery-route/optimize
 * Get optimized delivery route for logged-in partner
 */
router.get('/optimize', verifyToken, verifyDeliveryPartner, async (req, res) => {
  try {
    const partnerId = req.partner._id;

    const result = await optimizeRoute(partnerId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ success: false, message: result.error });
    }
  } catch (error) {
    console.error('Error in route optimization route:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/delivery-route/updates
 * Get real-time route updates
 */
router.get('/updates', verifyToken, verifyDeliveryPartner, async (req, res) => {
  try {
    const partnerId = req.partner._id;
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const result = await getRouteUpdates(partnerId, parseFloat(lat), parseFloat(lon));

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ success: false, message: result.error });
    }
  } catch (error) {
    console.error('Error in route updates route:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

export default router;
