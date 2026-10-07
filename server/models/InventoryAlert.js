import mongoose from 'mongoose';

const inventoryAlertSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  type: {
    type: String,
    enum: ['low_stock', 'out_of_stock', 'reorder'],
    required: true
  },
  currentStock: {
    type: Number,
    required: true
  },
  threshold: {
    type: Number,
    default: 10
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

inventoryAlertSchema.index({ seller: 1, isRead: 1, createdAt: -1 });

const InventoryAlert = mongoose.model('InventoryAlert', inventoryAlertSchema);

export default InventoryAlert;
