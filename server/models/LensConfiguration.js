import mongoose from 'mongoose';

const lensConfigurationSchema = new mongoose.Schema({
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
  lensType: {
    type: String,
    enum: ['single-vision', 'bifocal', 'progressive', 'reading', 'computer'],
    required: true
  },
  lensMaterial: {
    type: String,
    enum: ['cr39', 'polycarbonate', 'high-index-1.67', 'high-index-1.74', 'trivex', 'glass'],
    required: true
  },
  lensCoating: {
    type: String,
    enum: ['standard', 'anti-reflective', 'blue-cut', 'photochromic', 'polarized', 'uv-protection'],
    default: 'standard'
  },
  prescription: {
    rightEye: {
      sphere: { type: Number },
      cylinder: { type: Number },
      axis: { type: Number, min: 0, max: 180 },
      addition: { type: Number }
    },
    leftEye: {
      sphere: { type: Number },
      cylinder: { type: Number },
      axis: { type: Number, min: 0, max: 180 },
      addition: { type: Number }
    },
    pd: { type: Number } // pupillary distance
  },
  prescriptionFile: {
    type: String // URL to uploaded prescription
  },
  prescriptionVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  verificationNotes: String,
  additionalPrice: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

lensConfigurationSchema.index({ product: 1, user: 1 });
lensConfigurationSchema.index({ prescriptionVerified: 1 });

const LensConfiguration = mongoose.model('LensConfiguration', lensConfigurationSchema);

export default LensConfiguration;
