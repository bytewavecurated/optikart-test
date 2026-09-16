import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const bankAccountSchema = new mongoose.Schema({
  accountNumber: { type: String, required: true },
  ifscCode: { type: String, required: true },
  bankName: { type: String, required: true },
  branchName: { type: String, required: true }
});

const sellerSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  gstNumber: {
    type: String,
    required: [true, 'GST number is required'],
    uppercase: true,
    match: [/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{1}[A-Z\d]{1}$/, 'Invalid GST number format']
  },
  aadharNumber: {
    type: String,
    required: [true, 'Aadhar number is required'],
    match: [/^\d{12}$/, 'Aadhar must be 12 digits']
  },
  panNumber: {
    type: String,
    required: [true, 'PAN number is required'],
    uppercase: true,
    match: [/^[A-Z]{5}\d{4}[A-Z]{1}$/, 'Invalid PAN format']
  },
  bankAccount: {
    type: bankAccountSchema,
    required: [true, 'Bank account details are required']
  },
  storeName: { type: String, required: [true, 'Store name is required'], trim: true },
  storeDescription: { type: String, default: '' },
  storeLogo: { type: String, default: '' },
  storeBanner: { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active' // Changed to active - no subscription required
  },
  subscriptionExpiry: { type: Date },
  razorpaySubscriptionId: { type: String },
  isOnline: { type: Boolean, default: false },
  lastLoginAt: { type: Date },
  loginOtp: { type: String },
  loginOtpExpiry: { type: Date },
  phoneOtp: { type: String },
  phoneOtpExpiry: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalSales: { type: Number, default: 0 },
  totalProducts: { type: Number, default: 0 },
  returnRate: { type: Number, default: 0 },
  avgDeliveryTime: { type: Number, default: 0 },
  performanceScore: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  isShadowBanned: { type: Boolean, default: false },
  banReason: { type: String, default: '' },
  bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  bannedAt: { type: Date },
  sellerId: { type: String, unique: true, sparse: true }
}, {
  timestamps: true
});

sellerSchema.pre('save', function(next) {
  if (!this.sellerId) {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.sellerId = `OPT-${random}`;
  }
  next();
});

sellerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

sellerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

sellerSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.loginOtp;
  delete obj.loginOtpExpiry;
  delete obj.phoneOtp;
  delete obj.phoneOtpExpiry;
  return obj;
};

const Seller = mongoose.model('Seller', sellerSchema);
export default Seller;
