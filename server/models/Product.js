import mongoose from 'mongoose';
import { listingApprovalSchema, pushListingEvent } from './listingApproval.js';

const colorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  hexCode: { type: String },
  images: [String]
});

const variantSchema = new mongoose.Schema({
  color: { type: String },
  size: { type: String },
  gender: { type: String, enum: ['men', 'women', 'unisex', 'kids'] },
  price: { type: Number, min: 0 },
  originalPrice: { type: Number, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  sku: { type: String },
  images: [String],
  isActive: { type: Boolean, default: true }
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


// Contact-lens specific specification. Only meaningful for category
// 'contactlenses'; validated on save so a lens product cannot be published
// without the information the buyer's power grid depends on.
const contactLensSchema = new mongoose.Schema({
  // Which configurator the product page must open.
  powerType: {
    type: String,
    enum: ['distance', 'toric', 'multifocal', 'none'],
    default: 'distance'
  },
  // Whether a zero-power (non-prescription) version may be ordered.
  // Colour lenses allow it; clear distance/toric/multifocal stocks usually do not.
  allowsZeroPower: { type: Boolean, default: false },
  // Whether prescription powers can be ordered at all for this SKU.
  withPowerAvailable: { type: Boolean, default: true },
  SphereLeftMin: { type: Number, default: -10 },
  SphereLeftMax: { type: Number, default: 4 },
  SphereRightMin: { type: Number, default: -10 },
  SphereRightMax: { type: Number, default: 4 },
  // Toric (cylindrical) correction, in quarter-step powers.
  cylinderMin: { type: Number, default: -2.25 },
  cylinderMax: { type: Number, default: -0.75 },
  axisMin: { type: Number, default: 1 },
  axisMax: { type: Number, default: 180 },
  // Multifocal addition.
  additionMin: { type: Number, default: 0.75 },
  additionMax: { type: Number, default: 2.5 },
  step: { type: Number, default: 0.25 },
  axisStep: { type: Number, default: 10 },
  // Lenses shipped per box: 1 (trial), 2, 3, 6, 10, 30, 90.
  lensesPerBox: { type: Number, default: 6, min: 1 },
  replacementPeriod: {
    type: String,
    enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'halfyearly', 'yearly'],
    default: 'monthly'
  },
  waterContent: { type: Number, min: 0, max: 100 },   // percentage
  diameter: { type: Number },                           // mm, typically 13.8-14.5
  baseCurve: { type: Number },                          // mm, typically 8.3-9.0
  // Colour lenses only: the shade this SKU represents.
  colorTone: { type: String, default: '' },
  isCosmetic: { type: Boolean, default: false },
  materialName: { type: String, default: '' },           // e.g. Polafil, Omafilcon A
  uvProtection: { type: Boolean, default: false },
  // Combos ship a set of shades, one per weekday, with no power selection.
  comboShades: [{ name: { type: String, default: '' }, day: { type: String, default: '' } }]
}, { _id: false });

// Solution and accessory specifics (multi-volume, multipack price breaks).
const solutionSchema = new mongoose.Schema({
  volumeMl: { type: Number, min: 0 },
  // Per-bottle price for a chosen pack size, so 3 x 120 ml can be cheaper each.
  packPricing: [{
    packSize: { type: Number, min: 1, default: 1 },
    price: { type: Number, min: 0 }
  }],
  suitableFor: [{ type: String, enum: ['soft', 'silicone-hydrogel', 'rigid-gas-permeable', 'coloured', 'extended-wear'] }],
  disinfects: { type: Boolean, default: true },
  peroxideBased: { type: Boolean, default: false },
  preservativeFree: { type: Boolean, default: false },
  volumePerBottle: { type: String, default: '' }
}, { _id: false });

const accessorySchema = new mongoose.Schema({
  accessoryType: { type: String, enum: ['case', 'twezers', 'applicator', 'suction-cup', 'travel-pouch', 'cleaning-kit'], default: 'case' },
  materialName: { type: String, default: '' },
  compartmentCount: { type: Number, default: 1 },
  colours: [String]
}, { _id: false });

const productSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Title is required'], trim: true },
  /*
   * Order line snapshots, cart rows, the comparison table, the lens
   * configurator and several admin screens read `product.name`. The field did
   * not exist, so the product page rendered an empty heading, an empty
   * breadcrumb and image descriptions with nothing in them. It mirrors `title`
   * on save - a virtual would not survive the lean() queries these routes use.
   */
  name: { type: String, trim: true },
  description: { type: String, required: [true, 'Description is required'] },
  price: { type: Number, required: [true, 'Price is required'], min: 0 },
  discountedPrice: { type: Number, min: 0 },
  images: [String],
  category: {
    type: String,
    required: true,
    enum: [
      'sunglasses', 'eyeglasses', 'contactlenses', 'readingglasses',
      'sportseyewear', 'kids',
      // Consumables browsed from the Contact Lenses menu.
      'solution', 'accessories'
    ]
  },
  brand: { type: String, required: [true, 'Brand is required'], trim: true },
  /*
   * A seller owns a normal listing, but a manufacturer registers a catalogue
   * entry before any shop has agreed to stock it. Requiring the seller there
   * made the manufacturer "add single product" form fail every time it was
   * submitted, so the requirement is conditional on the document type.
   */
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: function () { return !this.isManufacturerProduct; }
  },
  colors: [colorSchema],
  sizes: [String],
  variants: [variantSchema],
  materials: [String],
  frameType: { 
    type: String,
    enum: ['full-rim', 'half-rim', 'rimless', 'Full Rim', 'Half Rim', 'Rimless']
  },
  frameShape: { 
    type: String,
    enum: ['rectangle', 'cateye', 'oval', 'aviator', 'geometric', 'round', 'square', 'wayfarer', 'cat-eye', 'Rectangle', 'Cat Eye', 'Oval', 'Aviator', 'Round', 'Wayfarer', 'Browline', 'Oversized', 'Wraparound', 'Geometric']
  },
  frameColor: { type: String },
  frameMaterial: {
    type: String,
    enum: ['acetate', 'metal', 'polycarbonate', 'stainless-steel', 'tr90', 'titanium', 'plastic', 'wood']
  },
  frameWeight: { type: Number }, // in grams
  frameWidth: { type: Number }, // in mm
  modelNumber: { type: String },
  productCode: { type: String },
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
  /* Days after delivery in which a return/exchange is accepted for THIS product.
     Overrides the platform window, so a clearance pair can be final sale while a
     regular frame allows 7 days. */
  returnWindowDays: { type: Number, default: 7, min: 0 },
  /* Sub-gender for kids wear, so the kids browse can split boys and girls
     without inventing a new top-level category. */
  subGender: { type: String, enum: ['', 'boys', 'girls'], default: '' },
  ageGroup: { type: String, enum: ['', '0-3', '3-6', '6-9', '9-12', '12-15', 'adult'], default: '' },
  /* Manufacturer declaration that this frame can be made with prescription
     lenses. Sunglasses default to false - a plain pair is Buy Now, a powered one
     offers the lens configurator. */
  poweredOptionsAvailable: { type: Boolean, default: false },
  // Which prescription styles the lab can glaze into this frame; drives the
  // choices offered by the lens configurator.

  prescriptionLensTypes: [{ type: String, enum: ['single-vision', 'bifocal', 'progressive', 'reading'] }],
  contactLens: { type: contactLensSchema, default: null },
  solution: { type: solutionSchema, default: null },
  accessory: { type: accessorySchema, default: null },
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
  frameSize: { type: String, enum: ['small', 'medium', 'large', 'extra-large'], default: 'medium' },
  // Commission fields - 3% platform commission
  commissionPercentage: { type: Number, default: 3, min: 0, max: 100 },
  isSponsored: { type: Boolean, default: false },
  sponsoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
  sponsoredAt: { type: Date },
  // Manufacturer fields
  manufacturer: { type: mongoose.Schema.Types.ObjectId, ref: 'Manufacturer' },
  isManufacturerProduct: { type: Boolean, default: false },
  isDiscontinued: { type: Boolean, default: false },
  discontinuedAt: { type: Date },
  discontinuedBy: { type: mongoose.Schema.Types.ObjectId },
  manufacturerSellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturerSeller' },
  /*
   * Which brand catalogue entry this shop's copy was made from.
   *
   * The toggle route has written this field since it was first coded, but the
   * schema never declared it, so Mongoose dropped it on save - and the copy
   * could never be found again. The visible symptom was the retailer's own: a
   * shop toggling a product off then on again accumulated duplicate listings
   * of the same frame, because the code that "removes the existing copy" had
   * nothing to match on, and every approval queue that asks "which brand is
   * this a claim about" had no answer.
   */
  manufacturerProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
  // Movement audit so a stock number can always be explained, and so a
  // cancellation/return is never applied twice.
  stockMovementLog: [{
    type: { type: String, enum: ['in', 'out'], required: true },
    quantity: { type: Number, required: true, min: 0 },
    reason: { type: String, default: 'sale' },
    order: { type: String, default: '' },
    variant: { type: String, default: null },
    at: { type: Date, default: Date.now }
  }],
  /*
   * The supply claim behind this listing. For a retailer's copy of a brand
   * product this is what says whether the brand actually supplied them, and no
   * amount of `status` juggling in a route can make the copy sellable while it
   * says otherwise - the pre-save hook below enforces that rather than trusting
   * the caller.
   */
  listing: { ...listingApprovalSchema, type: mongoose.Schema.Types.Mixed, default: () => ({ brandLinked: false, state: 'live' }) },

  // Return and exchange policy
  isReturnable: { type: Boolean, default: true },
  isExchangeable: { type: Boolean, default: true }
}, {
  timestamps: true
});


