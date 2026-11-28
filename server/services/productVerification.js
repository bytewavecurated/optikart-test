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
    // status defaults to pending; 'all'/'verified'/'rejected' exist because a
    // verification queue without its history is trivia, not a worklist.
    const statusMap = {
      pending: { verificationStatus: 'pending' },
      verified: { verificationStatus: 'verified' },
      rejected: { verificationStatus: 'rejected' },
      all: {},
    };
    const query = { ...(statusMap[filters.status] || statusMap.pending) };

    if (filters.manufacturer) {
      query.manufacturer = filters.manufacturer;
    }
    if (filters.brand) {
      query.brand = { $regex: String(filters.brand).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }
    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.search) {
      const rx = new RegExp(String(filters.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: rx }, { name: rx }, { brand: rx }, { itemCode: rx }, { description: rx }];
    }
    // window + sort + paging stay optional so the public-facing defaults hold
    if (filters.dateFrom || filters.dateTo) {
      const range = {};
      if (filters.dateFrom) range.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) range.$lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
      query.submittedAt = { ...(query.submittedAt || {}), ...range };
    }
    const SORTS = { newest: { submittedAt: -1 }, oldest: { submittedAt: 1 }, brand: { brand: 1 } };
    const page = Math.max(1, parseInt(filters.page || 0, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(filters.limit || 0, 10) || 0) || 0);
    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .populate('manufacturer', 'brandName contactEmail')
      .sort(SORTS[filters.sort] || { submittedAt: 1 })
      .skip(limit ? (page - 1) * limit : 0)
      .limit(limit);
    const pageCount = limit ? Math.max(1, Math.ceil(total / limit)) : 1;

    return {
      success: true,
      count: products.length,
      total,
      page,
      totalPages: pageCount,
      products,
    };
  } catch (error) {
    console.error('Error getting pending products:', error);
    return {
      success: false,
      error: error.message,
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
      product,
    };
  } catch (error) {
    console.error('Error verifying product:', error);
    return {
      success: false,
      error: error.message,
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
      product,
    };
  } catch (error) {
    console.error('Error rejecting product:', error);
    return {
      success: false,
      error: error.message,
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
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      pending: 0,
      verified: 0,
      rejected: 0,
      data_incorrect: 0,
      total: 0,
    };

    stats.forEach((stat) => {
      result[stat._id] = stat.count;
      result.total += stat.count;
    });

    return {
      success: true,
      stats: result,
    };
  } catch (error) {
    console.error('Error getting verification stats:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export default {
  getPendingProducts,
  verifyProduct,
  rejectProduct,
  getVerificationStats,
};
