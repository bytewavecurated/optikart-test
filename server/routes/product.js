import express from 'express';
import Product from '../models/Product.js';
import { verifySeller, optionalAuth } from '../middleware/auth.js';
import { productValidation } from '../middleware/validate.js';
import { uploadProductImages } from '../middleware/upload.js';
import { sendPriceChangeNotification, sendProductUpdateNotification } from '../services/email.js';

const router = express.Router();

// Category slugs arrive in many spellings ('contact-lenses', 'Contact Lenses',
// 'contactlenses') but the stored enum is a flat lowercase token.
const CATEGORY_ALIASES = {
  sunglasses: 'sunglasses',
  eyeglasses: 'eyeglasses',
  'computer-glasses': 'eyeglasses',
  contactlenses: 'contactlenses',
  'contact-lenses': 'contactlenses',
  readingglasses: 'readingglasses',
  'reading-glasses': 'readingglasses',
  sportseyewear: 'sportseyewear',
  'sports-eyewear': 'sportseyewear',
  sports: 'sportseyewear',
  kids: 'kids',
  solution: 'solution',
  'care-solutions': 'solution',
  'lens-solution': 'solution',
  solutions: 'solution',
  accessories: 'accessories',
  accessory: 'accessories'
};

const normalizeRegex = (value) => normalizedRegex(value) || value;

const normalizeCategory = (value) => {
  if (!value) return value;
  const raw = String(value).trim();
  const lower = raw.toLowerCase();
  if (CATEGORY_ALIASES[lower]) return CATEGORY_ALIASES[lower];
  const compact = lower.replace(/[^a-z0-9]/g, '');
  return CATEGORY_ALIASES[compact] || compact;
};


// The stored enums use inconsistent casing and spacing ('Cat Eye' vs 'cateye',
// 'Full Rim' vs 'full-rim', 'Stainless Steel' vs 'stainless-steel'), so match
// on a normalised pattern that accepts any of those spellings.

const normalizeToken = (v) => String(v || '').toLowerCase().replace(/[\s]+/g, '').replace(/[-_]+/g, '');
const normalizeArray = (v) => {
  const token = normalizeToken(v);
  const FORMS = {
    blucut: ['bluCut', 'blucut', 'blue-cut'],
    photochromic: ['photochromic'],
    polarized: ['polarized'],
    nonpowered: ['nonpowered'],
    powered: ['powered']
  };
  return FORMS[token] || [v];
};

const normalizedRegex = (value) => {
  const clean = String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean) return null;
  const flexible = clean.split('').join('[\\s_-]*');
  return new RegExp(`^${flexible}$`, 'i');
};

const shapeVariants = (v) => {
  const r = normalizedRegex(v);
  return r ? [r, v] : [v];
};

const frameTypeVariants = (v) => {
  const r = normalizedRegex(v);
  return r ? [r, v] : [v];
};

const materialVariants = (v) => {
  const r = normalizedRegex(v);
  return r ? [r, v] : [v];
};

const sizeVariants = (v) => {
  const r = normalizedRegex(v);
  return r ? [r, v] : [v];
};

