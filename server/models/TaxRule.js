import mongoose from 'mongoose';

/**
 * Tax classification rules for invoicing.
 *
 * The DEFAULT tables (services/gst.js - HSN by product category, rate by
 * item kind) cover normal eyewear retail, but classification is a tax
 * question, not a code question: a brand may register at a different slab,
 * or a category's rate may move by notification. This model lets the
 * platform override at three scopes (category → brand → product, most
 * specific wins) WITHOUT touching catalogue prices.
 *
 * Honest status: `confirmed:false` until someone with a CA signs it off -
 * the PRODUCTION-CHECKLIST carries the verification action, and every PDF
 * prints the declared HSN/SAC as the platform's classification of record.
 */
const taxRuleSchema = new mongoose.Schema(
  {
    scope: { type: String, enum: ['category', 'brand', 'product'], required: true },
    value: { type: String, required: true }, // category slug / brand name / product id - unique per scope below
    hsn: { type: String, required: true, trim: true },
    ratePercent: { type: Number, required: true, min: 0, max: 43.01 },
    confirmed: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

taxRuleSchema.index({ scope: 1, value: 1 }, { unique: true });

const TaxRule = mongoose.models.TaxRule || mongoose.model('TaxRule', taxRuleSchema);

export default TaxRule;
