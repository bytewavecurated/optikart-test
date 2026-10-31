import mongoose from 'mongoose';

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
  // Price edits are emailed and only land once the seller accepts, so the
  // pending figure is held here rather than applied to `sellingPrice`.
  pendingChange: {
    sellingPrice: { type: Number, default: null },
    discountPercent: { type: Number, default: null },
    requestedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
    status: { type: String, enum: ['none', 'awaiting_acceptance', 'accepted', 'declined', 'expired'], default: 'none' }
  }
}, { timestamps: true });

// One row per seller per product.
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
