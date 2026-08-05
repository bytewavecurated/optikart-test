import mongoose from 'mongoose';

const helpArticleSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Title is required'], trim: true },
  content: { type: String, default: '' },
  category: {
    type: String,
    required: true,
    enum: ['seller_general', 'seller_orders', 'seller_subscription', 'seller_shipping', 'user_orders', 'user_account', 'user_returns', 'user_prescription']
  },
  forRole: {
    type: String,
    required: true,
    enum: ['seller', 'user', 'both'],
    default: 'both'
  },
  faq: { type: Boolean, default: false },
  question: { type: String, default: '' },
  answer: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

const HelpArticle = mongoose.model('HelpArticle', helpArticleSchema);
export default HelpArticle;
