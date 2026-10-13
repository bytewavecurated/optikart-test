import mongoose from 'mongoose';

const prescriptionVerificationSchema = new mongoose.Schema({
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin or staff
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'needs_review'],
    default: 'pending'
  },
  validationResults: {
    isValidFormat: Boolean,
    hasRightEye: Boolean,
    hasLeftEye: Boolean,
    hasPD: Boolean,
    sphereRange: Boolean,
    cylinderRange: Boolean,
    axisRange: Boolean,
    pdRange: Boolean,
    flags: [String]
  },
  adminNotes: String,
  rejectionReason: String,
  verifiedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

prescriptionVerificationSchema.index({ user: 1, status: 1 });
prescriptionVerificationSchema.index({ createdAt: -1 });

const PrescriptionVerification = mongoose.model('PrescriptionVerification', prescriptionVerificationSchema);

export default PrescriptionVerification;
