import express from 'express';
import { signSession, logoutHandler } from '../services/session.js';
import { declareSupply, pauseListing } from '../services/listingApproval.js';
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator';
import ManufacturerSeller from '../models/ManufacturerSeller.js';
import Product from '../models/Product.js';
import { sendOTP } from '../services/email.js';
import { verifyManufacturerSeller } from '../middleware/auth.js';
import { otpBypassAllowed } from '../config/authMode.js';

const router = express.Router();

/*
 * One shape for every branch of the toggle.
 *
 * The declare, pause and re-declare paths each assembled their own response, and
 * a caller reading `product.verificationStatus` got `undefined` from the two
 * branches that omitted it - which is how a test can "pass" against a listing it
 * never actually looked at, and how a UI shows a blank status for a claim that is
 * sitting in a queue.
 */
const listingSummary = (doc) => ({
  _id: doc._id,
  title: doc.title,
  verificationStatus: doc.verificationStatus,
  isListed: !!doc.isListed,
  price: doc.price,
  listing: doc.listing
});

/*
 * Ends this session server-side. Without it, signing out only discarded the
 * token in one browser, and any other copy of that string kept working until it
 * expired on its own. See services/session.js.
 */
router.post('/logout', verifyManufacturerSeller, logoutHandler('manufacturerSeller'));

const generateManufacturerSellerToken = (sellerId) => {
  return signSession({ id: sellerId, sellerId, role: 'manufacturerSeller' }, { expiresIn: '24h' });
};

// Manufacturer Seller Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const seller = await ManufacturerSeller.findOne({ email });
    if (!seller) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!seller.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    if (seller.isBanned) {
      return res.status(403).json({ success: false, message: 'Account has been banned.' });
    }

    if (seller.lockUntil && seller.lockUntil > new Date()) {
      const remainingTime = Math.ceil((seller.lockUntil - new Date()) / 1000 / 60);
      return res.status(423).json({ 
        success: false, 
        message: `Account is locked. Please try again in ${remainingTime} minutes.`,
        locked: true,
        lockUntil: seller.lockUntil
      });
    }

    const isMatch = await seller.comparePassword(password);
    if (!isMatch) {
      seller.failedLoginAttempts = (seller.failedLoginAttempts || 0) + 1;
      
      if (seller.failedLoginAttempts >= 3) {
        seller.lockUntil = new Date(Date.now() + 3 * 60 * 1000);
        seller.failedLoginAttempts = 0;
        await seller.save();
        
        return res.status(423).json({ 
          success: false, 
          message: 'Too many failed attempts. Account locked for 3 minutes.',
          locked: true,
          lockUntil: seller.lockUntil
        });
      }
      
      await seller.save();
      const remainingAttempts = 3 - seller.failedLoginAttempts;
      return res.status(401).json({ 
        success: false, 
        message: `Invalid email or password. ${remainingAttempts} attempts remaining.`
      });
    }

    seller.failedLoginAttempts = 0;
    seller.lockUntil = null;

    // Check if this is a test credential - bypass OTP for testing
    const testManufacturerSellerEmails = ['rayban.retailer1@optikart.com'];
    // Second-factor OTP may only be skipped outside production, and only
    // for the well-known seededdemo accounts whose password is also public.
    const isTestCredential = otpBypassAllowed(testManufacturerSellerEmails, email);

    if (isTestCredential) {
      // Direct login for test credentials
      const token = generateManufacturerSellerToken(seller._id);
      seller.loginTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      seller.lastLoginAt = new Date();
      await seller.save();

      res.json({
        success: true,
        message: 'Login successful.',
        token,
        seller: seller.toJSON()
      });
    } else {
      const loginOtp = otpGenerator.generate(6, { 
        upperCaseAlphabets: false, 
        specialChars: false, 
        lowerCaseAlphabets: false 
      });

      seller.loginOtp = loginOtp;
      seller.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await seller.save();

      await sendOTP(email, loginOtp, 'login');

      res.json({
        success: true,
        requiresOTP: true,
        message: 'Login OTP sent to your email.',
        sellerId: seller._id
      });
    }
  } catch (error) {
    console.error('Manufacturer seller login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
});

