import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variant: {
    color: String,
    size: String,
    lensType: String,
    power: Number,
    cyl: Number,
    axis: Number
  },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true }
});

const shippingAddressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String }
});

const prescriptionSchema = new mongoose.Schema({
  fileUrl: { type: String },
  type: { type: String },
  lensPreference: { type: String }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  items: [orderItemSchema],
  shippingAddress: { type: shippingAddressSchema, required: true },
  subtotal: { type: Number, required: true },
  deliveryCharge: { type: Number, default: 0 },
  shiprocketDeliveryCharge: { type: Number, default: 0 },
  platformFee: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  paymentMethod: {
    type: String,
    enum: ['razorpay'],
    default: 'razorpay'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentId: { type: String },
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'packed', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'return_requested', 'returned'],
    default: 'pending'
  },
  shiprocketOrderId: { type: String },
  shiprocketTrackingId: { type: String },
  shiprocketTrackingUrl: { type: String },
  pickupDate: { type: Date },
  deliveryDate: { type: Date },
  cancellationReason: { type: String },
  returnReason: { type: String },
  prescription: prescriptionSchema,
  couponApplied: { type: String },
  couponDiscount: { type: Number, default: 0 }
}, {
  timestamps: true
});

orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.orderNumber = `ORD-${code}`;
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);
export default Order;
