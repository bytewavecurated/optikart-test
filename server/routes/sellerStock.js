import express from 'express';
import SellerStock from '../models/SellerStock.js';
import Product from '../models/Product.js';
import { verifyAnySeller, verifyToken, verifyAdmin } from '../middleware/auth.js';
import {
  proposePriceChange, decidePriceChange, listPriceChangeStates,
  overridePriceChange, WORKING_DAYS
} from '../services/priceChangeAcceptance.js';

import { declareSupply, pauseListing } from '../services/listingApproval.js';

const router = express.Router();

/**
 * What this seller actually sells: which brand products they carry, the price and
 * discount they set, and the colour/size quantities they hold. Order routing
 * chooses sellers from these rows, so an inaccurate listing means fewer offers.
 */
router.get('/', verifyAnySeller, async (req, res) => {
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
router.post('/', verifyAnySeller, async (req, res) => {
  try {
    const { productId, sellingPrice, variants = [], isReturnable, isExchangeable, isListed, sellsWithPower, powerLensTypes } = req.body;

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
      return res.status(400).json({ success: false, message: `Selling price cannot exceed the MRP of ₹${mrp}.` });
    }

    const cleanVariants = (Array.isArray(variants) ? variants : []).map((v) => ({
      color: String(v.color || ''),
      size: String(v.size || ''),
      stock: Math.max(0, Number(v.stock) || 0),
      /*
       * Deliberately the listing's price, not a per-row one.
       *
       * A price entered here today would be stored and then ignored: checkout
       * prices a line from the catalogue product
       * (`routes/order.js` reads `product.variants` and never `SellerStock`), so
       * a per-configuration price on the stock row would be a box that changes
       * nothing - the same decoration defect this project keeps hunting. When
       * per-seller pricing is wired into checkout, this is where it lands, and
       * the input on the listing screen stops being cosmetic in the same change.
       */
      price
    }));

    /*
     * Assigned and saved rather than upserted. `findOneAndUpdate` does not run
     * model hooks, so the rule that an unapproved brand claim cannot be listed
     * - which lives in models/SellerStock.js, because four writers touch this
     * document - would have been skipped by the one route sellers use most.
     */
    let stock = await SellerStock.findOne({ seller: req.seller._id, product: product._id });
    const creating = !stock;
    if (creating) {
      stock = new SellerStock({ seller: req.seller._id, product: product._id });
    }

    /*
     * Any catalogue owned by a manufacturer is somebody's brand, so claiming
     * stock in it is a claim about supply. The manufacturer's own retail
     * consoles sell the same products through a storefront copy, and that path
     * is gated too - see routes/manufacturerSeller.js toggle.
     */
    const brandLinked = !!product.manufacturer;

    Object.assign(stock, {
      brand: product.brand,
      modelNumber: product.modelNumber || '',
      category: product.category,
      sellingPrice: price,
      mrp,
      variants: cleanVariants,
      isReturnable: isReturnable !== false,
      isExchangeable: isExchangeable !== false,
      sellsWithPower: !!sellsWithPower && !!product?.poweredOptionsAvailable,
      powerLensTypes: Array.isArray(powerLensTypes) ? powerLensTypes : []
    });

    const wantsListed = isListed !== false;
    const actorLabel = req.seller.storeName || req.seller.name || 'seller';

    if (!brandLinked) {
      stock.isListed = wantsListed;
      if (!stock.listing) stock.listing = { brandLinked: false, state: 'live' };
      await stock.save();
      return res.status(creating ? 201 : 200).json({ success: true, message: 'Listing saved.', data: stock });
    }

    // A branded item: this row is a claim that the brand supplied us.
    const declared = await declareSupply({
      doc: stock,
      kind: 'stock',
      product,
      actorLabel,
      proof: {
        kind: req.body.proofKind,
        reference: req.body.proofReference,
        note: req.body.proofNote
      },
      brandLinked: true
    });

    if (!declared.success) {
      return res.status(400).json({ success: false, message: declared.message, reason: declared.reason });
    }

    if (wantsListed && declared.state === 'live') stock.isListed = true;
    await stock.save();

    return res.status(creating ? 201 : 200).json({
      success: true,
      state: declared.state,
      message: declared.message,
      data: stock
    });
  } catch (error) {
    console.error('Seller stock create error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});



/**
 * The seller's own view of pending price proposals: what was offered, what it
 * replaces, and how many working days remain before it lapses.
 */
router.get('/price-changes', verifyAnySeller, async (req, res) => {
  try {
    const rows = await SellerStock.find({ seller: req.seller._id, 'pendingChange.status': 'awaiting_acceptance' })
      .sort({ 'pendingChange.requestedAt': -1 })
      .populate('product', 'title brand images')
      .lean();
    res.json({ success: true, data: rows.map((r) => ({
      stockId: String(r._id),
      product: r.product,
      currentPrice: r.sellingPrice,
      proposedPrice: r.pendingChange.sellingPrice,
      requestedBy: r.pendingChange.requestedBy,
      requestedAt: r.pendingChange.requestedAt,
      expiresAt: r.pendingChange.expiresAt
    })), workingDaysAllowed: WORKING_DAYS });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** A seller accepting or declining one of their own proposals from the dashboard. */
router.post('/price-changes/:stockId/decide', verifyAnySeller, async (req, res) => {
  try {
    const stock = await SellerStock.findOne({ _id: req.params.stockId, seller: req.seller._id });
    if (!stock) return res.status(404).json({ success: false, message: 'Listing not found.' });
    const result = await decidePriceChange({ stockId: String(stock._id), token: req.body.token, decision: req.body.decision });
    if (!result.success) return res.status(400).json({ success: false, message: result.error });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Public confirmation endpoint used by the link in the email; the token is the authority. */
router.post('/public/price-changes/:stockId/decide', async (req, res) => {
  try {
    const { token, decision } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'A confirmation token is required.' });
    if (!['accept', 'decline'].includes(decision)) return res.status(400).json({ success: false, message: 'Unknown decision.' });
    const result = await decidePriceChange({ stockId: req.params.stockId, token, decision });
    if (!result.success) return res.status(result.expired ? 410 : 400).json({ success: false, message: result.error, expired: !!result.expired });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Raise a proposal (admin or an authorised exec/staff), or list every state. */
router.get('/admin/price-changes', verifyToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Not permitted.' });
    }
    const rows = await listPriceChangeStates({ sellerId: req.query.seller, status: req.query.status });
    res.json({ success: true, data: rows, workingDaysAllowed: WORKING_DAYS });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/admin/price-changes/:stockId/propose', verifyToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Only the platform team can propose a price change.' });
    const stock = await SellerStock.findById(req.params.stockId);
    if (!stock) return res.status(404).json({ success: false, message: 'Listing not found.' });
    const result = await proposePriceChange({
      sellerStockId: stock._id,
      sellerId: stock.seller,
      product: { title: stock.modelNumber || stock.brand, brand: stock.brand },
      newPrice: req.body.newPrice,
      actorLabel: req.body.reason || 'OptiKart pricing'
    });
    if (!result.success) return res.status(400).json({ success: false, message: result.error });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/admin/price-changes/:stockId/override', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await overridePriceChange({ stockId: req.params.stockId, adminId: req.user?._id, decision: req.body.decision || 'accept' });
    if (!result.success) return res.status(400).json({ success: false, message: result.error });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Products this seller is allowed to list, grouped by brand. */
router.get('/catalogue', verifyAnySeller, async (req, res) => {
  try {
    const filter = {
      isActive: true,
      verificationStatus: { $in: ['verified', null] }
    };
    // A retailer appointed by a manufacturer may only list that manufacturer's
    // brands, which is what keeps the "already added brand" list meaningful.
    const brands = req.seller?.allowedBrands || req.seller?.brands;
    if (Array.isArray(brands) && brands.length > 0) filter.brand = { $in: brands };

    const products = await Product.find(filter)
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
router.put('/:id', verifyAnySeller, async (req, res) => {
  try {
    const row = await SellerStock.findOne({ _id: req.params.id, seller: req.seller._id });
    if (!row) return res.status(404).json({ success: false, message: 'Listing not found.' });

    const { sellingPrice, variants, isListed, isReturnable, isExchangeable, sellsWithPower, powerLensTypes } = req.body;

    /*
     * The same two price rules `POST` enforces, applied here as well.
     *
     * Editing a listing had no price validation at all: a buyer could be charged
     * above the product's listed MRP, and a stray zero or negative figure became a
     * real price, because only the create path checked. A rule that guards one of
     * two writers is not a rule - and the fix is not a client-side input
     * restriction, since the request is the thing that must be honest.
     *
     * MRP is read from the stock row itself (`row.mrp`), which the create path set
     * from the catalogue price at listing time, so this does not depend on the
     * product still carrying the same figure.
     */
    if (sellingPrice !== undefined) {
      const price = Number(sellingPrice);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ success: false, message: 'A selling price above zero is required.' });
      }
      const mrp = Number(row.mrp) || 0;
      if (mrp > 0 && price > mrp) {
        return res.status(400).json({
          success: false,
          message: `Selling price cannot exceed the MRP of ₹${mrp.toLocaleString('en-IN')} on this listing.`
        });
      }
      row.sellingPrice = price;
    }

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
    if (sellsWithPower !== undefined) {
      // A seller can only opt in if the maker declared the frame glazable.
      if (sellsWithPower) {
        // `row.product` may already be a populated object from an earlier read.
        const pid = row.product?._id || row.product;
        const p = await Product.findById(pid).select('poweredOptionsAvailable');
        if (!p?.poweredOptionsAvailable) {
          return res.status(400).json({ success: false, message: 'This product cannot be made with prescription lenses, so it cannot be sold with power.' });
        }
      }
      row.sellsWithPower = !!sellsWithPower;
    }
    if (Array.isArray(powerLensTypes)) row.powerLensTypes = powerLensTypes;
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

router.delete('/:id', verifyAnySeller, async (req, res) => {
  try {
    const row = await SellerStock.findOneAndDelete({ _id: req.params.id, seller: req.seller._id });
    if (!row) return res.status(404).json({ success: false, message: 'Listing not found.' });
    res.json({ success: true, message: 'Listing removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
