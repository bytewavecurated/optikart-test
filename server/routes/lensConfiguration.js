import express from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/auth.js';
import LensConfiguration from '../models/LensConfiguration.js';
import Product from '../models/Product.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * POST /api/lens-configuration
 * Create lens configuration for a product
 */
router.post('/', verifyToken, upload.single('prescription'), async (req, res) => {
  try {
    const {
      productId,
      lensType,
      lensMaterial,
      lensCoating,
      prescription,
      additionalPrice
    } = req.body;

    const userId = req.user.id;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Only allow lens configuration for eyeglasses
    if (product.category !== 'eyeglasses') {
      return res.status(400).json({
        success: false,
        message: 'Lens configuration is only available for eyeglasses'
      });
    }

    // Create lens configuration
    const configData = {
      product: productId,
      user: userId,
      lensType,
      lensMaterial,
      lensCoating: lensCoating || 'standard',
      prescription: prescription ? JSON.parse(prescription) : undefined,
      additionalPrice: additionalPrice || 0
    };

    // Handle prescription file upload
    if (req.file) {
      // In production, upload to Cloudinary/S3
      // For now, store as base64
      configData.prescriptionFile = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const lensConfig = await LensConfiguration.create(configData);

    res.status(201).json({
      success: true,
      message: 'Lens configuration created',
      data: lensConfig
    });
  } catch (error) {
    console.error('Error creating lens configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/lens-configuration/:productId
 * Get lens configuration for a product
 */
router.get('/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const lensConfig = await LensConfiguration.findOne({
      product: productId,
      user: userId
    });

    if (!lensConfig) {
      return res.status(404).json({
        success: false,
        message: 'Lens configuration not found'
      });
    }

    res.json({
      success: true,
      data: lensConfig
    });
  } catch (error) {
    console.error('Error getting lens configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * PUT /api/lens-configuration/:id
 * Update lens configuration
 */
router.put('/:id', verifyToken, upload.single('prescription'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const lensConfig = await LensConfiguration.findOne({
      _id: id,
      user: userId
    });

    if (!lensConfig) {
      return res.status(404).json({
        success: false,
        message: 'Lens configuration not found'
      });
    }

    // Update fields
    const {
      lensType,
      lensMaterial,
      lensCoating,
      prescription,
      additionalPrice
    } = req.body;

    if (lensType) lensConfig.lensType = lensType;
    if (lensMaterial) lensConfig.lensMaterial = lensMaterial;
    if (lensCoating) lensConfig.lensCoating = lensCoating;
    if (prescription) lensConfig.prescription = JSON.parse(prescription);
    if (additionalPrice) lensConfig.additionalPrice = additionalPrice;

    // Handle prescription file upload
    if (req.file) {
      lensConfig.prescriptionFile = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      lensConfig.prescriptionVerified = false; // Reset verification
    }

    lensConfig.updatedAt = new Date();
    await lensConfig.save();

    res.json({
      success: true,
      message: 'Lens configuration updated',
      data: lensConfig
    });
  } catch (error) {
    console.error('Error updating lens configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * DELETE /api/lens-configuration/:id
 * Delete lens configuration
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const lensConfig = await LensConfiguration.findOneAndDelete({
      _id: id,
      user: userId
    });

    if (!lensConfig) {
      return res.status(404).json({
        success: false,
        message: 'Lens configuration not found'
      });
    }

    res.json({
      success: true,
      message: 'Lens configuration deleted'
    });
  } catch (error) {
    console.error('Error deleting lens configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/lens-configuration/pricing
 * Get lens pricing information
 */
router.get('/pricing/info', async (req, res) => {
  try {
    const pricing = {
      lensType: {
        'single-vision': { base: 500, description: 'Single vision lenses for distance or near vision' },
        'bifocal': { base: 1200, description: 'Bifocal lenses with two prescription zones' },
        'progressive': { base: 2000, description: 'Progressive lenses with seamless transition' },
        'reading': { base: 600, description: 'Reading glasses lenses' },
        'computer': { base: 800, description: 'Computer glasses with blue light protection' }
      },
      lensMaterial: {
        'cr39': { multiplier: 1.0, description: 'Standard plastic lenses' },
        'polycarbonate': { multiplier: 1.3, description: 'Impact-resistant polycarbonate' },
        'high-index-1.67': { multiplier: 1.6, description: 'Thin high-index lenses' },
        'high-index-1.74': { multiplier: 2.0, description: 'Ultra-thin high-index lenses' },
        'trivex': { multiplier: 1.5, description: 'Lightweight and durable Trivex' },
        'glass': { multiplier: 1.2, description: 'Traditional glass lenses' }
      },
      lensCoating: {
        'standard': { additional: 0, description: 'No additional coating' },
        'anti-reflective': { additional: 300, description: 'Anti-reflective coating' },
        'blue-cut': { additional: 500, description: 'Blue light blocking coating' },
        'photochromic': { additional: 800, description: 'Transitions lenses' },
        'polarized': { additional: 600, description: 'Polarized coating' },
        'uv-protection': { additional: 200, description: 'UV protection coating' }
      }
    };

    res.json({
      success: true,
      data: pricing
    });
  } catch (error) {
    console.error('Error getting lens pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
