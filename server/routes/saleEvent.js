import express from 'express';
import SaleEvent from '../models/SaleEvent.js';
import Product from '../models/Product.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const events = await SaleEvent.find().sort({ createdAt: -1 });
    const now = new Date();
    const activeEvents = events.filter(e => e.isActive && e.startDate <= now && e.endDate >= now);
    res.json({ success: true, events, activeEvents });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const event = await SaleEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Sale event not found.' });
    res.json({ success: true, event });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, description, bannerImage, categories, discountPercentage, startDate, endDate } = req.body;

    if (!name || !discountPercentage || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Name, discount percentage, start and end dates are required.' });
    }

    const event = new SaleEvent({
      name,
      description,
      bannerImage,
      categories: categories || ['all'],
      discountPercentage,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdBy: req.user._id
    });

    await event.save();

    const applyResult = await applySaleEventToProducts(event);

    event.affectedProducts = applyResult.modifiedCount;
    await event.save();

    res.status(201).json({
      success: true,
      message: `Sale event created. ${applyResult.modifiedCount} products updated.`,
      event,
      affectedProducts: applyResult.modifiedCount
    });
  } catch (error) {
    console.error('Create sale event error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, description, bannerImage, categories, discountPercentage, startDate, endDate, isActive } = req.body;

    const event = await SaleEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Sale event not found.' });

    if (name) event.name = name;
    if (description !== undefined) event.description = description;
    if (bannerImage !== undefined) event.bannerImage = bannerImage;
    if (categories) event.categories = categories;
    if (discountPercentage) event.discountPercentage = discountPercentage;
    if (startDate) event.startDate = new Date(startDate);
    if (endDate) event.endDate = new Date(endDate);
    if (isActive !== undefined) event.isActive = isActive;

    await event.save();

    if (event.isActive) {
      const applyResult = await applySaleEventToProducts(event);
      event.affectedProducts = applyResult.modifiedCount;
      await event.save();
    } else {
      await deactivateSaleEvent(event._id);
    }

    res.json({ success: true, message: 'Sale event updated.', event });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const event = await SaleEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Sale event not found.' });

    await deactivateSaleEvent(event._id);
    await SaleEvent.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Sale event deleted. Product prices restored.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/:id/toggle', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const event = await SaleEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Sale event not found.' });

    event.isActive = !event.isActive;
    await event.save();

    if (event.isActive) {
      const applyResult = await applySaleEventToProducts(event);
      event.affectedProducts = applyResult.modifiedCount;
      await event.save();
      res.json({ success: true, message: `Sale event activated. ${applyResult.modifiedCount} products updated.`, event });
    } else {
      await deactivateSaleEvent(event._id);
      res.json({ success: true, message: 'Sale event deactivated. Product prices restored.', event });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

async function applySaleEventToProducts(event) {
  const query = { isActive: true };

  if (!event.categories.includes('all')) {
    query.category = { $in: event.categories };
  }

  const products = await Product.find(query);
  let modifiedCount = 0;

  for (const product of products) {
    product.originalDiscountedPrice = product.discountedPrice || product.price;

    const salePrice = Math.round(product.price * (1 - event.discountPercentage / 100));
    product.effectivePrice = salePrice;
    product.discountedPrice = salePrice;
    product.isUnderSaleEvent = true;
    product.saleEventId = event._id;

    await product.save();
    modifiedCount++;
  }

  return { modifiedCount };
}

async function deactivateSaleEvent(eventId) {
  const products = await Product.find({ saleEventId: eventId });

  for (const product of products) {
    product.isUnderSaleEvent = false;
    product.saleEventId = null;

    if (product.originalDiscountedPrice) {
      product.discountedPrice = product.originalDiscountedPrice;
      product.effectivePrice = product.originalDiscountedPrice;
    } else {
      if (product.sellerOffer && product.sellerOffer.isActive && product.sellerOffer.type === 'percentage' && product.sellerOffer.value > 0) {
        product.discountedPrice = Math.round(product.price * (1 - product.sellerOffer.value / 100));
        product.effectivePrice = product.discountedPrice;
      } else {
        product.discountedPrice = product.price;
        product.effectivePrice = product.price;
      }
    }

    product.originalDiscountedPrice = null;
    await product.save();
  }
}

export default router;
