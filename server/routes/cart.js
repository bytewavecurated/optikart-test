import express from 'express';
import Cart, { MAX_CART_ITEMS } from '../models/Cart.js';
import Product from '../models/Product.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'title images price discountedPrice stock isActive brand');

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
      await cart.save();
    }

    const validItems = cart.items.filter(item => item.product && item.product.isActive);

    if (validItems.length !== cart.items.length) {
      cart.items = validItems;
      cart.totalItems = validItems.reduce((sum, item) => sum + item.quantity, 0);
      await cart.save();
    }

    res.json({ success: true, cart });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/add', verifyToken, async (req, res) => {
  try {
    const { productId, variant, quantity = 1 } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    if (!product.isActive) {
      return res.status(400).json({ success: false, message: 'Product is not available.' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock.' });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    const existingItem = cart.items.find(item =>
      item.product.toString() === productId &&
      JSON.stringify(item.variant) === JSON.stringify(variant || {})
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stock) {
        return res.status(400).json({ success: false, message: 'Exceeds available stock.' });
      }
      existingItem.quantity = newQuantity;
    } else {
      if (cart.totalItems >= MAX_CART_ITEMS) {
        return res.status(400).json({ success: false, message: `Cart can have a maximum of ${MAX_CART_ITEMS} items.` });
      }

      const price = product.discountedPrice || product.price;
      cart.items.push({
        product: productId,
        variant: variant || {},
        quantity,
        price
      });
    }

    cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    await cart.save();

    cart = await Cart.findById(cart._id)
      .populate('items.product', 'title images price discountedPrice stock');

    res.json({
      success: true,
      message: 'Item added to cart.',
      cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Add an eyeglass product together with its full lens configuration.
// The lens options the customer picked are stored on the cart line so the
// seller can see the exact configuration and build the product accordingly.
router.post('/add-lens', verifyToken, async (req, res) => {
  try {
    const { productId, quantity = 1, lensConfiguration = {} } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    if (!product.isActive) {
      return res.status(400).json({ success: false, message: 'Product is not available.' });
    }
    if (product.stock < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock.' });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }
    if (cart.totalItems + quantity > MAX_CART_ITEMS) {
      return res.status(400).json({ success: false, message: `Cart can have a maximum of ${MAX_CART_ITEMS} items.` });
    }

    const rx = lensConfiguration.prescription || {};
    const lensConfig = {
      lensType: lensConfiguration.lensType || '',
      lensPackage: lensConfiguration.material || '',
      coating: lensConfiguration.coating || '',
      power: {
        sphereRight: String(rx.rightEye?.sphere ?? ''),
        sphereLeft: String(rx.leftEye?.sphere ?? ''),
        cylRight: String(rx.rightEye?.cylinder ?? ''),
        cylLeft: String(rx.leftEye?.cylinder ?? ''),
        axisRight: String(rx.rightEye?.axis ?? ''),
        axisLeft: String(rx.leftEye?.axis ?? ''),
        addRight: String(rx.rightEye?.add ?? ''),
        addLeft: String(rx.leftEye?.add ?? '')
      },
      prescriptionMethod: lensConfiguration.prescriptionFile ? 'upload' : (lensConfiguration.prescription ? 'manual' : 'none'),
      prescriptionFileUrl: typeof lensConfiguration.prescriptionFile === 'string' ? lensConfiguration.prescriptionFile : '',
      prescriptionPrice: Number(lensConfiguration.price || 0)
    };

    const basePrice = product.discountedPrice || product.price;

    cart.items.push({
      product: productId,
      variant: { lensType: lensConfig.lensType },
      lensConfig,
      quantity,
      price: basePrice + lensConfig.prescriptionPrice
    });

    cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    await cart.save();

    cart = await Cart.findById(cart._id)
      .populate('items.product', 'title images price discountedPrice stock');

    res.json({ success: true, message: 'Item added to cart with lens configuration.', cart });
  } catch (error) {
    console.error('Add lens item to cart error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});
router.put('/update', verifyToken, async (req, res) => {
  try {
    const { productId, variant, quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found.' });
    }

    const item = cart.items.find(item =>
      item.product.toString() === productId &&
      JSON.stringify(item.variant) === JSON.stringify(variant || {})
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in cart.' });
    }

    const product = await Product.findById(productId);
    if (quantity > product.stock) {
      return res.status(400).json({ success: false, message: 'Exceeds available stock.' });
    }

    item.quantity = quantity;
    cart.totalItems = cart.items.reduce((sum, i) => sum + i.quantity, 0);
    await cart.save();

    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'title images price discountedPrice stock');

    res.json({
      success: true,
      message: 'Cart updated.',
      cart: updatedCart
    });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/remove/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { variant } = req.query;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found.' });
    }

    cart.items = cart.items.filter(item => {
      if (variant) {
        return !(item.product.toString() === productId && JSON.stringify(item.variant) === variant);
      }
      return item.product.toString() !== productId;
    });

    cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    await cart.save();

    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'title images price discountedPrice stock');

    res.json({
      success: true,
      message: 'Item removed from cart.',
      cart: updatedCart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/clear', verifyToken, async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { items: [], totalItems: 0 }
    );

    res.json({
      success: true,
      message: 'Cart cleared.'
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
