import mongoose from 'mongoose';

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
  quantity: { type: Number, required: true, min: 1, default: 1 },
  price: { type: Number, required: true }
});

const prescriptionSchema = new mongoose.Schema({
  fileUrl: { type: String },
  type: { type: String },
  lensPreference: { type: String }
});

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [cartItemSchema],
  totalItems: {
    type: Number,
    default: 0,
    max: [20, 'Cart can have maximum 20 items']
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
