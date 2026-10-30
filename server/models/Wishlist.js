import mongoose from 'mongoose';

// Logged-in users may save up to 30 products on their wishlist.
// Guests are limited to 3 on the client side (see pages/Wishlist.js).
const MAX_WISHLIST_ITEMS = 30;

const wishlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  products: {
    type: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      addedAt: { type: Date, default: Date.now }
    }],
    validate: {
      validator: (v) => v.length <= MAX_WISHLIST_ITEMS,
      message: `Wishlist can have a maximum of ${MAX_WISHLIST_ITEMS} items`
    }
  }
}, {
  timestamps: true
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);
export default Wishlist;
export { MAX_WISHLIST_ITEMS };