/**
 * Category-specific mandatory data. A frame, a lens, a bottle of solution and a
 * lens case are all "products" here, but each needs a different set of
 * attributes before the storefront can render it or the configurator can run.
 * Manufacturers must supply these on single add and on bulk upload alike.
 */
productSchema.pre('validate', function (next) {
  const errors = [];
  const push = (field, message) => errors.push({ path: field, message });
  const isLens = this.category === 'contactlenses';
  const isSolution = this.category === 'solution';
  const isAccessory = this.category === 'accessories';
  const isEyewear = ['sunglasses', 'eyeglasses', 'readingglasses', 'sportseyewear', 'kids'].includes(this.category);

  if (isLens) {
    const cl = this.contactLens || {};
    if (!cl.powerType) push('contactLens.powerType', 'Contact lenses need a power type (distance, toric, multifocal or none).');
    if (!cl.replacementPeriod) push('contactLens.replacementPeriod', 'Replacement period is required (daily, weekly, monthly ...).');
    if (!cl.lensesPerBox || cl.lensesPerBox < 1) push('contactLens.lensesPerBox', 'Lenses per box is required, e.g. 1, 2, 3, 6, 30 or 90.');
    if (!cl.diameter) push('contactLens.diameter', 'Diameter in mm is required for contact lenses.');
    if (!cl.baseCurve) push('contactLens.baseCurve', 'Base curve in mm is required for contact lenses.');
    if (cl.powerType === 'toric' && (!(cl.cylinderMax < 0) || !cl.axisMax)) {
      push('contactLens.cylinderMax', 'Toric lenses need a cylinder range and an axis range.');
    }
    if (cl.powerType === 'multifocal' && !(cl.additionMax > cl.additionMin)) {
      push('contactLens.additionMax', 'Multi-focal lenses need an ADD range.');
    }
    // A colour lens may be bought plain; a clear corrective lens may not.
    if (cl.isCosmetic && !cl.allowsZeroPower) {
      push('contactLens.allowsZeroPower', 'Colour lenses must state whether a zero-power option is offered.');
    }
  }

  if (isSolution) {
    const sol = this.solution || {};
    if (!sol.volumeMl) push('solution.volumeMl', 'Solution needs a bottle volume in ml.');
    if (!Array.isArray(sol.packPricing) || sol.packPricing.length === 0) {
      push('solution.packPricing', 'Solution needs at least one pack price so multi-buy can be priced.');
    }
  }

  if (isAccessory) {
    if (!this.accessory?.accessoryType) push('accessory.accessoryType', 'Accessories need a type (case, tweezers, travel pouch ...).');
  }

  if (isEyewear) {
    if (!this.frameShape) push('frameShape', 'Frame shape is required so the face-shape browse can list this product.');
    if (!this.frameType) push('frameType', 'Frame type (full rim, half rim, rimless) is required.');
    if (!this.frameMaterial) push('frameMaterial', 'Frame material is required.');
    if (!this.gender) push('gender', 'Gender is required (men, women, unisex, kids).');
    if (this.gender === 'kids' || this.category === 'kids') {
      if (!this.subGender) push('subGender', 'Kids frames must be marked boys or girls.');
      if (!this.ageGroup) push('ageGroup', 'Kids frames must state an age group.');
    }
    // Sunglasses that can carry a prescription must say what the lab can make.
    if (this.category === 'sunglasses' && this.poweredOptionsAvailable) {
      if (!Array.isArray(this.prescriptionLensTypes) || this.prescriptionLensTypes.length === 0) {
        push('prescriptionLensTypes', 'Powered sunglasses must list the prescription lens types offered.');
      }
    }
    if (this.category === 'eyeglasses' && this.poweredOptionsAvailable) {
      if (!Array.isArray(this.prescriptionLensTypes) || this.prescriptionLensTypes.length === 0) {
        push('prescriptionLensTypes', 'Eyeglasses sold with lenses must list the prescription lens types offered.');
      }
    }
  }

  if (errors.length) {
    // Report through Mongoose's own validation machinery so the API's existing
    // ValidationError handler turns this into a clean per-field list.
    errors.forEach(({ path, message }) => {
      this.invalidate(path, message, this.get(path));
    });
  }
  next();
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

productSchema.pre('validate', function mirrorNameFromTitle() {
  const title = (this.title || '').trim();
  if (title) this.name = title;
});

productSchema.pre('save', function keepNameInStepWithEdits() {
  if (this.isModified('title') && this.title) this.name = this.title;
});

productSchema.post('init', function backfillMissingName(doc) {
  if (!doc.name && doc.title) doc.name = doc.title;
});

/**
 * Records written before `name` existed have nothing in it, and the routes that
 * answer with lean() documents bypass the hook above, so existing rows are
 * filled in place. Idempotent.
 */
productSchema.statics.fillMissingNames = async function fillMissingNames() {
  const res = await this.updateMany(
    { title: { $exists: true, $nin: [null, ''] }, $or: [{ name: { $exists: false } }, { name: null }, { name: '' }] },
    [{ $set: { name: '$title' } }]
  );
  return res.modifiedCount ?? 0;
};

/*
 * A brand product that has not cleared both approvals cannot be `verified`, and
 * a listing the seller chose not to sell cannot be `live`.
 *
 * This is a model rule rather than a route rule on purpose. The retailer toggle,
 * the bulk upload, the admin edit form, a seed, and a future endpoint I have not
 * written yet all write these documents; one guard here covers all of them, and
 * the audit that checks this behaviour goes through the HTTP API, where the
 * consequence is what matters.
 */
productSchema.pre('save', function (next) {
  const listing = this.listing || {};
  /*
   * Only a save that changed the listing itself may downgrade verification.
   *
   * Without this condition the rule reached into unrelated writes - a view
   * counter bump, an image edit, a price change - and could move a product that
   * had been verified out of the storefront, silently. That is exactly the kind
   * of guard that must only fire on the transition it is about: the listing
   * state and the verification flag are written together by
   * services/listingApproval.js, and nothing else should touch the pair.
   */
  const listingChanged = this.isModified('listing');
  if (listingChanged && listing.brandLinked === true && listing.state !== 'live') {
    if (this.isModified('verificationStatus') || this.verificationStatus === 'verified') {
      this.verificationStatus = 'pending';
      if (listing.state === 'awaiting_manufacturer') {
        listing.manufacturerReview = { ...(listing.manufacturerReview || {}), status: 'pending', at: new Date() };
      }
    }
  }
  next();
});

const Product = mongoose.model('Product', productSchema);
export default Product;

// Add verification fields
productSchema.add({
  verificationStatus: { 
    type: String, 
    enum: ['pending', 'verified', 'rejected', 'data_incorrect'], 
    default: 'pending' 
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  verificationNotes: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
  lastUpdatedAt: { type: Date, default: Date.now }
});
