import express from 'express';
import SellerStock from '../models/SellerStock.js';
import Product from '../models/Product.js';
import { verifySeller } from '../middleware/auth.js';

const router = express.Router();

/**
 * What this seller actually sells: which brand products they carry, the price and
 * discount they set, and the colour/size quantities they hold. Order routing
 * chooses sellers from these rows, so an inaccurate listing means fewer offers.
 */
router.get('/', verifySeller, async (req, res) => {
  try {
    const { brand, category, listed, search } = req.query;
    const filter = { seller: req.seller._id };
    if (brand) filter.brand = brand;
    if (category) filter.category = category;
    if (listed !== undefined) filter.isListed = listed === 'true';
    if (search) {
      filter.$or = [
        { brand: { $regex: String(search), $options: 'i' } },
        { modelNumber: { $regex: String(search), $options: 'i' } }
      ];
    }

    const [rows, brands] = await Promise.all([
      SellerStock.find(filter)
        .sort({ brand: 1, sellingPrice: 1 })
        .populate('product', 'title images brand category modelNumber colors sizes')
        .lean(),
      SellerStock.distinct('brand', { seller: req.seller._id })
    ]);

    res.json({
      success: true,
      data: rows,
      brands: brands.filter(Boolean).sort(),
      summary: {
        listings: rows.length,
        listed: rows.filter((r) => r.isListed).length,
        units: rows.reduce((sum, r) => sum + (r.totalStock || 0), 0),
        awaitingPriceAcceptance: rows.filter((r) => r.pendingChange?.status === 'awaiting_acceptance').length
      }
    });
  } catch (error) {
    console.error('Seller stock listing error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Choose a product from the verified catalogue and list it at the seller's price. */
router.post('/', verifySeller, async (req, res) => {
  try {
    const { productId, sellingPrice, variants = [], isReturnable, isExchangeable, isListed } = req.body;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    // Only verified catalogue can be sold.
    if (product.verificationStatus && product.verificationStatus !== 'verified') {
      return res.status(400).json({ success: false, message: 'That product is not verified yet, so it cannot be listed.' });
    }

    const price = Number(sellingPrice);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ success: false, message: 'A selling price above zero is required.' });
    }
    const mrp = Number(product.price) || price;
    if (price > mrp) {
      return res.status(400).json({ success: false, message: `Selling price cannot exceed the MRP of Rs. ${mrp}.` });
    }

    const cleanVariants = (Array.isArray(variants) ? variants : []).map((v) => ({
      color: String(v.color || ''),
      size: String(v.size || ''),
      stock: Math.max(0, Number(v.stock) || 0),
      price: Number(v.price) || price
    }));

    const stock = await SellerStock.findOneAndUpdate(
      { seller: req.seller._id, product: product._id },
      {
        seller: req.seller._id,
        product: product._id,
        brand: product.brand,
        modelNumber: product.modelNumber || '',
        category: product.category,
        sellingPrice: price,
        mrp,
        variants: cleanVariants,
        isReturnable: isReturnable !== false,
        isExchangeable: isExchangeable !== false,
        isListed: isListed !== false
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    res.status(201).json({ success: true, message: 'Listing saved.', data: stock });
  } catch (error) {
    console.error('Seller stock create error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/** Products this seller is allowed to list, grouped by brand. */
router.get('/catalogue', verifySeller, async (req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
      verificationStatus: { $in: ['verified', null] }
    })
      .select('title brand category modelNumber price discountedPrice colors sizes images')
      .sort({ brand: 1, title: 1 })
      .lean();

    const grouped = {};
    products.forEach((p) => {
      (grouped[p.brand] = grouped[p.brand] || []).push(p);
    });

    res.json({
      success: true,
      data: products,
      brands: Object.keys(grouped).sort().map((brand) => ({ brand, count: grouped[brand].length, products: grouped[brand] }))
    });
  } catch (error) {
    console.error('Seller catalogue error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Update price, listing state or per-variant stock. */
router.put('/:id', verifySeller, async (req, res) => {
  try {
    const row = await SellerStock.findOne({ _id: req.params.id, seller: req.seller._id });
    if (!row) return res.status(404).json({ success: false, message: 'Listing not found.' });

    const { sellingPrice, variants, isListed, isReturnable, isExchangeable } = req.body;

    if (variants !== undefined) {
      row.variants = (Array.isArray(variants) ? variants : []).map((v) => ({
        color: String(v.color || ''),
        size: String(v.size || ''),
        stock: Math.max(0, Number(v.stock) || 0),
        price: Number(v.price) || row.sellingPrice
      }));
    }
    if (isListed !== undefined) row.isListed = !!isListed;
    if (isReturnable !== undefined) row.isReturnable = !!isReturnable;
    if (isExchangeable !== undefined) row.isExchangeable = !!isExchangeable;
    if (sellingPrice !== undefined) {
      const price = Number(sellingPrice);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ success: false, message: 'A selling price above zero is required.' });
      }
      row.sellingPrice = price;
    }

    await row.save();
    res.json({ success: true, message: 'Listing updated.', data: row });
  } catch (error) {
    console.error('Seller stock update error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/:id', verifySeller, async (req, res) => {
  try {
    const row = await SellerStock.findOneAndDelete({ _id: req.params.id, seller: req.seller._id });
    if (!row) return res.status(404).json({ success: false, message: 'Listing not found.' });
    res.json({ success: true, message: 'Listing removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
