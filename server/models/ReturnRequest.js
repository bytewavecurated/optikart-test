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
