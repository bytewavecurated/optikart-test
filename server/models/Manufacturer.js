import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const manufacturerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  companyName: { type: String, required: true },
  manufacturerId: { type: String, unique: true },
  gstNumber: { type: String },
  panNumber: { type: String },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  brands: [{ type: String }], // Brands they manufacture
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: '' },
  bannedAt: { type: Date },
  bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastLoginAt: { type: Date },
  loginOtp: { type: String },
  loginOtpExpiry: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturerStaff' }]
}, {
  timestamps: true
});

// Generate unique manufacturer ID
manufacturerSchema.pre('save', async function(next) {
  if (!this.manufacturerId) {
    const count = await mongoose.model('Manufacturer').countDocuments();
    this.manufacturerId = `MFR${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Hash password before saving
manufacturerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
manufacturerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data when converting to JSON
manufacturerSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.loginOtp;
  delete obj.loginOtpExpiry;
  return obj;
};

export default mongoose.model('Manufacturer', manufacturerSchema);
