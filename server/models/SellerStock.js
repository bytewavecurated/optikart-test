import mongoose from 'mongoose';
import { listingApprovalSchema } from './listingApproval.js';

/**
 * A seller's stock of a specific brand product, at their own price.
 *
 * Products carry a single `seller` owner, which cannot express "five shops near
 * this customer all sell the same Ray-Ban Wayfarer, at different prices". Order
 * routing needs exactly that, so it is modelled here rather than inferred.
 *
 * `variants` records which colour/size the seller actually holds, so a buyer's
 * chosen configuration can be matched to a seller who can fulfil it.
 */
const sellerStockVariantSchema = new mongoose.Schema({
  color: { type: String, default: '' },
  size: { type: String, default: '' },
  stock: { type: Number, default: 0, min: 0 },
  price: { type: Number, min: 0 }
}, { _id: false });

const sellerStockSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  brand: { type: String, required: true, index: true },
  modelNumber: { type: String, default: '' },
  category: { type: String, default: '' },
  sellingPrice: { type: Number, required: true, min: 0 },
  mrp: { type: Number, min: 0 },
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  totalStock: { type: Number, default: 0, min: 0 },
  variants: {
    type: [sellerStockVariantSchema],
    default: []
  },
  isReturnable: { type: Boolean, default: true },
  isExchangeable: { type: Boolean, default: true },
  isListed: { type: Boolean, default: true },
  /*
   * Proximity routing reads SellerStock to decide who can fulfil an order, so a
   * claimed brand listing here sends real customers to a shop the brand never
   * supplied. Same contract as a storefront copy, same enforcement.
   */
  listing: { ...listingApprovalSchema, type: mongoose.Schema.Types.Mixed, default: () => ({ brandLinked: false, state: 'live' }) },
  /*
   * The seller's own decision about prescription sales. A frame the
   * manufacturer declares as powered still does not have to be sold that way by
   * every seller, and proximity routing only offers powered orders to sellers
   * who opted in.
   */
  sellsWithPower: { type: Boolean, default: false },
  powerLensTypes: [{ type: String, enum: ['single-vision', 'bifocal', 'progressive', 'reading'] }],
  /*
   * Price edits are emailed and only take effect once the seller accepts them,
   * so the proposed figure is held here rather than applied to `sellingPrice`.
   * The token on the record is what the emailed accept link carries.
   */
  pendingChange: {
    sellingPrice: { type: Number, default: null },
    discountPercent: { type: Number, default: null },
    requestedBy: { type: String, default: '' },
    requestedAt: { type: Date, default: null },
    // Working-day deadline; the proposal lapses once it passes.
    expiresAt: { type: Date, default: null },
    acceptToken: { type: String, default: '' },
    status: { type: String, enum: ['none', 'awaiting_acceptance', 'accepted', 'declined', 'expired'], default: 'none' },
    acceptedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
    // The price that was in force when the proposal was raised, for display.
    proposedFromPrice: { type: Number, default: null }
  }
}, { timestamps: true });

// One row per seller per product.
/*
 * `isListed` is what routing and the "who sells this near me" lookups filter
 * on, so an unapproved brand claim must not be listed - whatever the caller
 * asked for. Pausing keeps variants, price and stock exactly as the seller set
 * them; only visibility stops.
 */
sellerStockSchema.pre('save', function (next) {
  const listing = this.listing || {};
  if (listing.brandLinked === true && listing.state !== 'live' && this.isListed) {
    this.isListed = false;
  }
  next();
});

sellerStockSchema.index({ seller: 1, product: 1 }, { unique: true });
// Fast "who near me sells this brand" lookups.
sellerStockSchema.index({ brand: 1, isListed: 1, totalStock: 1 });

// Keep derived fields consistent so listings and routing cannot disagree.
sellerStockSchema.pre('save', function (next) {
  this.totalStock = (this.variants || []).length
    ? this.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0)
    : this.totalStock;

  if (this.mrp && this.sellingPrice) {
    this.discountPercent = Math.max(
      0,
      Math.round(((this.mrp - this.sellingPrice) / this.mrp) * 100)
    );
  }

  if (this.pendingChange?.requestedAt && this.pendingChange.expiresAt && this.pendingChange.status === 'awaiting_acceptance') {
    if (new Date(this.pendingChange.expiresAt) <= new Date()) {
      this.pendingChange.status = 'expired';
    }
  }
  next();
});

const SellerStock = mongoose.model('SellerStock', sellerStockSchema);
export default SellerStock;
