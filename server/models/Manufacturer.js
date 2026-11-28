import mongoose from 'mongoose';
import { installCodes } from '../services/entityIds.js';
import bcrypt from 'bcryptjs';

const manufacturerSchema = new mongoose.Schema(
  {
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
      country: { type: String, default: 'India' },
    },
    bank: {
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      bankName: { type: String, default: '' },
      branchName: { type: String, default: '' },
    },
    /*
     * Onboarding state machine - see services/manufacturerOnboarding.js for the
     * transitions and why a record is not "created" until the company itself
     * has confirmed via token + OTP. `pending_verification` is what a brand-new
     * desk insertion is; `active` is the only state sign-in honours.
     */
    onboarding: {
      state: {
        type: String,
        enum: ['pending_verification', 'pending_otp', 'update_requested', 'active', 'declined'],
        default: 'pending_verification',
      },
      verifyTokenHash: { type: String, default: null, select: false },
      tokenIssuedAt: { type: Date, default: null },
      tokenExpiresAt: { type: Date, default: null },
      lastMailAt: { type: Date, default: null },
      mailDelivered: { type: Boolean, default: false },
      mailNote: { type: String, default: '' },
      verifyClickedAt: { type: Date, default: null },
      activatedAt: { type: Date, default: null },
      recreatedAt: { type: Date, default: null },
      pendingUpdates: { type: mongoose.Schema.Types.Mixed, default: {} },
      updateNote: { type: String, default: '' },
      updateRequestedAt: { type: Date, default: null },
      // Desk overrides write { by, at, reason, incompleteKyc } here. Declared
      // because mongoose silently drops unknown paths in updates - a lost
      // override record would be exactly the unlogged side-door this exists
      // to make loud.
      override: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    website: { type: String, default: '' },
    description: { type: String, default: '' },
    brands: [{ type: String }], // Brands they manufacture
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    bannedAt: { type: Date },
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastLoginAt: { type: Date },
    activationOtp: { type: String, default: null, select: false },
    activationOtpExpiry: { type: Date, default: null },
    activationAttempts: { type: Number, default: 0 },
    loginOtp: { type: String },
    loginOtpExpiry: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturerStaff' }],
  },
  {
    timestamps: true,
  }
);

// Generate unique manufacturer ID
// Hash password before saving
manufacturerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
manufacturerSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data when converting to JSON
manufacturerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.loginOtp;
  delete obj.loginOtpExpiry;
  delete obj.activationOtp;
  // The confirmation token is for the mail only; a console payload that
  // echoed it would re-issue the link to anyone who could read a response.
  if (obj.onboarding) delete obj.onboarding.verifyTokenHash;
  return obj;
};
installCodes(manufacturerSchema, 'manufacturer', 'Manufacturer');

// owner rule 2026-11: demo rows (fixtures) vs live rows (real signups/uploads). Bulk tools may
// only touch demo; live data disappears only through the per-row admin delete paths.
// dataOrigin: 'demo' rows come only from fixtures; 'live' rows are real business. Bulk purge tooling may
// only remove demo data - a live row leaves the database only through services/accountDelete.js (admin click +
// open-business guard). Owner rule 2026-11: real data is never collateral damage.
manufacturerSchema.add({ dataOrigin: { type: String, enum: ['demo', 'live'], default: 'live', index: true } });
export default mongoose.model('Manufacturer', manufacturerSchema);
