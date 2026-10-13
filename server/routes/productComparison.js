import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  createComparisonList,
  addToComparison,
  removeFromComparison,
  getUserComparisonLists,
  getComparisonList,
  deleteComparisonList,
  generateShareToken,
  getSharedComparisonList,
  compareAcrossCategories
} from '../services/productComparison.js';

const router = express.Router();

/**
 * POST /api/comparison
 * Create a new comparison list
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;

    const result = await createComparisonList(userId, name);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Comparison list created',
        data: result.comparisonList
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in create comparison list route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/comparison
 * Get user's comparison lists
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await getUserComparisonLists(userId);

    if (result.success) {
      res.json({
        success: true,
        data: result.lists
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get comparison lists route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/comparison/:id
 * Get specific comparison list
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await getComparisonList(id, userId);

    if (result.success) {
      res.json({
        success: true,
        data: result.list
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get comparison list route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * DELETE /api/comparison/:id
 * Delete comparison list
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await deleteComparisonList(userId, id);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in delete comparison list route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/comparison/:id/products
 * Add product to comparison list
 */
router.post('/:id/products', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const result = await addToComparison(userId, id, productId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Product added to comparison',
        data: result.comparisonList
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in add to comparison route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * DELETE /api/comparison/:id/products/:productId
 * Remove product from comparison list
 */
router.delete('/:id/products/:productId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, productId } = req.params;

    const result = await removeFromComparison(userId, id, productId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Product removed from comparison',
        data: result.comparisonList
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in remove from comparison route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/comparison/:id/share
 * Generate share token for comparison list
 */
router.post('/:id/share', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await generateShareToken(userId, id);

    if (result.success) {
      res.json({
        success: true,
        message: 'Share token generated',
        data: {
          shareToken: result.shareToken,
          shareUrl: result.shareUrl
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in generate share token route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/comparison/shared/:token
 * Get shared comparison list (public)
 */
router.get('/shared/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await getSharedComparisonList(token);

    if (result.success) {
      res.json({
        success: true,
        data: result.list
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in get shared comparison route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/comparison/compare-categories
 * Compare products across categories
 */
router.post('/compare-categories', async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required'
      });
    }

    const result = await compareAcrossCategories(productIds);

    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error in compare across categories route:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
