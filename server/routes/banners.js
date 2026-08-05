import express from 'express';
import Banner from '../models/Banner.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all active banners (public)
router.get('/active', async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, banners });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching banners', error: error.message });
  }
});

// Get all banners (admin)
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, banners });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching banners', error: error.message });
  }
});

// Create banner (admin)
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { title, imageUrl, linkUrl, order, isActive } = req.body;
    
    const banner = new Banner({
      title,
      imageUrl,
      linkUrl,
      order: order || 0,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user.id
    });

    await banner.save();
    res.status(201).json({ success: true, message: 'Banner created successfully', banner });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating banner', error: error.message });
  }
});

// Update banner (admin)
router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { title, imageUrl, linkUrl, order, isActive } = req.body;
    
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { title, imageUrl, linkUrl, order, isActive },
      { new: true, runValidators: true }
    );

    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    res.json({ success: true, message: 'Banner updated successfully', banner });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating banner', error: error.message });
  }
});

// Delete banner (admin)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);

    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting banner', error: error.message });
  }
});

export default router;