// Verify Manufacturer Seller Login OTP
router.post('/verify-login-otp', async (req, res) => {
  try {
    const { sellerId, otp } = req.body;

    if (!sellerId || !otp) {
      return res.status(400).json({ success: false, message: 'Seller ID and OTP are required.' });
    }

    const seller = await ManufacturerSeller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    if (seller.loginOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    if (new Date() > seller.loginOtpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
    }

    seller.loginOtp = undefined;
    seller.loginOtpExpiry = undefined;
    seller.lastLoginAt = new Date();
    await seller.save();

    const token = generateManufacturerSellerToken(seller._id);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      seller: seller.toJSON()
    });
  } catch (error) {
    console.error('Verify manufacturer seller login OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Manufacturer Seller Profile
router.get('/me', verifyManufacturerSeller, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const seller = await ManufacturerSeller.findById(req.manufacturerSeller._id);
    
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    res.json({
      success: true,
      seller: seller.toJSON()
    });
  } catch (error) {
    console.error('Get manufacturer seller profile error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Available Products from Manufacturer
router.get('/available-products', verifyManufacturerSeller, async (req, res) => {
  try {
    
    const seller = await ManufacturerSeller.findById(req.manufacturerSeller._id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    const products = await Product.find({ 
      manufacturer: seller.manufacturer,
      isDiscontinued: false
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Get available products error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/*
 * List a brand product in this shop, or stop listing it.
 *
 * Two things changed here. Pausing no longer deletes: the old branch ran
 * `Product.findByIdAndDelete`, which took the shop's price, its variant stock
 * ledger, and every order line that pointed at the listing with it - so a shop
 * that sold out for a week lost the record of having ever stocked the frame.
 *
 * And listing is no longer self-service. The copy used to be created from the
 * brand record with that record's `status: 'verified'` intact, which put it on
 * the storefront immediately: a shop could list frames it had never been
 * supplied with, because a black-market purchase looks identical to a supplied
 * one in the data. Now a listing starts as a claim, the brand approves the
 * claim, and the platform verifies the copy. See services/listingApproval.js.
 */
router.post('/products/:id/toggle', verifyManufacturerSeller, async (req, res) => {
  try {
    const retailer = await ManufacturerSeller.findById(req.manufacturerSeller._id);
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    const brandProduct = await Product.findById(req.params.id);
    if (!brandProduct) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const existing = await Product.findOne({
      manufacturerProduct: brandProduct._id,
      seller: retailer._id
    });

    if (existing) {
      const state = existing.listing?.state;
      if (state === 'paused') {
        // Coming back costs a fresh declaration and both sign-offs again.
        const result = await declareSupply({
          doc: existing,
          kind: 'storefront',
          product: brandProduct,
          actorLabel: retailer.storeName || retailer.name || 'retailer',
          proof: { kind: req.body?.proofKind, reference: req.body?.proofReference, note: req.body?.proofNote },
          brandLinked: true
        });
        if (!result.success) return res.status(400).json({ success: false, message: result.message, reason: result.reason });
        return res.json({
          success: true,
          state: result.state,
          message: 'Listing re-declared. It goes back through the brand and the platform before it sells again; your price, variants and stock are unchanged.',
          product: listingSummary(existing)
        });
      }
      const paused = await pauseListing({
        listingKind: 'storefront',
        id: existing._id,
        actorLabel: retailer.storeName || retailer.name || 'retailer',
        reason: req.body?.reason || ''
      });
      return res.json(paused.success
        ? { success: true, state: 'paused', message: paused.message, product: listingSummary(existing) }
        : { success: false, message: paused.message });
    }

    if (!brandProduct.manufacturer) {
      return res.status(400).json({
        success: false,
        message: 'That product is not linked to a brand, so it cannot be stocked from here.'
      });
    }
    if (String(brandProduct.manufacturer) !== String(retailer.manufacturer || '')) {
      return res.status(403).json({
        success: false,
        message: "Only your own brand's catalogue can be stocked here."
      });
    }

    const sellerProduct = new Product({
      ...brandProduct.toObject(),
      _id: undefined,
      manufacturerProduct: brandProduct._id,
      manufacturerSellerId: retailer._id,
      seller: retailer._id,
      // Never copied: the brand's verification is not this shop's, and a copy
      // that inherited it would reach the storefront before anyone confirmed
      // where the goods came from.
      verificationStatus: 'pending',
      isListed: false,
      price: req.body?.price || brandProduct.price,
      discountedPrice: req.body?.discountedPrice || brandProduct.discountedPrice,
      stock: req.body?.stock || 0,
      colors: req.body?.colors || brandProduct.colors,
      sizes: req.body?.sizes || brandProduct.sizes,
      stockDetail: Array.isArray(req.body?.stockDetail) ? req.body.stockDetail : brandProduct.stockDetail
    });

    const declared = await declareSupply({
      doc: sellerProduct,
      kind: 'storefront',
      product: brandProduct,
      actorLabel: retailer.storeName || retailer.name || 'retailer',
      proof: { kind: req.body?.proofKind, reference: req.body?.proofReference, note: req.body?.proofNote },
      brandLinked: true
    });

    if (!declared.success) {
      return res.status(400).json({
        success: false,
        message: declared.message,
        reason: declared.reason,
        // The shop keeps what it typed, so a refused declaration does not
        // discard the pricing work behind the missing sentence.
        draft: { price: sellerProduct.price, stock: sellerProduct.stock }
      });
    }

    retailer.products.push(sellerProduct._id);
    await retailer.save();

    return res.status(201).json({
      success: true,
      state: declared.state,
      message: declared.message,
      product: listingSummary(sellerProduct)
    });
  } catch (error) {
    console.error('Toggle product error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Seller's Products
router.get('/products', verifyManufacturerSeller, async (req, res) => {
  try {
    
    const products = await Product.find({ 
      manufacturerSellerId: req.manufacturerSeller._id
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
