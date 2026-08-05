import mongoose from 'mongoose';

const colorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  hexCode: { type: String },
  images: [String]
});

const poweredOptionSchema = new mongoose.Schema({
  power: { type: Number },
  cyl: { type: Number },
  axis: { type: Number },
  addition: { type: Number }
});

const ratingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  review: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const dimensionsSchema = new mongoose.Schema({
  width: { type: Number },
  height: { type: Number },
  bridge: { type: Number },
  temple: { type: Number }
});

const productSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Title is required'], trim: true },
  description: { type: String, required: [true, 'Description is required'] },
  price: { type: Number, required: [true, 'Price is required'], min: 0 },
  discountedPrice: { type: Number, min: 0 },
  images: [String],
  category: {
    type: String,
    required: true,
    enum: ['sunglasses', 'eyeglasses', 'contactlenses', 'readingglasses', 'sportseyewear', 'kids']
  },
  brand: { type: String, required: [true, 'Brand is required'], trim: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  colors: [colorSchema],
  sizes: [String],
  materials: [String],
  frameType: { type: String },
  frameShape: { type: String },
  frameColor: { type: String },
  lensType: {
    type: String,
    enum: ['nonpowered', 'powered', 'photochromic', 'polarized', 'bluCut']
  },
  hasLenses: { type: Boolean, default: false },
  poweredOptions: [poweredOptionSchema],
  stock: { type: Number, required: true, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
  ratings: [ratingSchema],
  totalRatings: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  tags: [String],
  features: [String],
  dimensions: dimensionsSchema,
  weight: { type: String },
  warranty: { type: String, default: '' },
  returnPolicy: { type: String, default: '7 days return policy' },
  viewCount: { type: Number, default: 0 },
  sellerOffer: {
    type: { type: String, enum: ['none', 'percentage', 'bogo'], default: 'none' },
    value: { type: Number, default: 0 },
    isActive: { type: Boolean, default: false },
    startFrom: { type: Date },
    endAt: { type: Date }
  },
  effectivePrice: { type: Number },
  isUnderSaleEvent: { type: Boolean, default: false },
  saleEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SaleEvent' },
  originalDiscountedPrice: { type: Number },
  gender: { type: String, enum: ['men', 'women', 'unisex', 'kids'], default: 'unisex' },
  frameSize: { type: String, enum: ['small', 'medium', 'large', 'extra-large'], default: 'medium' }
}, {
  timestamps: true
});

productSchema.pre('save', function(next) {
  if (this.isUnderSaleEvent && this.effectivePrice) {
    return next();
  }
  if (this.sellerOffer && this.sellerOffer.isActive && this.sellerOffer.type === 'percentage' && this.sellerOffer.value > 0) {
    this.effectivePrice = Math.round(this.price * (1 - this.sellerOffer.value / 100));
  } else {
    this.effectivePrice = this.discountedPrice || this.price;
  }
  next();
});

productSchema.index({ title: 'text', description: 'text', brand: 'text', tags: 'text' });

const Product = mongoose.model('Product', productSchema);
export default Product;
