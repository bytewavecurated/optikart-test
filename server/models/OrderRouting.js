import mongoose from 'mongoose';

const orderRoutingSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  customerLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  nearbySellers: [{
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller'
    },
    distance: Number, // in km
    hasProduct: Boolean,
    contactedAt: Date,
    respondedAt: Date,
    response: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'timeout']
    }
  }],
  currentSellerIndex: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['routing', 'seller_contacted', 'seller_accepted', 'seller_rejected', 'timeout', 'admin_assigned', 'completed'],
    default: 'routing'
  },
  assignedSeller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller'
  },
  assignedBy: {
    type: String,
    enum: ['auto', 'admin', 'ai'],
    default: 'auto'
  },
  timeoutAt: Date,
  completedAt: Date,
  adminNotes: String,
  aiDecision: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

orderRoutingSchema.index({ order: 1 });
orderRoutingSchema.index({ status: 1 });
orderRoutingSchema.index({ createdAt: -1 });

const OrderRouting = mongoose.model('OrderRouting', orderRoutingSchema);

export default OrderRouting;
