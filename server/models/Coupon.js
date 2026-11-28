import mongoose from 'mongoose';

const usedBySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  usedAt: { type: Date, default: Date.now },
});

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: { type: String, default: '' },
    discountType: {
      type: String,
      required: true,
      enum: ['percentage', 'fixed'],
    },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    usageLimit: { type: Number, default: 0 },
    usedBy: [usedBySchema],
    usageCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    applicableCategories: [String],
    /*
     * A voucher can be limited to named brands (empty = any brand the category
     * rule allows). Stored-only before; now enforced by BOTH redemption doors
     * through services/couponScope - see the group 'offers scopes & sale events'.
     */
    applicableBrands: [String],
  },
  {
    timestamps: true,
  }
);

// owner rule 2026-11: demo rows (fixtures) vs live rows (real signups/uploads). Bulk tools may
// only touch demo; live data disappears only through the per-row admin delete paths.
// dataOrigin: 'demo' rows come only from fixtures; 'live' rows are real business. Bulk purge tooling may
// only remove demo data - a live row leaves the database only through services/accountDelete.js (admin click +
// open-business guard). Owner rule 2026-11: real data is never collateral damage.
couponSchema.add({ dataOrigin: { type: String, enum: ['demo', 'live'], default: 'live', index: true } });
const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
