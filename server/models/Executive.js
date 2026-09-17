import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const executiveSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  department: { 
    type: String, 
    required: true,
    enum: ['delivery', 'staff', 'users', 'sellers', 'manufacturers', 'orders', 'products']
  },
  executiveId: { type: String, unique: true },
  permissions: [{
    module: String,
    actions: [String] // 'view', 'create', 'edit', 'delete'
  }],
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
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Generate unique executive ID
executiveSchema.pre('save', async function(next) {
  if (!this.executiveId) {
    const count = await mongoose.model('Executive').countDocuments();
    this.executiveId = `EXEC${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Hash password before saving
executiveSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
executiveSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data when converting to JSON
executiveSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.loginOtp;
  delete obj.loginOtpExpiry;
  return obj;
};

export default mongoose.model('Executive', executiveSchema);
