/**
 * Product Verification Service
 * Handles product verification workflow with email notifications
 */

import Product from '../models/Product.js';
import { sendEmail } from './email.js';

const VERIFICATION_DEADLINE_DAYS = 7;

/**
 * Get pending products for verification
 */
export const getPendingProducts = async (filters = {}) => {
  try {
    const query = { verificationStatus: 'pending' };
    
    if (filters.manufacturer) {
      query.manufacturer = filters.manufacturer;
    }
    if (filters.brand) {
      query.brand = { $regex: filters.brand, $options: 'i' };
    }
    if (filters.category) {
      query.category = filters.category;
    }

    const products = await Product.find(query)
      .populate('manufacturer', 'brandName contactEmail')
      .sort({ submittedAt: 1 });

    return {
      success: true,
      count: products.length,
      products
    };
  } catch (error) {
    console.error('Error getting pending products:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Verify a product
 */
export const verifyProduct = async (productId, adminId, notes = '') => {
  try {
    const product = await Product.findById(productId).populate('manufacturer', 'brandName contactEmail');
    
    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    product.verificationStatus = 'verified';
    product.verifiedBy = adminId;
    product.verifiedAt = new Date();
    product.verificationNotes = notes;
    product.isActive = true;
    
    await product.save();

    // Send email notification to manufacturer
    if (product.manufacturer?.contactEmail) {
      await sendEmail(
        product.manufacturer.contactEmail,
        `Product Verified: ${product.title}`,
        `Your product "${product.title}" (Brand: ${product.brand}) has been verified and is now live on the marketplace.`
      );
    }

    return {
      success: true,
      message: 'Product verified successfully',
      product
    };
  } catch (error) {
    console.error('Error verifying product:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Reject a product
 */
export const rejectProduct = async (productId, adminId, reason) => {
  try {
    const product = await Product.findById(productId).populate('manufacturer', 'brandName contactEmail');
    
    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    product.verificationStatus = 'data_incorrect';
    product.verifiedBy = adminId;
    product.verifiedAt = new Date();
    product.rejectionReason = reason;
    
    await product.save();

    // Send email notification to manufacturer
    if (product.manufacturer?.contactEmail) {
      await sendEmail(
        product.manufacturer.contactEmail,
        `Product Verification Required: ${product.title}`,
        `Your product "${product.title}" (Brand: ${product.brand}) requires data correction.\n\nReason: ${reason}\n\nPlease update the product details and resubmit for verification within ${VERIFICATION_DEADLINE_DAYS} days.`
      );
    }

    return {
      success: true,
      message: 'Product marked for correction',
      product
    };
  } catch (error) {
    console.error('Error rejecting product:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get verification statistics
 */
export const getVerificationStats = async () => {
  try {
    const stats = await Product.aggregate([
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      pending: 0,
      verified: 0,
      rejected: 0,
      data_incorrect: 0,
      total: 0
    };

    stats.forEach(stat => {
      result[stat._id] = stat.count;
      result.total += stat.count;
    });

    return {
      success: true,
      stats: result
    };
  } catch (error) {
    console.error('Error getting verification stats:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  getPendingProducts,
  verifyProduct,
  rejectProduct,
  getVerificationStats
};
