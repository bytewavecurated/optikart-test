import express from 'express';
import Product from '../models/Product.js';
import { verifySeller, optionalAuth } from '../middleware/auth.js';
import { productValidation } from '../middleware/validate.js';
import { uploadProductImages } from '../middleware/upload.js';

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      page = 1, limit = 20, search, category, brand, minPrice, maxPrice, 
      frameShape, frameColor, lensType, gender, frameSize, sort, hasOffer, seller: isSeller 
    } = req.query;

    const query = { isActive: true };

    if (search) {
      query.$text = { $search: search };
    }
    if (category) query.category = category;
    if (brand) query.brand = brand;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseInt(minPrice);
      if (maxPrice) query.price.$lte = parseInt(maxPrice);
    }
    if (frameShape) query.frameShape = frameShape;
    if (frameColor) query.frameColor = frameColor;
    if (lensType) query.lensType = lensType;
    if (gender) query.gender = gender;
    if (frameSize) query.frameSize = frameSize;
    if (hasOffer === 'true') {
      query.$or = [
        { 'sellerOffer.isActive': true, 'sellerOffer.type': { $ne: 'none' } },
        { isUnderSaleEvent: true }
      ];
    }
    if (isSeller === 'true' && req.user) {
      query.seller = req.user._id || req.user.sellerId;
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    else if (sort === 'price_desc') sortOption = { price: -1 };
    else if (sort === 'rating') sortOption = { totalRatings: -1 };
    else if (sort === 'newest') sortOption = { createdAt: -1 };
    else if (sort === 'popularity') sortOption = { viewCount: -1 };
    else if (sort === 'discount') sortOption = { discountedPrice: 1 };

    const products = await Product.find(query)
      .populate('seller', 'storeName storeLogo rating sellerId createdAt')
      .sort(sortOption)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

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

router.get('/brands', async (req, res) => {
  try {
    const brands = await Product.distinct('brand', { isActive: true });
    res.json({ success: true, brands: brands.sort() });
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
        count: await Product.countDocuments({ category: cat, isActive: true })
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
      isActive: true,
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
      isActive: true,
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

    const query = { isActive: true };
    if (category) query.category = category;

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

router.get('/filters', async (req, res) => {
  try {
    const brands = await Product.distinct('brand', { isActive: true });
    const frameShapes = await Product.distinct('frameShape', { isActive: true });
    const frameColors = await Product.distinct('frameColor', { isActive: true });
    const lensTypes = await Product.distinct('lensType', { isActive: true });
    const genders = await Product.distinct('gender', { isActive: true });
    const frameSizes = await Product.distinct('frameSize', { isActive: true });
    const categories = await Product.distinct('category', { isActive: true });
    
    const priceRange = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }
    ]);

    res.json({
      success: true,
      filters: {
        brands: brands.filter(Boolean).sort(),
        frameShapes: frameShapes.filter(Boolean).sort(),
        frameColors: frameColors.filter(Boolean).sort(),
        lensTypes: lensTypes.filter(Boolean).sort(),
        genders: genders.filter(Boolean).sort(),
        frameSizes: frameSizes.filter(Boolean).sort(),
        categories: categories.filter(Boolean).sort(),
        priceRange: {
          min: priceRange[0]?.min || 0,
          max: priceRange[0]?.max || 10000
        }
      }
    });
  } catch (error) {
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
      'gender', 'frameSize'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    await product.save();

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
