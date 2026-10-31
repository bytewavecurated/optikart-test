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
  quantity: { type: Number, required: true, min: 1, max: 10 },
  price: { type: Number, required: true }
});

const shippingAddressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  /* Proximity routing needs a point; without these the distance to every seller
     is unknown and no order can ever be routed by location. */
  coordinates: {
    type: [Number],   // [longitude, latitude]
    default: undefined
  },
  lat: { type: Number },
  lng: { type: Number }
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
    enum: ['razorpay', 'cod', 'card', 'upi', 'netbanking', 'wallet'],
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
  couponDiscount: { type: Number, default: 0 },
  // Commission tracking
  commissionPercentage: { type: Number, default: 3 },
  commissionAmount: { type: Number, default: 0 },
  sellerPayoutAmount: { type: Number, default: 0 },
  netAmountToSeller: { type: Number, default: 0 },
  commissionPaid: { type: Boolean, default: false },
  commissionPaidAt: { type: Date },
  commissionRecorded: { type: Boolean, default: false },
  commissionRecordedAt: { type: Date },
  // Order assignment tracking
  assignmentStatus: { 
    type: String, 
    enum: ['pending', 'pending_acceptance', 'accepted', 'rejected', 'admin_required', 'assigned'], 
    default: 'pending' 
  },
  assignmentDeadline: { type: Date },
  assignedAt: { type: Date },
  acceptedAt: { type: Date },
  assignmentDistance: { type: Number }, // in km
  assignmentNotes: { type: String, default: '' },
  // Delivery execution tracking
  assignedExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'Executive', default: null },
  assignedDeliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', default: null },
  deliveryAssignmentMode: { type: String, enum: ['shiprocket', 'self', 'none'], default: 'none' },
  pickupLocation: {
    name: { type: String, default: '' },
    address: { type: String, default: '' },
    lat: { type: Number },
    lng: { type: Number }
  },
  deliveryLocation: {
    address: { type: String, default: '' },
    lat: { type: Number },
    lng: { type: Number }
  },
  deliveryJourney: [{
    status: { type: String },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now }
  }],
  deliveryDistanceKm: { type: Number, default: 0 },
  /* Rs. 59 per product line when the platform delivers the order itself, added
     on top of miscellaneous charges. Shiprocket-fulfilled orders are instead
     billed to the seller at the carrier's own rate. */
  deliveryFee: { type: Number, default: 0 },
  selfDeliveryCharge: { type: Number, default: 0 },
  // Payout tracking
  payoutProcessed: { type: Boolean, default: false },
  deliveredAt: { type: Date }
}, {
  timestamps: true
});

// Human-readable, time-ordered reference. The random suffix keeps it unique
// when two orders land in the same millisecond.
const generateOrderNumber = () => {
  const d = new Date();
  const stamp = [
    String(d.getFullYear()).slice(2),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alike glyphs
  let suffix = '';
  for (let i = 0; i < 5; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  return `OK${stamp}${suffix}`;
};

// Set the reference before validation runs, so `required` can never trip on it.
orderSchema.pre('validate', function(next) {
  if (!this.orderNumber) {
    this.orderNumber = generateOrderNumber();
  }
  next();
});

export { generateOrderNumber };

const Order = mongoose.model('Order', orderSchema);
export default Order;