router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      page = 1, limit = 20, search, category, brand, minPrice, maxPrice, 
      frameShape, frameType, material, frameColor, lensType, gender, frameSize,
      modelNumber, color, sellerCode, sort, hasOffer, seller: isSeller,
      // Contact lens and powered-eyewear dimensions.
      powered, powerType, withPower, colour, combo, lensesPerBox, replacementPeriod,
      subGender, ageGroup, prescriptionLensTypes, suitableFor, volumeMl, accessoryType,
      use, waterContent, diameter, minPriceGte, excludeCategory
    } = req.query;

    // Only approved catalogue is publicly visible; sellers may list whatever
    // they have been assigned, but it reaches shoppers after verification.
    const VISIBLE = VISIBLE_PRODUCTS;
    const query = { ...VISIBLE };
    // All contact-lens sub-fields merge into one object; overwriting it per
    // filter would let the last one win and silently drop the others.
    const lensFilter = {};

    if (sellerCode) {
      // Public store link from the product page: resolve the seller by their
      // human-readable sellerId and only show that seller's active listings.
      const { default: Seller } = await import('../models/Seller.js');
      const target = await Seller.findOne({ sellerId: sellerCode });
      if (!target) {
        return res.json({ success: true, products: [], pagination: { total: 0, page: 1, limit: parseInt(limit), pages: 0 } });
      }
      query.seller = target._id;
    }

    if (search) {
      query.$text = { $search: search };
    }
    if (category) query.category = normalizeCategory(category);

    // Contact lenses are not frames: a browse filtered by gender, face shape,
    // frame type or frame material is an eyewear browse, so lens products must
    // never leak into it regardless of which entry point asked for it.
    // Only frame attributes make this an eyewear browse. Lens attributes
    // (power type, box size, replacement) must not, or asking for daily toric
    // lenses would be read as "eyewear without a frame shape" and exclude them.
    const isEyewearFacetBrowse = Boolean(
      gender || frameShape || frameType || material || frameSize || frameColor || color
    );
    // Solution and accessories never leak into an eyewear facet browse either.
    const NON_EYEWEAR = { $nin: ['contactlenses', 'solution', 'accessories'] };
    if (isEyewearFacetBrowse && !query.category) query.category = NON_EYEWEAR;
    if (excludeCategory) query.category = { $ne: normalizeCategory(excludeCategory) };
    if (subGender) query.subGender = subGender;
    if (ageGroup) query.ageGroup = ageGroup;
    if (modelNumber) query.modelNumber = new RegExp(String(modelNumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (prescriptionLensTypes) query.prescriptionLensTypes = normalizeRegex(prescriptionLensTypes);
    if (replacementPeriod) lensFilter.replacementPeriod = normalizeRegex(replacementPeriod);
    if (lensesPerBox) lensFilter.lensesPerBox = Number(lensesPerBox) || lensesPerBox;
    if (waterContent) lensFilter.waterContent = Number(waterContent);
    if (diameter) lensFilter.diameter = Number(diameter);
    if (volumeMl) query['solution.volumeMl'] = Number(volumeMl);
    if (suitableFor) query['solution.suitableFor'] = normalizeRegex(suitableFor);
    if (accessoryType) query['accessory.accessoryType'] = normalizeRegex(accessoryType);

    // Contact-lens power-type selection. `powerType=none|colour` is cosmetic.
    if (powerType) {
      const pt = normalizeToken(powerType);
      if (pt === 'all' || pt === 'allpowers' || pt === 'all-powers') {
        // no constraint beyond being a lens
      } else if (pt === 'colour' || pt === 'color' || pt === 'cosmetic') {
        lensFilter.isCosmetic = true;
      } else {
        lensFilter.powerType = pt;
      }
    }
    if (colour === 'true') lensFilter.isCosmetic = true;
    if (combo === 'true') query['contactLens.comboShades.0'] = { $exists: true };
    if (withPower === 'true') lensFilter.withPowerAvailable = true;
    if (withPower === 'false') lensFilter.allowsZeroPower = true;

    // "powered" browse means frames the lab can glaze and a seller is
    // *listed as selling with power*; both must hold.
    if (powered === 'true') {
      query.poweredOptionsAvailable = true;
      query.category = query.category || { $in: ['sunglasses', 'eyeglasses', 'readingglasses', 'sportseyewear', 'kids'] };
    }
    if (use === 'computer') query.lensType = { $in: normalizeArray('blucut') };

    if (isEyewearFacetBrowse && query.category === 'contactlenses') {
      return res.json({
        success: true,
        products: [],
        pagination: { total: 0, page: 1, limit: parseInt(limit), pages: 0 },
        message: 'Contact lenses have no gender or frame attributes. Browse them from Contact Lenses.'
      });
    }

    if (brand) query.brand = brand;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseInt(minPrice);
      if (maxPrice) query.price.$lte = parseInt(maxPrice);
    }
    if (frameShape) query.frameShape = { $in: shapeVariants(frameShape) };
    if (frameType) query.frameType = { $in: frameTypeVariants(frameType) };
    if (material) query.frameMaterial = { $in: materialVariants(material) };
    if (frameColor) query.frameColor = frameColor;
    if (lensType) query.lensType = lensType;
    if (gender) query.gender = gender;
    if (frameSize) query.frameSize = { $in: sizeVariants(frameSize) };
    if (modelNumber) query.modelNumber = new RegExp(String(modelNumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (color) query.colors = { $elemMatch: { name: new RegExp(String(color).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } };
    if (hasOffer === 'true') {
      query.$or = [
        { 'sellerOffer.isActive': true, 'sellerOffer.type': { $ne: 'none' } },
        { isUnderSaleEvent: true }
      ];
    }
    if (isSeller === 'true' && req.user) {
      query.seller = req.user._id || req.user.sellerId;
    }

    // Applied here so every lensFilter assignment above is included.
    // Dotted paths, not an object: a single nested subdocument compared as a
    // whole object matches only documents identical in every field.
    Object.entries(lensFilter).forEach(([k, v]) => { query[`contactLens.${k}`] = v; });

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    else if (sort === 'price_desc') sortOption = { price: -1 };
    else if (sort === 'rating') sortOption = { totalRatings: -1 };
    else if (sort === 'newest') sortOption = { createdAt: -1 };
    else if (sort === 'popularity') sortOption = { viewCount: -1 };
    else if (sort === 'discount') sortOption = { discountedPrice: 1 };

    // Get sponsored products first (only 1 per search)
    if (process.env.DEBUG_QUERIES) console.log('LIST QUERY:', JSON.stringify(query));
    const sponsoredProducts = await Product.find({ ...query, isSponsored: true })
      .populate('seller', 'storeName storeLogo rating sellerId createdAt')
      .limit(1);

    // Get regular products
    const regularProducts = await Product.find({ ...query, isSponsored: { $ne: true } })
      .populate('seller', 'storeName storeLogo rating sellerId createdAt')
      .sort(sortOption)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Combine: sponsored first, then regular
    const products = [...sponsoredProducts, ...regularProducts];

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});


// Brand-wise manufacturer catalogue for the home page.
// Groups the products each manufacturer has added under the brand name,
// instead of sampling individual seller listings.
router.get('/manufacturer-brands', async (req, res) => {
  try {
    const limitPerBrand = Math.min(parseInt(req.query.perBrand || 8, 10) || 8, 24);

    const brandNames = await Product.distinct('brand', {
      ...VISIBLE_PRODUCTS,
      isManufacturerProduct: true,
      manufacturer: { $ne: null }
    });

    const brands = [];
    for (const brandName of brandNames.filter(Boolean).sort()) {
      const filter = { ...VISIBLE_PRODUCTS, isManufacturerProduct: true, brand: brandName };
      const [products, productCount] = await Promise.all([
        Product.find(filter).sort({ createdAt: -1 }).limit(limitPerBrand)
          .populate('seller', 'storeName storeLogo rating').lean(),
        Product.countDocuments(filter)
      ]);
      if (products.length) brands.push({ brand: brandName, productCount, products });
    }

    brands.sort((a, b) => b.productCount - a.productCount);
    res.json({ success: true, brands });
  } catch (error) {
    console.error('Manufacturer brands error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/*
 * The brand list, scoped to what the shopper is currently looking at.
 *
 * With no category this is every brand, as it always was. With one, brands that
 * sell nothing in that category are dropped: a dropdown that offers "Ola" inside
 * Sunglasses and returns zero results when chosen is not a filter, it is a dead
 * end the shopper has to discover. `gender` narrows it the same way, because the
 * men/women split is the other control sitting next to it on every browse page.
 */
/*
 * What a shopper is allowed to see, in one place.
 *
 * This pair of conditions lived inside the list handler as a local `VISIBLE`
 * while the facet, brand-rail and category-count queries each re-typed
 * `isActive: true` on their own - so the facets offered colours and brands that
 * existed only on products still awaiting verification. The effect was visible
 * to a shopper as a filter option that returned nothing, and it is exactly the
 * failure the scoped-facet work was supposed to remove: a control that lies
 * because the rule was written twice and drifted.
 */
const VISIBLE_PRODUCTS = { isActive: true, verificationStatus: 'verified' };

router.get('/brands', async (req, res) => {
  try {
    const { category, gender } = req.query;
    const scope = { ...VISIBLE_PRODUCTS };
    if (category) scope.category = String(category).toLowerCase();
    if (gender && ['men', 'women', 'unisex', 'kids'].includes(String(gender).toLowerCase())) {
      scope.gender = String(gender).toLowerCase();
    }
    const brands = await Product.distinct('brand', scope);
    const list = brands.filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)));
    res.json({ success: true, brands: list, scoped: !!(category || gender) });
  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = ['sunglasses', 'eyeglasses', 'contactlenses', 'readingglasses', 'sportseyewear', 'kids'];

    const categoryCounts = await Promise.all(
      categories.map(async (cat) => ({
        name: cat,
        count: await Product.countDocuments({ category: cat, ...VISIBLE_PRODUCTS })
      }))
    );

    res.json({ success: true, categories: categoryCounts });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/offers', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const products = await Product.find({
      ...VISIBLE_PRODUCTS,
      $or: [
        { 'sellerOffer.isActive': true, 'sellerOffer.type': { $ne: 'none' } },
        { isUnderSaleEvent: true }
      ]
    })
    .populate('seller', 'storeName storeLogo rating')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

    const total = await Product.countDocuments({
      ...VISIBLE_PRODUCTS,
      $or: [
        { 'sellerOffer.isActive': true, 'sellerOffer.type': { $ne: 'none' } },
        { isUnderSaleEvent: true }
      ]
    });

    res.json({ success: true, products, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/random', async (req, res) => {
  try {
    const { limit = 10, category } = req.query;

    const query = { ...VISIBLE_PRODUCTS };
    if (category) query.category = normalizeCategory(category);

    const count = await Product.countDocuments(query);
    const randomSkip = Math.max(0, Math.floor(Math.random() * (count - parseInt(limit))));

    const products = await Product.find(query)
      .populate('seller', 'storeName storeLogo rating')
      .skip(randomSkip)
      .limit(parseInt(limit));

    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/**
 * Facets that answer to the filters already chosen.
 *
 * Every list here used to be a `distinct` over all active products, so the brand
 * dropdown offered brands that cannot match the category in view, and choosing
 * one produced "no products" - the shopper has to discover for themselves that
 * the control lied. Each facet is now computed with the OTHER selected facets
 * applied and its own constraint withheld, which is what makes a dropdown both
 * accurate and still changeable: pick Sunglasses and the brand list becomes the
 * brands that make sunglasses, while the category list keeps every category so
 * the shopper can move on to Eyeglasses.
 *
 * A facet with nothing left in it comes back empty rather than padded, because
 * an option that yields no products is exactly what we are trying to stop
 * offering. `applied` is echoed so the panel can label an empty list as "nothing
 * matches these filters" instead of a silent blank.
 */
router.get('/filters', async (req, res) => {
  try {
    const q = req.query || {};
    const wanted = {
      category: q.category ? String(q.category).toLowerCase() : '',
      brand: q.brand ? String(q.brand) : '',
      gender: q.gender ? String(q.gender).toLowerCase() : '',
      frameShape: q.frameShape ? String(q.frameShape) : '',
      frameType: q.frameType ? String(q.frameType) : '',
      material: q.material ? String(q.material) : '',
      frameColor: q.frameColor ? String(q.frameColor) : '',
      lensType: q.lensType ? String(q.lensType) : '',
      frameSize: q.frameSize ? String(q.frameSize) : ''
    };

    // The scope used to count one facet: every chosen filter except that facet's
    // own, so the list can still be changed by the shopper.
    const scopeFor = (except) => {
      const scope = { ...VISIBLE_PRODUCTS };
      if (wanted.category && except !== 'category') scope.category = wanted.category;
      if (wanted.brand && except !== 'brand') scope.brand = wanted.brand;
      if (wanted.gender && except !== 'gender') scope.gender = wanted.gender;
      if (wanted.frameShape && except !== 'frameShape') scope.frameShape = wanted.frameShape;
      if (wanted.frameType && except !== 'frameType') scope.frameType = wanted.frameType;
      if (wanted.material && except !== 'frameMaterial') scope.frameMaterial = wanted.material;
      if (wanted.frameColor && except !== 'frameColor') scope.frameColor = wanted.frameColor;
      if (wanted.lensType && except !== 'lensType') scope.lensType = wanted.lensType;
      if (wanted.frameSize && except !== 'frameSize') scope.frameSize = wanted.frameSize;
      const min = Number(q.minPrice);
      const max = Number(q.maxPrice);
      if (Number.isFinite(min) && min > 0) scope.price = { ...scope.price, $gte: min };
      if (Number.isFinite(max) && max > 0) scope.price = { ...scope.price, $lte: max };
      return scope;
    };

    const FIELDS = [
      ['brand', 'brands'], ['frameShape', 'frameShapes'], ['frameType', 'frameTypes'],
      ['frameMaterial', 'materials'], ['frameColor', 'frameColors'], ['lensType', 'lensTypes'],
      ['gender', 'genders'], ['frameSize', 'frameSizes'], ['category', 'categories']
    ];

    const pairs = await Promise.all(FIELDS.map(async ([field, key]) => {
      const values = await Product.distinct(field, scopeFor(field));
      return [key, values
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
        .sort((a, b) => String(a).localeCompare(String(b)))];
    }));

    const facets = Object.fromEntries(pairs);

    /*
     * Brands grouped under their first letter. A brand list of 40 entries in a
     * flat <select> is a scroll, not a choice; grouped and labelled it is
     * scannable, and the grouping is computed from the same scoped list so the
     * letters shown only ever contain brands that can actually be bought with
     * the current filters.
     */
    const initial = (b) => {
      const c = String(b).trim().charAt(0).toUpperCase();
      return c >= 'A' && c <= 'Z' ? c : '#';
    };
    const brandsByLetter = (facets.brands || []).reduce((acc, b) => {
      const k = initial(b);
      if (!acc[k]) acc[k] = [];
      acc[k].push(b);
      return acc;
    }, {});

    const priced = await Product.aggregate([
      { $match: scopeFor('__none__') },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }
    ]);

    res.json({
      success: true,
      filters: {
        ...facets,
        brandsByLetter,
        priceRange: { min: priced[0]?.min || 0, max: priced[0]?.max || 10000 },
        applied: Object.fromEntries(Object.entries(wanted).filter(([, v]) => v))
      }
    });
  } catch (error) {
    console.error('Get filters error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/:id/related', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    const similarProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isActive: true
    })
    .populate('seller', 'storeName storeLogo rating sellerId')
    .limit(10);

    const shuffled = similarProducts.sort(() => 0.5 - Math.random());

    const otherBrandProducts = await Product.find({
      brand: { $ne: product.brand },
      _id: { $ne: product._id },
      isActive: true
    })
    .populate('seller', 'storeName storeLogo rating sellerId')
    .limit(10);

    const shuffledOther = otherBrandProducts.sort(() => 0.5 - Math.random());

    const allBrands = await Product.distinct('brand', { isActive: true, _id: { $ne: product._id } });
    const shuffledBrands = allBrands.filter(Boolean).sort(() => 0.5 - Math.random()).slice(0, 8);

    res.json({
      success: true,
      similarProducts: shuffled.slice(0, 5),
      otherBrandProducts: shuffledOther.slice(0, 5),
      brands: shuffledBrands
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'storeName storeLogo rating sellerId createdAt gstNumber')
      .populate('ratings.user', 'name avatar');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    product.viewCount += 1;
    await product.save();

    res.json({ success: true, product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/', verifySeller, productValidation, async (req, res) => {
  try {
    const productData = {
      ...req.body,
      seller: req.seller._id
    };

    const product = new Product(productData);
    await product.save();

    await Seller.findByIdAndUpdate(req.seller._id, {
      $inc: { totalProducts: 1 }
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.put('/:id', verifySeller, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      seller: req.seller._id
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found or you do not have permission.' });
    }

    const allowedUpdates = [
      'title', 'description', 'price', 'discountedPrice', 'images', 'category',
      'brand', 'colors', 'sizes', 'materials', 'frameType', 'frameShape',
      'frameColor', 'lensType', 'hasLenses', 'poweredOptions', 'stock',
      'isActive', 'tags', 'features', 'dimensions', 'weight', 'warranty', 'returnPolicy',
      'gender', 'frameSize', 'isReturnable', 'isExchangeable'
    ];

    const previous = {
      price: product.price,
      discountedPrice: product.discountedPrice,
      stock: product.stock
    };

    const changed = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined && String(req.body[field]) !== String(product[field])) {
        changed[field] = req.body[field];
      }
    });

    /*
     * A partial update, not `product.save()`. Saving the document fetched at the
     * top of this handler wrote every field back - so a seller who only corrected
     * a description or a price would silently restore the stock figure they had
     * read moments earlier, undoing the orders another buyer placed in between.
     * That mismatch is unrecoverable from the inventory screen, because the
     * displayed number simply stops agreeing with the movement log.
     */
    if (Object.keys(changed).length) {
      await Product.updateOne({ _id: product._id }, { $set: changed });
    }
    Object.assign(product, changed, { updatedAt: new Date() });

    // Audit trail for the seller: a price move gets its own mail, any other
    // field edit gets a summary. Never block the update if mailing fails.
    try {
      const Seller = (await import('../models/Seller.js')).default;
      const owner = await Seller.findById(product.seller).select('email storeName name').lean();
      const sellerEmail = owner?.email;
      const priceMoved =
        String(req.body.price) !== String(previous.price) ||
        String(req.body.discountedPrice) !== String(previous.discountedPrice);

      if (sellerEmail && priceMoved) {
        await sendPriceChangeNotification(
          sellerEmail, product,
          req.body.discountedPrice ?? req.body.price ?? previous.discountedPrice ?? previous.price,
          product.discountedPrice ?? product.price,
          'a listing edit'
        );
      }

      const summaryEntries = Object.entries(changed).filter(([k]) => !['price', 'discountedPrice'].includes(k));
      if (sellerEmail && summaryEntries.length) {
        await sendProductUpdateNotification(
          sellerEmail,
          product,
          Object.fromEntries(summaryEntries.map(([k, v]) => [k, Array.isArray(v) ? v.length + ' entries' : String(v).slice(0, 90)])),
          owner.storeName || owner.name || 'the seller'
        );
      }
    } catch (mailErr) {
      console.error('Listing notification email skipped:', mailErr.message);
    }

    res.json({
      success: true,
      message: 'Product updated successfully.',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/:id', verifySeller, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      seller: req.seller._id
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found or you do not have permission.' });
    }

    product.isActive = false;
    await product.save();

    await Seller.findByIdAndUpdate(req.seller._id, {
      $inc: { totalProducts: -1 }
    });

    res.json({
      success: true,
      message: 'Product deleted successfully.'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/:id/images', verifySeller, uploadProductImages, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      seller: req.seller._id
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found or you do not have permission.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images uploaded.' });
    }

    const imageUrls = req.files.map(file => `/uploads/products/${file.filename}`);
    product.images.push(...imageUrls);
    await product.save();

    res.json({
      success: true,
      message: 'Images uploaded successfully.',
      images: product.images
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

import Seller from '../models/Seller.js';

export default router;
