import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '../services/pushNotifications.js';

const router = express.Router();

/**
 * GET /api/notifications
 * Get user notifications
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, unreadOnly = false } = req.query;

    const result = await getUserNotifications(userId, parseInt(limit), unreadOnly === 'true');

    if (result.success) {
      res.json({
        success: true,
        data: result.notifications,
        unreadCount: result.unreadCount
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get notifications route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await markAsRead(id, userId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Notification marked as read',
        data: result.notification
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in mark as read route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await markAllAsRead(userId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in mark all as read route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete notification
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await deleteNotification(id, userId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in delete notification route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/subscribe
 * Save push subscription
 */
router.post('/subscribe', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscription } = req.body;

    if (!subscription) {
      return res.status(400).json({
        success: false,
        message: 'Subscription data is required'
      });
    }

    // Save subscription to user model
    const User = (await import('../models/User.js')).default;
    await User.findByIdAndUpdate(userId, {
      pushSubscription: subscription
    });

    res.json({
      success: true,
      message: 'Subscription saved successfully'
    });
  } catch (error) {
    console.error('Error in subscribe route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
