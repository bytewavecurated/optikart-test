import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const deliveryPartnerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  deliveryPartnerId: { type: String, unique: true },
  vehicleType: {
    type: String,
    enum: ['bike', 'car', 'van', 'truck'],
    required: true
  },
  vehicleNumber: { type: String, required: true },
  licenseNumber: { type: String, required: true },
  aadharNumber: { type: String, required: true },
  panNumber: { type: String, required: true },
  bankDetails: {
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    bankName: { type: String, required: true },
    branchName: { type: String, required: true }
  },
  currentLocation: {
    latitude: Number,
    longitude: Number,
    updatedAt: Date
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: { type: String, default: '' },
  bannedAt: { type: Date },
  bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  totalDeliveries: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  pendingEarnings: { type: Number, default: 0 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalRatings: { type: Number, default: 0 },
  lastLoginAt: { type: Date },
  loginOtp: { type: String },
  loginOtpExpiry: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  currentOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  assignedBy: {
    type: String,
    enum: ['auto', 'admin', 'seller'],
    default: 'auto'
  },
  // Withdrawals: one per day, flat Rs. 3 platform fee per started Rs. 50 slab.
  lastWithdrawalAt: { type: Date, default: null },
  totalWithdrawn: { type: Number, default: 0 },
  totalPlatformFees: { type: Number, default: 0 },
  withdrawals: [{
    amount: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    netPaid: { type: Number, required: true },
    payoutId: { type: String, default: '' },
    status: { type: String, enum: ['initiated', 'processed', 'failed'], default: 'processed' },
    at: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Generate unique delivery partner ID
deliveryPartnerSchema.pre('save', async function(next) {
  if (!this.deliveryPartnerId) {
    const count = await mongoose.model('DeliveryPartner').countDocuments();
    this.deliveryPartnerId = `DP${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Hash password before saving
deliveryPartnerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
deliveryPartnerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data when converting to JSON
deliveryPartnerSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.loginOtp;
  delete obj.loginOtpExpiry;
  return obj;
};

const DeliveryPartner = mongoose.model('DeliveryPartner', deliveryPartnerSchema);

export default DeliveryPartner;
