import mongoose from 'mongoose';

const returnRequestSchema = new mongoose.Schema({
  returnId: {
    type: String,
    unique: true,
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    // 'return' refunds the buyer; 'exchange' replaces the item, so it must also
  // satisfy the product's exchangeable flag.
  requestType: { type: String, enum: ['return', 'exchange'], default: 'return' },
  exchangeVariant: {
    color: { type: String, default: '' },
    size: { type: String, default: '' }
  },
  reason: {
      type: String,
      required: true
    },
    description: String,
    images: [String]
  }],
  status: {
    type: String,
    enum: ['requested', 'approved', 'pickup_scheduled', 'picked_up', 'received', 'processing', 'completed', 'rejected'],
    default: 'requested'
  },
  returnShippingLabel: {
    labelUrl: String,
    trackingNumber: String,
    courier: String
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  // Two figures about the original charge, stored rather than derived.
  // `refundAmount` prices the returned lines, so it can never be compared
  // against what the customer paid without knowing what the difference was:
  // delivery, platform fee and the ₹39 cash-handling charge stay with the
  // platform. Without these on the record, the only way to explain the gap is
  // to re-read an order that may have changed since, and a support reply
  // rebuilt from drifting data is how "we never charge that" gets said in
  // good faith about an order that was charged it.
  nonRefundableCodFee: { type: Number, default: 0 },
  orderChargedTotal: { type: Number, default: 0 },
  refundStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  razorpayRefundId: String,
  adminNotes: String,
  requestedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: Date,
  pickedUpAt: Date,
  receivedAt: Date,
  completedAt: Date,
  rejectedAt: Date,
  rejectionReason: String
}, {
  timestamps: true
});

// Generate unique return ID
returnRequestSchema.pre('save', async function(next) {
  if (!this.returnId) {
    const count = await mongoose.model('ReturnRequest').countDocuments();
    this.returnId = `RET${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);

export default ReturnRequest;
