import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  plan: { type: String, enum: ['basic', 'premium', 'enterprise'], default: 'basic' },
  status: { type: String, enum: ['active', 'inactive', 'cancelled', 'expired'], default: 'inactive' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  amount: { type: Number, default: 500 },
  gstAmount: { type: Number, default: 90 },
  totalAmount: { type: Number, default: 590 },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  autoRenew: { type: Boolean, default: false },
  cancelledAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId }
}, {
  timestamps: true
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
