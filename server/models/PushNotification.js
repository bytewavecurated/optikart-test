import mongoose from 'mongoose';

const pushNotificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['order_update', 'price_drop', 'sale_alert', 'wishlist', 'general'],
    required: true
  },
  data: {
    orderId: String,
    productId: String,
    saleEventId: String,
    url: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  readAt: Date
}, {
  timestamps: true
});

pushNotificationSchema.index({ user: 1, isRead: 1, sentAt: -1 });

const PushNotification = mongoose.model('PushNotification', pushNotificationSchema);

export default PushNotification;
