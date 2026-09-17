import express from 'express';
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator';
import Manufacturer from '../models/Manufacturer.js';
import Product from '../models/Product.js';
import ManufacturerSeller from '../models/ManufacturerSeller.js';
import ManufacturerStaff from '../models/ManufacturerStaff.js';
import { sendOTP } from '../services/email.js';
import multer from 'multer';
import xlsx from 'xlsx';

const router = express.Router();

const upload = multer({ dest: 'uploads/' });

const generateManufacturerToken = (manufacturerId) => {
  return jwt.sign({ id: manufacturerId, manufacturerId, role: 'manufacturer' }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

// Manufacturer Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const manufacturer = await Manufacturer.findOne({ email });
    if (!manufacturer) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!manufacturer.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    if (manufacturer.isBanned) {
      return res.status(403).json({ success: false, message: 'Account has been banned.' });
    }

    if (manufacturer.lockUntil && manufacturer.lockUntil > new Date()) {
      const remainingTime = Math.ceil((manufacturer.lockUntil - new Date()) / 1000 / 60);
      return res.status(423).json({ 
        success: false, 
        message: `Account is locked. Please try again in ${remainingTime} minutes.`,
        locked: true,
        lockUntil: manufacturer.lockUntil
      });
    }

    const isMatch = await manufacturer.comparePassword(password);
    if (!isMatch) {
      manufacturer.failedLoginAttempts = (manufacturer.failedLoginAttempts || 0) + 1;
      
      if (manufacturer.failedLoginAttempts >= 3) {
        manufacturer.lockUntil = new Date(Date.now() + 3 * 60 * 1000);
        manufacturer.failedLoginAttempts = 0;
        await manufacturer.save();
        
        return res.status(423).json({ 
          success: false, 
          message: 'Too many failed attempts. Account locked for 3 minutes.',
          locked: true,
          lockUntil: manufacturer.lockUntil
        });
      }
      
      await manufacturer.save();
      const remainingAttempts = 3 - manufacturer.failedLoginAttempts;
      return res.status(401).json({ 
        success: false, 
        message: `Invalid email or password. ${remainingAttempts} attempts remaining.`
      });
    }

    manufacturer.failedLoginAttempts = 0;
    manufacturer.lockUntil = null;

    const loginOtp = otpGenerator.generate('6789', { 
      upperCaseAlphabets: false, 
      specialChars: false, 
      lowerCaseAlphabets: false 
    });

    manufacturer.loginOtp = loginOtp;
    manufacturer.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await manufacturer.save();

    await sendOTP(email, loginOtp, 'login');

    res.json({
      success: true,
      message: 'Login OTP sent to your email.',
      manufacturerId: manufacturer._id
    });
  } catch (error) {
    console.error('Manufacturer login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
});

// Verify Manufacturer Login OTP
router.post('/verify-login-otp', async (req, res) => {
  try {
    const { manufacturerId, otp } = req.body;

    if (!manufacturerId || !otp) {
      return res.status(400).json({ success: false, message: 'Manufacturer ID and OTP are required.' });
    }

    const manufacturer = await Manufacturer.findById(manufacturerId);
    if (!manufacturer) {
      return res.status(404).json({ success: false, message: 'Manufacturer not found.' });
    }

    if (manufacturer.loginOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    if (new Date() > manufacturer.loginOtpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
    }

    manufacturer.loginOtp = undefined;
    manufacturer.loginOtpExpiry = undefined;
    manufacturer.lastLoginAt = new Date();
    await manufacturer.save();

    const token = generateManufacturerToken(manufacturer._id);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      manufacturer: manufacturer.toJSON()
    });
  } catch (error) {
    console.error('Verify manufacturer login OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Manufacturer Profile
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const manufacturer = await Manufacturer.findById(decoded.id);
    
    if (!manufacturer) {
      return res.status(404).json({ success: false, message: 'Manufacturer not found.' });
    }

    res.json({
      success: true,
      manufacturer: manufacturer.toJSON()
    });
  } catch (error) {
    console.error('Get manufacturer profile error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Add Product (Manufacturer)
router.post('/products', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const productData = {
      ...req.body,
      manufacturer: decoded.id,
      isManufacturerProduct: true
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product added successfully.',
      product
    });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Manufacturer Products
router.get('/products', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const products = await Product.find({ 
      manufacturer: decoded.id,
      isDiscontinued: false
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

// Update Product
router.put('/products/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const product = await Product.findOne({ 
      _id: req.params.id,
      manufacturer: decoded.id
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    Object.assign(product, req.body);
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

// Discontinue Product
router.post('/products/:id/discontinue', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const product = await Product.findOne({ 
      _id: req.params.id,
      manufacturer: decoded.id
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    product.isDiscontinued = true;
    product.discontinuedAt = new Date();
    product.discontinuedBy = decoded.id;
    await product.save();

    // Remove from all seller dashboards
    await Product.updateMany(
      { manufacturerProduct: product._id },
      { isActive: false }
    );

    res.json({
      success: true,
      message: 'Product discontinued successfully.'
    });
  } catch (error) {
    console.error('Discontinue product error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Re-continue Product
router.post('/products/:id/recontinue', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const product = await Product.findOne({ 
      _id: req.params.id,
      manufacturer: decoded.id
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    product.isDiscontinued = false;
    product.discontinuedAt = null;
    product.discontinuedBy = null;
    await product.save();

    res.json({
      success: true,
      message: 'Product re-continued successfully.'
    });
  } catch (error) {
    console.error('Recontinue product error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Bulk Upload Products via Spreadsheet
router.post('/products/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const products = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Validate required fields
      if (!row.title || !row.price || !row.category || !row.brand) {
        errors.push(`Row ${i + 2}: Missing required fields (title, price, category, brand)`);
        continue;
      }

      const productData = {
        title: row.title,
        description: row.description || '',
        price: parseFloat(row.price),
        discountedPrice: row.discountedPrice ? parseFloat(row.discountedPrice) : undefined,
        images: row.images ? row.images.split('|') : [],
        category: row.category,
        brand: row.brand,
        colors: row.colors ? row.colors.split('|').map(c => ({ name: c.trim() })) : [],
        sizes: row.sizes ? row.sizes.split('|').map(s => s.trim()) : [],
        stock: parseInt(row.stock) || 0,
        manufacturer: decoded.id,
        isManufacturerProduct: true
      };

      products.push(productData);
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation errors found.',
        errors
      });
    }

    const createdProducts = await Product.insertMany(products);

    res.json({
      success: true,
      message: `${createdProducts.length} products uploaded successfully.`,
      count: createdProducts.length
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Add Manufacturer Seller
router.post('/sellers', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const sellerData = {
      ...req.body,
      manufacturer: decoded.id,
      createdBy: decoded.id
    };

    const seller = new ManufacturerSeller(sellerData);
    await seller.save();

    // Send credentials email
    await sendOTP(seller.email, sellerData.password, 'credentials');

    res.status(201).json({
      success: true,
      message: 'Manufacturer seller added successfully.',
      seller
    });
  } catch (error) {
    console.error('Add manufacturer seller error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Manufacturer Sellers
router.get('/sellers', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const sellers = await ManufacturerSeller.find({ 
      manufacturer: decoded.id
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      sellers
    });
  } catch (error) {
    console.error('Get sellers error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Bulk Upload Manufacturer Sellers
router.post('/sellers/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const sellers = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Validate required fields
      if (!row.name || !row.email || !row.phone || !row.storeName || !row.manufacturerCode || 
          !row.gstNumber || !row.panNumber || !row.accountNumber || !row.ifscCode || 
          !row.bankName || !row.branchName) {
        errors.push(`Row ${i + 2}: Missing required fields`);
        continue;
      }

      // Generate random password
      const password = Math.random().toString(36).slice(-10) + 'A1!';

      const sellerData = {
        name: row.name,
        email: row.email,
        password: password,
        phone: row.phone,
        storeName: row.storeName,
        storeAddress: {
          street: row.street || '',
          city: row.city || '',
          state: row.state || '',
          pincode: row.pincode || ''
        },
        manufacturerCode: row.manufacturerCode,
        manufacturer: decoded.id,
        gstNumber: row.gstNumber,
        panNumber: row.panNumber,
        bankDetails: {
          accountNumber: row.accountNumber,
          ifscCode: row.ifscCode,
          bankName: row.bankName,
          branchName: row.branchName
        },
        createdBy: decoded.id
      };

      sellers.push(sellerData);
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation errors found.',
        errors
      });
    }

    const createdSellers = await ManufacturerSeller.insertMany(sellers);

    // Send credentials to all sellers
    for (const seller of createdSellers) {
      await sendOTP(seller.email, sellers.find(s => s.email === seller.email).password, 'credentials');
    }

    res.json({
      success: true,
      message: `${createdSellers.length} sellers added successfully.`,
      count: createdSellers.length
    });
  } catch (error) {
    console.error('Bulk upload sellers error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Ban Manufacturer Seller
router.post('/sellers/:id/ban', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const seller = await ManufacturerSeller.findOne({ 
      _id: req.params.id,
      manufacturer: decoded.id
    });

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    seller.isBanned = true;
    seller.banReason = req.body.reason || '';
    seller.bannedAt = new Date();
    seller.bannedBy = decoded.id;
    await seller.save();

    res.json({
      success: true,
      message: 'Seller banned successfully.'
    });
  } catch (error) {
    console.error('Ban seller error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Add Manufacturer Staff
router.post('/staff', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const staffData = {
      ...req.body,
      manufacturer: decoded.id,
      createdBy: decoded.id
    };

    const staff = new ManufacturerStaff(staffData);
    await staff.save();

    res.status(201).json({
      success: true,
      message: 'Staff added successfully.',
      staff
    });
  } catch (error) {
    console.error('Add staff error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Manufacturer Staff
router.get('/staff', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const staff = await ManufacturerStaff.find({ 
      manufacturer: decoded.id
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      staff
    });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
