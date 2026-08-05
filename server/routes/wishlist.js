import express from 'express';
import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id })
      .populate('products.product', 'title images price discountedPrice brand isActive');

    if (!wishlist) {
      wishlist = new Wishlist({ user: req.user._id, products: [] });
      await wishlist.save();
    }

    const validProducts = wishlist.products.filter(p => p.product && p.product.isActive);
    if (validProducts.length !== wishlist.products.length) {
      wishlist.products = validProducts;
      await wishlist.save();
    }

    res.json({ success: true, wishlist });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/add', verifyToken, async (req, res) => {
  try {
    const { productId } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = new Wishlist({ user: req.user._id, products: [] });
    }

    const alreadyExists = wishlist.products.some(
      p => p.product.toString() === productId
    );

    if (alreadyExists) {
      return res.status(400).json({ success: false, message: 'Product already in wishlist.' });
    }

    wishlist.products.push({
      product: productId,
      addedAt: new Date()
    });

    await wishlist.save();

    wishlist = await Wishlist.findById(wishlist._id)
      .populate('products.product', 'title images price discountedPrice brand');

    res.json({
      success: true,
      message: 'Product added to wishlist.',
      wishlist
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/remove/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist not found.' });
    }

    wishlist.products = wishlist.products.filter(
      p => p.product.toString() !== productId
    );

    await wishlist.save();

    wishlist = await Wishlist.findById(wishlist._id)
      .populate('products.product', 'title images price discountedPrice brand');

    res.json({
      success: true,
      message: 'Product removed from wishlist.',
      wishlist
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
