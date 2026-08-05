import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  phone: { type: String, required: true },
  isDefault: { type: Boolean, default: false }
});

const prescriptionSchema = new mongoose.Schema({
  fileUrl: { type: String, required: true },
  prescriptionType: { type: String, enum: ['single_vision', 'bifocal', 'progressive', 'contact_lens'] },
  lensType: { type: String },
  notes: { type: String, default: '' },
  eyePower: {
    leftEye: { sph: String, cyl: String, axis: String },
    rightEye: { sph: String, cyl: String, axis: String },
    pd: String
  },
  uploadedAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    match: [/^\d{10}$/, 'Please provide a valid 10-digit phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'staff'],
    default: 'user'
  },
  avatar: { type: String, default: '' },
  addresses: [addressSchema],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  prescriptions: [prescriptionSchema],
  resetOtp: { type: String },
  resetOtpExpiry: { type: Date },
  loginOtp: { type: String },
  loginOtpExpiry: { type: Date },
  loginTokenExpiry: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetOtp;
  delete obj.resetOtpExpiry;
  delete obj.loginTokenExpiry;
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
