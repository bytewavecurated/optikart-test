import mongoose from 'mongoose';

const staffRoleSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  name: { type: String, required: [true, 'Name is required'], trim: true },
  role: {
    type: String,
    required: true,
    enum: ['blog_manager', 'doc_verifier', 'user_manager', 'seller_manager', 'finance_manager', 'delivery_manager', 'pickup_manager']
  },
  permissions: [String],
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date }
}, {
  timestamps: true
});

const StaffRole = mongoose.model('StaffRole', staffRoleSchema);
export default StaffRole;
