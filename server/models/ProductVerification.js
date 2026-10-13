import mongoose from 'mongoose';

const productVerificationSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  manufacturer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Manufacturer',
    required: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'needs_update'],
    default: 'pending'
  },
  verificationNotes: String,
  rejectionReason: String,
  updateRequired: [String], // List of fields that need updating
  submittedAt: {
    type: Date,
    default: Date.now
  },
  verifiedAt: Date,
  acceptanceDeadline: Date, // 7 working days from verification
  acceptedByManufacturer: {
    type: Boolean,
    default: false
  },
  acceptedAt: Date
}, {
  timestamps: true
});

productVerificationSchema.index({ manufacturer: 1, status: 1 });
productVerificationSchema.index({ product: 1 });
productVerificationSchema.index({ submittedAt: -1 });

const ProductVerification = mongoose.model('ProductVerification', productVerificationSchema);

export default ProductVerification;
