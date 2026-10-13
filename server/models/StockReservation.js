import mongoose from 'mongoose';

const stockReservationSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  reservedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'expired'],
    default: 'active'
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }
}, {
  timestamps: true
});

// Index for efficient querying
stockReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
stockReservationSchema.index({ product: 1, status: 1 });
stockReservationSchema.index({ user: 1, status: 1 });

const StockReservation = mongoose.model('StockReservation', stockReservationSchema);

export default StockReservation;
