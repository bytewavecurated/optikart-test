import express from 'express';
import Cart, { MAX_CART_ITEMS } from '../models/Cart.js';
import Product from '../models/Product.js';
import { verifyToken } from '../middleware/auth.js';
import { powerBoundsFor, validateContactLensPrescription } from '../services/contactLensRules.js';

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
      kind: 'spectacle',
      powerType: 'distance',
      withPower: true,
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
/**
 * Add a contact-lens order with its prescription.
 *
 * Powers are validated against what this specific SKU is made in, so a request
 * for a -9.00 sphere in a lens stocked only to -6.00 is rejected here rather
 * than after payment. Zero power is only accepted where the product allows it
 * (colour and cosmetic lenses), and box quantity is clamped to what the seller
 * actually holds for the chosen parameters.
 */
router.post('/add-contact-lens', verifyToken, async (req, res) => {
  try {
    const {
      productId,
      quantity = 1,
      withPower = true,
      power = {},
      lensesPerBox,
      replacement,
      colour,
      prescriptionImage
    } = req.body;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (!product.isActive) return res.status(400).json({ success: false, message: 'Product is not available.' });
    if (product.category !== 'contactlenses') {
      return res.status(400).json({ success: false, message: 'This endpoint is for contact lenses. Use the lens configurator for spectacles.' });
    }

    const bounds = powerBoundsFor(product);
    const wantsPower = !!withPower && bounds.powerType !== 'none' && bounds.withPowerAvailable;

    if (!wantsPower && !bounds.allowsZeroPower && bounds.powerType !== 'none') {
      return res.status(400).json({
        success: false,
        message: 'These are prescription lenses; a zero-power pair is not stocked for this product.'
      });
    }

    let validatedPower = null;
    if (wantsPower) {
      const check = validateContactLensPrescription(power, bounds);
      if (!check.valid) {
        return res.status(400).json({ success: false, message: 'Check your prescription', errors: check.errors });
      }
      validatedPower = {
        right: { sphere: Number(power.right?.sphere), cylinder: power.right?.cylinder === '' ? null : (power.right?.cylinder ?? null), axis: power.right?.axis ?? null, addition: power.right?.addition ?? null },
        left: { sphere: Number(power.left?.sphere), cylinder: power.left?.cylinder === '' ? null : (power.left?.cylinder ?? null), axis: power.left?.axis ?? null, addition: power.left?.addition ?? null }
      };
    }

    const box = Math.max(1, Number(lensesPerBox) || bounds.lensesPerBox || 6);
    const boxes = Math.max(1, Math.min(20, Number(quantity) || 1));
    const units = box * boxes;

    if ((product.stock || 0) < units) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock || 0} lens${(product.stock || 0) === 1 ? '' : 'es'} in stock. ${boxes} box${boxes === 1 ? '' : 'es'} of ${box} needs ${units}.`
      });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, items: [] });

    const fingerprint = (p) => [p?.right?.sphere, p?.right?.cylinder, p?.right?.axis, p?.right?.addition, p?.left?.sphere, p?.left?.cylinder, p?.left?.axis, p?.left?.addition].map((v) => (v ?? '')).join(':');

    const existing = cart.items.find((it) =>
      String(it.product) === String(productId)
      && it.lensConfig?.kind === 'contact-lens'
      && fingerprint(it.lensConfig?.power) === fingerprint(validatedPower));

    if (existing) {
      const nextUnits = (existing.quantity || 1) * (existing.lensConfig?.boxesPerLine ? existing.lensConfig.lensesPerBox : 1);
      if ((product.stock || 0) < nextUnits + units) {
        return res.status(400).json({ success: false, message: 'Not enough stock to increase this box quantity.' });
      }
      existing.quantity += boxes;
    } else {
      if (cart.totalItems + boxes > MAX_CART_ITEMS) {
        return res.status(400).json({ success: false, message: `Cart can have a maximum of ${MAX_CART_ITEMS} items.` });
      }
      cart.items.push({
        product: productId,
        variant: { color: colour || '', lensType: 'contact-lens' },
        lensConfig: {
          kind: 'contact-lens',
          powerType: bounds.powerType,
          withPower: wantsPower,
          lensesPerBox: box,
          boxesPerLine: true,
          replacement: replacement || product.contactLens?.replacementPeriod || 'monthly',
          colour: colour || product.contactLens?.colorTone || '',
          power: validatedPower,
          prescriptionFileUrl: typeof prescriptionImage === 'string' ? prescriptionImage : '',
          prescriptionMethod: prescriptionImage ? 'upload' : (wantsPower ? 'manual' : 'none'),
          // Contact lenses carry no extra lens cost; the box price is the product.
          prescriptionPrice: 0
        },
        quantity: boxes,
        price: product.discountedPrice || product.price
      });
    }

    cart.totalItems = cart.items.reduce((s, item) => s + item.quantity, 0);
    await cart.save();
    cart = await Cart.findById(cart._id).populate('items.product', 'title images price discountedPrice stock brand');

    res.json({ success: true, message: 'Added to cart.', cart, units });
  } catch (error) {
    console.error('Add contact lens to cart error:', error);
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
