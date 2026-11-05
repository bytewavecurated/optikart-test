import mongoose from 'mongoose';

const staffRoleSchema = new mongoose.Schema({
  // The administrator (or, for a desk hire, the executive) who created the
  // account. Optional because an executive can now add their own team member.
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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
  // Which desk the person works in. Executives only see and manage their own.
  department: { type: String, default: '' },
  createdByExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'Executive', default: null },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date }
}, {
  timestamps: true
});

const StaffRole = mongoose.model('StaffRole', staffRoleSchema);
export default StaffRole;
