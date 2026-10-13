import ComparisonList from '../models/ComparisonList.js';
import Product from '../models/Product.js';
import crypto from 'crypto';

/**
 * Create a new comparison list
 */
export const createComparisonList = async (userId, name = 'My Comparison') => {
  try {
    const comparisonList = await ComparisonList.create({
      user: userId,
      name,
      products: []
    });

    return {
      success: true,
      comparisonList
    };
  } catch (error) {
    console.error('Error creating comparison list:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Add product to comparison list
 */
export const addToComparison = async (userId, listId, productId) => {
  try {
    const comparisonList = await ComparisonList.findOne({
      _id: listId,
      user: userId
    });

    if (!comparisonList) {
      throw new Error('Comparison list not found');
    }

    // Check if product already in list
    if (comparisonList.products.includes(productId)) {
      throw new Error('Product already in comparison list');
    }

    // Check max products (limit to 4)
    if (comparisonList.products.length >= 4) {
      throw new Error('Maximum 4 products can be compared');
    }

    comparisonList.products.push(productId);
    comparisonList.updatedAt = new Date();
    await comparisonList.save();

    return {
      success: true,
      comparisonList
    };
  } catch (error) {
    console.error('Error adding to comparison:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Remove product from comparison list
 */
export const removeFromComparison = async (userId, listId, productId) => {
  try {
    const comparisonList = await ComparisonList.findOne({
      _id: listId,
      user: userId
    });

    if (!comparisonList) {
      throw new Error('Comparison list not found');
    }

    comparisonList.products = comparisonList.products.filter(
      p => p.toString() !== productId
    );
    comparisonList.updatedAt = new Date();
    await comparisonList.save();

    return {
      success: true,
      comparisonList
    };
  } catch (error) {
    console.error('Error removing from comparison:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get user's comparison lists
 */
export const getUserComparisonLists = async (userId) => {
  try {
    const lists = await ComparisonList.find({ user: userId })
      .populate({
        path: 'products',
        select: 'title brand price images rating totalRatings stock category frameShape frameColor lensType gender frameSize'
      })
      .sort({ updatedAt: -1 });

    return {
      success: true,
      lists
    };
  } catch (error) {
    console.error('Error getting user comparison lists:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get comparison list by ID
 */
export const getComparisonList = async (listId, userId) => {
  try {
    const list = await ComparisonList.findOne({
      _id: listId,
      user: userId
    }).populate({
      path: 'products',
      populate: {
        path: 'seller',
        select: 'storeName rating'
      }
    });

    if (!list) {
      throw new Error('Comparison list not found');
    }

    return {
      success: true,
      list
    };
  } catch (error) {
    console.error('Error getting comparison list:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete comparison list
 */
export const deleteComparisonList = async (userId, listId) => {
  try {
    const list = await ComparisonList.findOneAndDelete({
      _id: listId,
      user: userId
    });

    if (!list) {
      throw new Error('Comparison list not found');
    }

    return {
      success: true,
      message: 'Comparison list deleted'
    };
  } catch (error) {
    console.error('Error deleting comparison list:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generate share token for comparison list
 */
export const generateShareToken = async (userId, listId) => {
  try {
    const list = await ComparisonList.findOne({
      _id: listId,
      user: userId
    });

    if (!list) {
      throw new Error('Comparison list not found');
    }

    // Generate unique share token
    const shareToken = crypto.randomBytes(16).toString('hex');
    
    list.shareToken = shareToken;
    list.isPublic = true;
    list.updatedAt = new Date();
    await list.save();

    return {
      success: true,
      shareToken,
      shareUrl: `/compare/shared/${shareToken}`
    };
  } catch (error) {
    console.error('Error generating share token:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get shared comparison list by token
 */
export const getSharedComparisonList = async (shareToken) => {
  try {
    const list = await ComparisonList.findOne({
      shareToken,
      isPublic: true
    }).populate({
      path: 'products',
      select: 'title brand price images rating totalRatings stock category frameShape frameColor lensType gender frameSize description',
      populate: {
        path: 'seller',
        select: 'storeName rating'
      }
    });

    if (!list) {
      throw new Error('Shared comparison list not found');
    }

    return {
      success: true,
      list
    };
  } catch (error) {
    console.error('Error getting shared comparison list:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Compare products across categories
 */
export const compareAcrossCategories = async (productIds) => {
  try {
    const products = await Product.find({
      _id: { $in: productIds }
    }).populate({
      path: 'seller',
      select: 'storeName rating'
    });

    if (products.length !== productIds.length) {
      throw new Error('Some products not found');
    }

    // Get unique categories
    const categories = [...new Set(products.map(p => p.category))];

    return {
      success: true,
      products,
      categories,
      isCrossCategory: categories.length > 1
    };
  } catch (error) {
    console.error('Error comparing across categories:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  createComparisonList,
  addToComparison,
  removeFromComparison,
  getUserComparisonLists,
  getComparisonList,
  deleteComparisonList,
  generateShareToken,
  getSharedComparisonList,
  compareAcrossCategories
};
