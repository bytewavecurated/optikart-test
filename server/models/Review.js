import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, default: '' },
  comment: { type: String, default: '' },
  images: [String],
  isVerifiedPurchase: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: true },
  helpful: { type: Number, default: 0 },
  reported: { type: Boolean, default: false },
  reportReason: { type: String, default: '' },
  repliedBySeller: { type: Boolean, default: false },
  sellerReply: { type: String, default: '' },
  sellerReplyAt: { type: Date }
}, {
  timestamps: true
});

reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ seller: 1 });
reviewSchema.index({ rating: 1 });

const Review = mongoose.model('Review', reviewSchema);
export default Review;
