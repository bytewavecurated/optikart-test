import mongoose from 'mongoose';

const saleEventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    bannerImage: { type: String, default: '' },
    categories: [
      {
        type: String,
        enum: ['sunglasses', 'eyeglasses', 'contactlenses', 'readingglasses', 'sportseyewear', 'kids', 'all'],
      },
    ],
    /*
     * Brands the event covers; empty means every brand in the category scope.
     * A festival offer ('40% off all Ray-Ban for Durga Puja') is precisely
     * brands:[Ray-Ban] + category scope + the window; matching against the
     * catalogue's brand spellings is case/whitespace-insensitive, folding like
     * the storefront brand routes do - exact-match would make an offer quietly
     * skip rows whose stored brand is cased differently.
     */
    brands: { type: [String], default: [] },
    discountPercentage: { type: Number, required: true, min: 1, max: 90 },
    isActive: { type: Boolean, default: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    affectedProducts: { type: Number, default: 0 },
    totalDiscountGiven: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

const SaleEvent = mongoose.model('SaleEvent', saleEventSchema);
export default SaleEvent;
