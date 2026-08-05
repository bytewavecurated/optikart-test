import mongoose from 'mongoose';

const saleEventSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  bannerImage: { type: String, default: '' },
  categories: [{ type: String, enum: ['sunglasses', 'eyeglasses', 'contactlenses', 'readingglasses', 'sportseyewear', 'kids', 'all'] }],
  discountPercentage: { type: Number, required: true, min: 1, max: 90 },
  isActive: { type: Boolean, default: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  affectedProducts: { type: Number, default: 0 },
  totalDiscountGiven: { type: Number, default: 0 }
}, {
  timestamps: true
});

const SaleEvent = mongoose.model('SaleEvent', saleEventSchema);
export default SaleEvent;
