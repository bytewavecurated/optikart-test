import mongoose from 'mongoose';

const sellerPayoutSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  payoutNumber: {
    type: String,
    required: true,
    unique: true
  },
  period: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }
  },
  totalSales: {
    type: Number,
    required: true
  },
  platformCommission: {
    type: Number,
    required: true
  },
  netAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  bankDetails: {
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    accountHolderName: { type: String, required: true },
    bankName: { type: String, required: true }
  },
  razorpayTransferId: {
    type: String
  },
  transactionId: {
    type: String
  },
  processedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  failureReason: {
    type: String
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

sellerPayoutSchema.index({ seller: 1, status: 1 });
sellerPayoutSchema.index({ createdAt: -1 });

const SellerPayout = mongoose.model('SellerPayout', sellerPayoutSchema);

export default SellerPayout;
