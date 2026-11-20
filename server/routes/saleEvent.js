import express from 'express';
import SaleEvent from '../models/SaleEvent.js';
import Product from '../models/Product.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const events = await SaleEvent.find().sort({ createdAt: -1 });
    const now = new Date();
    const activeEvents = events.filter((e) => e.isActive && e.startDate <= now && e.endDate >= now);
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
    const { name, description, bannerImage, categories, discountPercentage, startDate, endDate, brands } = req.body;

    if (brands !== undefined && brands !== null && (!Array.isArray(brands) || brands.some((b) => typeof b !== 'string' || !b.trim()))) {
      return res.status(400).json({ success: false, message: 'brands must be a list of brand names.' });
    }
    if (!name || !discountPercentage || !startDate || !endDate) {
      return res
        .status(400)
        .json({ success: false, message: 'Name, discount percentage, start and end dates are required.' });
    }

    const event = new SaleEvent({
      name,
      description,
      bannerImage,
      categories: categories || ['all'],
      brands: (brands || []).map((b) => String(b).trim()).filter(Boolean),
      discountPercentage,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdBy: req.user._id,
    });

    await event.save();

    const applyResult = await applySaleEventToProducts(event);

    event.affectedProducts = applyResult.modifiedCount;
    await event.save();

    res.status(201).json({
      success: true,
      message: `Sale event created. ${applyResult.modifiedCount} products updated${(event.brands || []).length ? ` (branded: ${event.brands.join(', ')})` : ''}.`,
      event,
      affectedProducts: applyResult.modifiedCount,
    });
  } catch (error) {
    console.error('Create sale event error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, description, bannerImage, categories, discountPercentage, startDate, endDate, isActive, brands } = req.body;

    const event = await SaleEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Sale event not found.' });

    if (name) event.name = name;
    if (description !== undefined) event.description = description;
    if (bannerImage !== undefined) event.bannerImage = bannerImage;
    if (categories) event.categories = categories;
    if (brands !== undefined) {
      if (!Array.isArray(brands) || brands.some((b) => typeof b !== 'string' || !b.trim())) {
        return res.status(400).json({ success: false, message: 'brands must be a list of brand names.' });
      }
      event.brands = brands.map((b) => String(b).trim()).filter(Boolean);
    }
    if (discountPercentage) event.discountPercentage = discountPercentage;
    if (startDate) event.startDate = new Date(startDate);
    if (endDate) event.endDate = new Date(endDate);
    if (isActive !== undefined) event.isActive = isActive;

    await event.save();

    if (event.isActive) {
      /*
       * Deactivate BEFORE re-applying: prices are anchored to product.price,
       * so stacking a second apply on the first is not mathematically
       * double-counting - but originalDiscountedPrice (what restore leans on)
       * WAS being overwritten with the previous event price, so a deactivated
       * edited event would restore the discounted number instead of the
       * true price. restore-then-re-apply is the only order that is correct.
       */
      await deactivateSaleEvent(event._id);
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
      res.json({
        success: true,
        message: `Sale event activated. ${applyResult.modifiedCount} products updated.`,
        event,
      });
    } else {
      await deactivateSaleEvent(event._id);
      res.json({ success: true, message: 'Sale event deactivated. Product prices restored.', event });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

async function applySaleEventToProducts(event) {
  const { foldBrand } = await import('../services/brandOwnership.js');
  const base = { isActive: true };
  if (!event.categories.includes('all')) {
    base.category = { $in: event.categories };
  }

  // brand list matched by folded comparison to survive Ray-Ban / ray ban /
  // RAY_BAN stored spellings; the folded list is short so pre-filtering by
  // the whole category then matching in memory stays trivial and exact.
  const wantedBrands = (event.brands || []).map(foldBrand).filter(Boolean);
  const inBrandScope = (productBrand) =>
    wantedBrands.length === 0 || wantedBrands.includes(foldBrand(productBrand || ''));

  const products = (await Product.find(base)).filter((p) => inBrandScope(p.brand));
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
      if (
        product.sellerOffer &&
        product.sellerOffer.isActive &&
        product.sellerOffer.type === 'percentage' &&
        product.sellerOffer.value > 0
      ) {
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
