import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const manufacturerStaffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  manufacturer: { type: mongoose.Schema.Types.ObjectId, ref: 'Manufacturer', required: true },
  role: { 
    type: String, 
    required: true,
    enum: ['product_manager', 'order_manager', 'seller_manager', 'inventory_manager']
  },
  permissions: [{
    module: String,
    actions: [String] // 'view', 'create', 'edit', 'delete'
  }],
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date },
  loginOtp: { type: String },
  loginOtpExpiry: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Manufacturer' }
}, {
  timestamps: true
});

// Hash password before saving
manufacturerStaffSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
manufacturerStaffSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data when converting to JSON
manufacturerStaffSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.loginOtp;
  delete obj.loginOtpExpiry;
  return obj;
};

export default mongoose.model('ManufacturerStaff', manufacturerStaffSchema);
