import mongoose from 'mongoose';

const lensConfigSchema = new mongoose.Schema({
  // 'spectacle' for the lens configurator on frames; 'contact-lens' for the
  // per-eye power grid on loose lenses.
  kind: { type: String, enum: ['spectacle', 'contact-lens'], default: 'spectacle' },
  powerType: { type: String, enum: ['distance', 'toric', 'multifocal', 'none'], default: 'distance' },
  withPower: { type: Boolean, default: true },
  lensesPerBox: { type: Number, default: 1 },
  boxesPerLine: { type: Boolean, default: false },
  replacement: { type: String, default: '' },
  colour: { type: String, default: '' },
  lensType: { type: String },
  lensPackage: { type: String },
  coating: { type: String },
  power: {
    // Contact lenses store a per-eye object (sphere/cylinder/axis/addition);
    // spectacle lenses continue to use the flat fields below.
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  sphereLeft: { type: String, default: '' },
  sphereRight: { type: String, default: '' },
  cylLeft: { type: String, default: '' },
  cylRight: { type: String, default: '' },
  axisLeft: { type: String, default: '' },
  axisRight: { type: String, default: '' },
  addLeft: { type: String, default: '' },
  addRight: { type: String, default: '' },
  prescriptionMethod: { type: String, enum: ['manual', 'upload', 'none'], default: 'none' },
  prescriptionFileUrl: { type: String, default: '' },
  prescriptionPrice: { type: Number, default: 0 }
}, { _id: false });

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variant: {
    color: String,
    size: String,
    lensType: String,
    power: Number,
    cyl: Number,
    axis: Number
  },
  lensConfig: { type: lensConfigSchema, default: null },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  price: { type: Number, required: true }
});

const prescriptionSchema = new mongoose.Schema({
  fileUrl: { type: String },
  type: { type: String },
  lensPreference: { type: String }
});

// Logged-in users may hold up to 25 line items in the cart.
const MAX_CART_ITEMS = 25;

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: {
    type: [cartItemSchema],
    validate: {
      validator: (v) => v.length <= MAX_CART_ITEMS,
      message: `Cart can have a maximum of ${MAX_CART_ITEMS} items`
    }
  },
  totalItems: {
    type: Number,
    default: 0,
    max: [MAX_CART_ITEMS, `Cart can have a maximum of ${MAX_CART_ITEMS} items`]
  },
  prescription: prescriptionSchema
}, {
  timestamps: true
});

cartSchema.pre('save', function(next) {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  next();
});

const Cart = mongoose.model('Cart', cartSchema);
export default Cart;
export { MAX_CART_ITEMS };
