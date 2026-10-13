import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';
import { sendPriceDropNotification, sendWishlistPriceDropAlert } from './pushNotifications.js';
import { sendWishlistPriceDropAlert as sendWishlistPriceDropEmail } from './email.js';

/**
 * Check for price drops in user wishlists and send notifications
 */
export const checkWishlistPriceDrops = async () => {
  try {
    // Get all wishlists
    const wishlists = await Wishlist.find().populate('user');

    let notificationsSent = 0;

    for (const wishlist of wishlists) {
      for (const item of wishlist.items) {
        const product = await Product.findById(item.product);
        
        if (!product) continue;

        // Check if price has dropped since item was added
        if (item.addedAtPrice && product.price < item.addedAtPrice) {
          const priceDrop = item.addedAtPrice - product.price;
          const priceDropPercentage = Math.round((priceDrop / item.addedAtPrice) * 100);

          // Only notify if price drop is significant (at least 5%)
          if (priceDropPercentage >= 5) {
            // Send push notification
            await sendPriceDropNotification(
              wishlist.user._id,
              product._id,
              product.title,
              item.addedAtPrice,
              product.price
            );

            // Send email notification
            await sendWishlistPriceDropEmail(
              wishlist.user.email,
              product,
              wishlist.user,
              item.addedAtPrice,
              product.price
            );

            // Update wishlist item to mark as notified
            item.priceDropNotified = true;
            item.lastNotifiedAt = new Date();
            
            notificationsSent++;
          }
        }
      }

      await wishlist.save();
    }

    return {
      success: true,
      notificationsSent
    };
  } catch (error) {
    console.error('Error checking wishlist price drops:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Add product to wishlist with current price
 */
export const addToWishlistWithPrice = async (userId, productId) => {
  try {
    const product = await Product.findById(productId);
    
    if (!product) {
      throw new Error('Product not found');
    }

    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        user: userId,
        items: []
      });
    }

    // Check if product already in wishlist
    const existingItem = wishlist.items.find(
      item => item.product.toString() === productId
    );

    if (existingItem) {
      return {
        success: false,
        message: 'Product already in wishlist'
      };
    }

    // Add to wishlist with current price
    wishlist.items.push({
      product: productId,
      addedAtPrice: product.price,
      addedAt: new Date(),
      priceDropNotified: false
    });

    await wishlist.save();

    return {
      success: true,
      wishlist
    };
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get user wishlist with price drop indicators
 */
export const getUserWishlistWithPriceInfo = async (userId) => {
  try {
    const wishlist = await Wishlist.findOne({ user: userId })
      .populate({
        path: 'items.product',
        select: 'title brand price images stock isActive'
      });

    if (!wishlist) {
      return {
        success: true,
        wishlist: { items: [] }
      };
    }

    // Add price drop information to each item
    const itemsWithInfo = wishlist.items.map(item => {
      const product = item.product;
      const priceDrop = item.addedAtPrice - product.price;
      const priceDropPercentage = item.addedAtPrice > 0 
        ? Math.round((priceDrop / item.addedAtPrice) * 100)
        : 0;

      return {
        ...item.toObject(),
        priceDrop,
        priceDropPercentage,
        hasPriceDrop: priceDrop > 0,
        currentPrice: product.price,
        addedAtPrice: item.addedAtPrice
      };
    });

    return {
      success: true,
      wishlist: {
        _id: wishlist._id,
        items: itemsWithInfo
      }
    };
  } catch (error) {
    console.error('Error getting user wishlist:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  checkWishlistPriceDrops,
  addToWishlistWithPrice,
  getUserWishlistWithPriceInfo
};
