import express from 'express';
import Banner from '../models/Banner.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';
import { uploadSingleImage } from '../middleware/upload.js';

const router = express.Router();

// Build the per-device image object saved on the banner.
const buildImages = (url) => ({
  desktop: { url: url || '', aspectRatio: '1:1' },
  tablet: { url: url || '', aspectRatio: '16:9' },
  mobile: { url: url || '', aspectRatio: '9:16' }
});

// Public: active banners for the home page carousel
router.get('/active', async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, banners });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching banners', error: error.message });
  }
});

// Public: single banner detail page (used by the discount detail page)
router.get('/slug/:slug', async (req, res) => {
  try {
    const banner = await Banner.findOne({ slug: req.params.slug, isActive: true });
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found.' });
    }
    res.json({ success: true, banner });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching banner', error: error.message });
  }
});

// Admin: all banners
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, banners });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching banners', error: error.message });
  }
});

// Admin: create banner. Image is uploaded from device (no external links).
router.post('/', verifyToken, verifyAdmin, uploadSingleImage, async (req, res) => {
  try {
    const { title, subtitle, linkUrl, link, order, isActive, description,
            discountType, discountValue, minPrice, maxPrice, startDate, endDate } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'A banner image file is required.' });
    }

    const imageUrl = `/uploads/banners/${req.file.filename}`;

    const banner = await Banner.create({
      title: String(title).trim(),
      subtitle: subtitle || '',
      images: buildImages(imageUrl),
      linkUrl: linkUrl || link || '',
      description: description || '',
      discount: {
        kind: discountType || 'none',
        value: Number(discountValue || 0),
        minPrice: Number(minPrice || 0),
        maxPrice: Number(maxPrice || 0),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      },
      order: Number(order || 0),
      isActive: isActive === undefined || isActive === true || isActive === 'true',
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, message: 'Banner created successfully', banner });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating banner', error: error.message });
  }
});

// Admin: update banner. Image replacement is optional.
router.put('/:id', verifyToken, verifyAdmin, uploadSingleImage, async (req, res) => {
  try {
    const { title, subtitle, linkUrl, link, order, isActive, description,
            discountType, discountValue, minPrice, maxPrice, startDate, endDate } = req.body;

    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found.' });
    }

    const existingUrl = banner.images?.desktop?.url || '';
    const nextUrl = req.file ? `/uploads/banners/${req.file.filename}` : existingUrl;

    banner.title = title || banner.title;
    banner.subtitle = subtitle ?? banner.subtitle;
    banner.images = buildImages(nextUrl);
    banner.linkUrl = (linkUrl ?? link) ?? banner.linkUrl;
    banner.description = description ?? banner.description;
    banner.discount = {
      kind: discountType || banner.discount?.kind || 'none',
      value: Number(discountValue ?? banner.discount?.value ?? 0),
      minPrice: Number(minPrice ?? banner.discount?.minPrice ?? 0),
      maxPrice: Number(maxPrice ?? banner.discount?.maxPrice ?? 0),
      startDate: startDate ? new Date(startDate) : banner.discount?.startDate || null,
      endDate: endDate ? new Date(endDate) : banner.discount?.endDate || null
    };
    banner.order = Number(order ?? banner.order ?? 0);
    if (isActive !== undefined) {
      banner.isActive = isActive === true || isActive === 'true';
    }

    await banner.save();
    res.json({ success: true, message: 'Banner updated successfully', banner });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating banner', error: error.message });
  }
});

// Admin: delete banner
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found.' });
    }
    res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting banner', error: error.message });
  }
});

export default router;
