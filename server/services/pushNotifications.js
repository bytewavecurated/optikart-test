import PushNotification from '../models/PushNotification.js';
import webpush from 'web-push';

// Configure VAPID keys for web push
// Generate keys using: npx web-push generate-vapid-keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:notifications@optikart.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Send push notification to a user
 */
export const sendPushNotification = async (userId, title, body, type, data = {}) => {
  try {
    // Save notification to database
    const notification = await PushNotification.create({
      user: userId,
      title,
      body,
      type,
      data
    });

    // Get user's push subscription from database
    // Note: You need to store user push subscriptions in the User model
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(userId);

    if (user && user.pushSubscription) {
      try {
        await webpush.sendNotification(
          user.pushSubscription,
          JSON.stringify({
            title,
            body,
            icon: '/logo192.png',
            badge: '/badge72.png',
            data: {
              url: data.url || '/',
              ...data
            }
          })
        );
      } catch (error) {
        console.error('Error sending web push:', error);
        // If subscription is invalid, remove it
        if (error.statusCode === 410) {
          user.pushSubscription = null;
          await user.save();
        }
      }
    }

    // Also send via Socket.io for real-time updates
    const io = global.io;
    if (io) {
      io.to(`user_${userId}`).emit('notification', {
        id: notification._id,
        title,
        body,
        type,
        data
      });
    }

    return {
      success: true,
      notification
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send order update notification
 */
export const sendOrderUpdateNotification = async (userId, orderId, status) => {
  const statusMessages = {
    confirmed: 'Your order has been confirmed!',
    packed: 'Your order is being packed',
    shipped: 'Your order has been shipped!',
    out_for_delivery: 'Your order is out for delivery',
    delivered: 'Your order has been delivered!',
    cancelled: 'Your order has been cancelled'
  };

  const title = 'Order Update';
  const body = statusMessages[status] || `Your order status has been updated to ${status}`;

  return await sendPushNotification(userId, title, body, 'order_update', {
    orderId,
    url: `/orders/${orderId}`
  });
};

/**
 * Send price drop notification
 */
export const sendPriceDropNotification = async (userId, productId, productName, oldPrice, newPrice) => {
  const discount = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
  
  const title = 'Price Drop Alert!';
  const body = `${productName} is now ${discount}% off! Was ₹${oldPrice}, now ₹${newPrice}`;

  return await sendPushNotification(userId, title, body, 'price_drop', {
    productId,
    url: `/product/${productId}`
  });
};

/**
 * Send sale event notification
 */
export const sendSaleEventNotification = async (userId, saleEventId, eventName, discount) => {
  const title = 'Flash Sale!';
  const body = `${eventName} - Get up to ${discount}% off!`;

  return await sendPushNotification(userId, title, body, 'sale_alert', {
    saleEventId,
    url: `/sale/${saleEventId}`
  });
};

/**
 * Send wishlist notification
 */
export const sendWishlistNotification = async (userId, productId, productName, message) => {
  const title = 'Wishlist Update';
  const body = message || `${productName} has been updated!`;

  return await sendPushNotification(userId, title, body, 'wishlist', {
    productId,
    url: `/product/${productId}`
  });
};

/**
 * Get user notifications
 */
export const getUserNotifications = async (userId, limit = 20, unreadOnly = false) => {
  try {
    const query = { user: userId };
    if (unreadOnly) query.isRead = false;

    const notifications = await PushNotification.find(query)
      .sort({ sentAt: -1 })
      .limit(limit);

    const unreadCount = await PushNotification.countDocuments({
      user: userId,
      isRead: false
    });

    return {
      success: true,
      notifications,
      unreadCount
    };
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await PushNotification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notification not found');
    }

    return {
      success: true,
      notification
    };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (userId) => {
  try {
    await PushNotification.updateMany(
      { user: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return {
      success: true,
      message: 'All notifications marked as read'
    };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId, userId) => {
  try {
    const notification = await PushNotification.findOneAndDelete({
      _id: notificationId,
      user: userId
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return {
      success: true,
      message: 'Notification deleted'
    };
  } catch (error) {
    console.error('Error deleting notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send wishlist price drop alert notification
 */
export const sendWishlistPriceDropAlert = async (userId, productId, productName, oldPrice, newPrice) => {
  const drop = oldPrice - newPrice;
  const dropPercent = Math.round((drop / oldPrice) * 100);
  return sendPushNotification(
    userId,
    'Price Drop Alert!',
    `${productName} dropped by ${dropPercent}% — now ₹${newPrice} (was ₹${oldPrice})`,
    'price_drop',
    { productId, oldPrice, newPrice }
  );
};

export default {
  sendPushNotification,
  sendOrderUpdateNotification,
  sendPriceDropNotification,
  sendSaleEventNotification,
  sendWishlistNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
