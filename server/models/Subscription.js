import mongoose from 'mongoose';

const paymentHistorySchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true },
  razorpayPaymentId: { type: String },
  status: { type: String, enum: ['success', 'failed', 'pending'] }
});

const subscriptionSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  amount: { type: Number, default: 500 },
  gstAmount: { type: Number, default: 90 },
  totalAmount: { type: Number, default: 590 },
  razorpaySubscriptionId: { type: String },
  razorpayPaymentId: { type: String },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  autoRenew: { type: Boolean, default: true },
  paymentHistory: [paymentHistorySchema]
}, {
  timestamps: true
});

subscriptionSchema.pre('save', function(next) {
  if (!this.endDate) {
    const start = this.startDate || new Date();
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    this.endDate = end;
  }
  next();
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
