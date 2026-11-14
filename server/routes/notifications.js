/*
 * Push-subscription and deletion half of the notifications API.
 *
 * This file used to declare `GET /`, `PUT /:id/read` and `PUT /read-all` as
 * well, and `server.js` mounted BOTH this router and `routes/notification.js`
 * at `/api/notifications`. Express tries the first and only falls through when
 * nothing matched, so those three lived here as unreachable code: the served
 * behaviour came from `notification.js`, this file appeared to offer a second
 * implementation of the same routes (with a different auth call and different
 * query parameters), and any edit made here looked correct on screen and changed
 * nothing in production.
 *
 * The rule an endpoint follows now: exactly one router per path, one file per
 * prefix. The two remaining handlers here (`DELETE /:id`, `POST /subscribe`)
 * are unique to this file and always were the only live ones.
 */
import express from 'express';
import { verifyToken, verifyAnyPrincipal } from '../middleware/auth.js';
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

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */

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
