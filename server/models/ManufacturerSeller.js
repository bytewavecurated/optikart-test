import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const manufacturerSellerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  storeName: { type: String, required: true },
  storeAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  manufacturerSellerId: { type: String, unique: true },
  manufacturerCode: { type: String, required: true }, // Code given by manufacturer
  manufacturer: { type: mongoose.Schema.Types.ObjectId, ref: 'Manufacturer', required: true },
  gstNumber: { type: String, required: true },
  panNumber: { type: String, required: true },
  bankDetails: {
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    bankName: { type: String, required: true },
    branchName: { type: String, required: true }
  },
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: '' },
  bannedAt: { type: Date },
  bannedBy: { type: mongoose.Schema.Types.ObjectId },
  lastLoginAt: { type: Date },
  loginOtp: { type: String },
  loginOtpExpiry: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Manufacturer' }
}, {
  timestamps: true
});

// Generate unique manufacturer seller ID
manufacturerSellerSchema.pre('save', async function(next) {
  if (!this.manufacturerSellerId) {
    const count = await mongoose.model('ManufacturerSeller').countDocuments();
    this.manufacturerSellerId = `MFRS${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Hash password before saving
manufacturerSellerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
manufacturerSellerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data when converting to JSON
manufacturerSellerSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.loginOtp;
  delete obj.loginOtpExpiry;
  return obj;
};

export default mongoose.model('ManufacturerSeller', manufacturerSellerSchema);
