import express from 'express';
import Manufacturer from '../models/Manufacturer.js';
import Product from '../models/Product.js';

const router = express.Router();

// Public: Get all active manufacturers
router.get('/', async (req, res) => {
  try {
    const manufacturers = await Manufacturer.find({ 
      isActive: true, 
      isBanned: false 
    }).select('-password -__v');
    
    res.json({ 
      success: true, 
      data: manufacturers,
      count: manufacturers.length 
    });
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch manufacturers' 
    });
  }
});

// Public: Get manufacturer by ID
router.get('/:id', async (req, res) => {
  try {
    const manufacturer = await Manufacturer.findById(req.params.id)
      .select('-password -__v')
      .where('isActive').equals(true)
      .where('isBanned').equals(false);
    
    if (!manufacturer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Manufacturer not found' 
      });
    }
    
    res.json({ success: true, data: manufacturer });
  } catch (error) {
    console.error('Error fetching manufacturer:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch manufacturer' 
    });
  }
});

// Public: Get manufacturer products
router.get('/:id/products', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const products = await Product.find({ 
      manufacturer: req.params.id,
      isActive: true 
    })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('seller', 'name storeName storeLogo')
      .populate('manufacturer', 'name logo')
      .sort({ createdAt: -1 });
    
    const count = await Product.countDocuments({ 
      manufacturer: req.params.id,
      isActive: true 
    });
    
    res.json({ 
      success: true, 
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching manufacturer products:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch manufacturer products' 
    });
  }
});

export default router;
