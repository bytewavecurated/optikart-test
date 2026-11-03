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
import { verifyManufacturer } from '../middleware/auth.js';

import {
  deleteManufacturerSeller,
  banManufacturerSeller,
  validateBulkUpload,
  getManufacturerPendingProducts,
  updatePendingProduct,
  deletePendingProduct
} from '../services/manufacturerEnhancements.js';
const router = express.Router();
/**
 * Copy remote image links into our own store.
 *
 * Manufacturer sheets carry image URLs. Left as-is, a dead third-party link
 * breaks a live listing, so each URL is fetched once and served from our own
 * uploads directory; anything that cannot be fetched fails the import loudly
 * rather than publishing a broken product.
 */
const IMAGE_HOSTS_ALLOW = /\.(jpe?g|png|webp|gif|avif|svg)$/i;
const storeRemoteImages = async (urls = [], ownerHint = 'manufacturer', subdir = 'products') => {
  const fsMod = await import('fs');
  const pathMod = await import('path');
  const dirMod = await import('url');
  const out = [];
  for (const raw of urls) {
    const url = String(raw || '').trim();
    if (!url) continue;
    if (url.startsWith('/uploads/')) { out.push(url); continue; }
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error(`"${url}" is not a valid image URL`); }
    if (!/^https?:$/.test(parsed.protocol)) throw new Error(`"${url}" is not an http(s) URL`);
    const extMatch = parsed.pathname.match(IMAGE_HOSTS_ALLOW);
    if (!extMatch) throw new Error(`"${url}" does not point at an image file`);

    let res;
    try {
      res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    } catch (e) {
      throw new Error(`could not download ${url}: ${e.message}`);
    }
    if (!res.ok) throw new Error(`could not download ${url} (HTTP ${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error(`${url} returned no data`);
    if (buf.length > 8 * 1024 * 1024) throw new Error(`${url} is larger than 8 MB`);

    const { fileURLToPath } = dirMod;
    const dir = pathMod.join(pathMod.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', subdir);
    fsMod.mkdirSync(dir, { recursive: true });
    const safe = `${ownerHint}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extMatch[0]}`;
    fsMod.writeFileSync(pathMod.join(dir, safe), buf);
    out.push(`/uploads/${subdir}/${safe}`);
  }
  return out;
};



/*
 * Sheet cells and form fields carry the size printed on the temple
 * (52-17-140), while the schema keeps a coarse bucket. Derive the bucket from the
 * lens width and keep the measurement in dimensions, rather than rejecting a
 * manufacturer's own numbers with an enum error.
 */
const FRAME_SIZE_BUCKETS = [['extra-large', 59], ['large', 55], ['medium', 51]];
/*
 * The schema lists frameShape/frameType/... as enumerations, and a manufacturer's
 * spreadsheet spells them however the shop spells them ("Square", "Full Rim",
 * "cat eye"). Comparing case-insensitively and with separators removed accepts the
 * word the shop wrote instead of failing the row on punctuation, but a value that
 * matches nothing is reported as that row's problem rather than thrown as a 500
 * that loses the whole file.
 */
const ENUM_ALIASES = {
  frameShape: 'frameShape',
  frameType: 'frameType',
  frameMaterial: 'frameMaterial',
  gender: 'gender'
};

const enumsOf = (Model, path) => (Model.schema.path(path)?.options?.enum) || [];

const matchEnum = (Model, path, value) => {
  const allowed = enumsOf(Model, path);
  const raw = String(value ?? '').trim();
  if (!raw) return { value: raw, unknown: false };
  if (allowed.includes(raw)) return { value: raw, unknown: false };
  const loose = raw.toLowerCase().replace(/[\s_-]/g, '');
  const hit = allowed.find((a) => String(a).toLowerCase().replace(/[\s_-]/g, '') === loose);
  return hit !== undefined ? { value: hit, unknown: false } : { value: raw, unknown: true };
};

const frameSizeBucket = (raw) => {
  const lens = Number(String(raw ?? '').split(/[-\u00D7x\s,]+/)[0]);
  if (!Number.isFinite(lens) || lens <= 0) return 'medium';
  for (const [bucket, min] of FRAME_SIZE_BUCKETS) if (lens >= min) return bucket;
  return 'small';
};
const measureFromSize = (raw) => {
  const [lens, bridge, temple] = String(raw ?? '').split(/[-\u00D7x\s,]+/).map(Number);
  return { lens, bridge, temple };
};

/*
 * Device photo upload for a single product. The form accepted only image URLs,
 * so a shop holding real photographs had nowhere to put them. Files arrive as
 * multipart, are checked for type and size, and go into uploads/products under
 * the same naming convention storeRemoteImages() already uses.
 */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 }
});

const looksLikeImage = (buf) => {
  if (!buf || buf.length < 12) return false;
  const head = buf.subarray(0, 12);
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  const isGif = head.subarray(0, 3).toString('ascii') === 'GIF';
  const isWebp = head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP';
  const isAvif = head.subarray(4, 12).toString('ascii').includes('avif');
  return isJpeg || isPng || isGif || isWebp || isAvif;
};

const EXT_BY_MIME = {
  'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
  'image/gif': '.gif', 'image/webp': '.webp', 'image/avif': '.avif'
};

router.post('/products/upload-images', verifyManufacturer, imageUpload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ success: false, message: 'No image files were received.' });
    }
    const fsMod = await import('fs');
    const pathMod = await import('path');
    const urlMod = await import('url');
    const { fileURLToPath } = urlMod;
    const dir = pathMod.join(pathMod.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', 'products');
    fsMod.mkdirSync(dir, { recursive: true });

    const saved = [];
    const rejected = [];
    for (const file of req.files) {
      if (!looksLikeImage(file.buffer)) {
        rejected.push(`"${file.originalname}" is not a picture we can use (accepted: JPG, PNG, GIF, WebP, AVIF)`);
        continue;
      }
      const ext = EXT_BY_MIME[file.mimetype] || '.jpg';
      const safe = `mfg-${req.manufacturer._id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      fsMod.writeFileSync(pathMod.join(dir, safe), file.buffer);
      saved.push(`/uploads/products/${safe}`);
    }

    if (!saved.length) {
      return res.status(400).json({ success: false, message: rejected.join('; ') || 'None of the files you picked were pictures.' });
    }
    res.status(201).json({ success: true, urls: saved, rejected });
  } catch (error) {
    if (error && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Each image must be 8 MB or smaller.' });
    }
    console.error('Product image upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Image upload failed.' });
  }
});

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

    // Check if this is a test credential - bypass OTP for testing
    const testManufacturerEmails = ['rayban.manufacturer@optikart.com'];
    // Second-factor OTP may only be skipped outside production, and only
    // for the well-known seededdemo accounts whose password is also public.
    const allowOtpBypass = process.env.NODE_ENV !== 'production' && process.env.AUTH_OTP_BYPASS !== 'false';
    const isTestCredential = allowOtpBypass && testManufacturerEmails.includes(email);

    if (isTestCredential) {
      // Direct login for test credentials
      const token = generateManufacturerToken(manufacturer._id);
      manufacturer.loginTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      manufacturer.lastLoginAt = new Date();
      await manufacturer.save();

      res.json({
        success: true,
        message: 'Login successful.',
        token,
        manufacturer: manufacturer.toJSON()
      });
    } else {
      const loginOtp = otpGenerator.generate(6, { 
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
        requiresOTP: true,
        message: 'Login OTP sent to your email.',
        manufacturerId: manufacturer._id
      });
    }
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
router.get('/me', verifyManufacturer, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const manufacturer = await Manufacturer.findById(req.manufacturer._id);
    
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
router.post('/products', verifyManufacturer, async (req, res) => {
  try {
    
    // The measured size ("54-16-135") is normalised into the schema's bucket, and
    // the numbers themselves are kept where the product page reads them.
    const incoming = { ...req.body };
    const measured = String(incoming.frameSize ?? '').trim();
    if (measured && !['small', 'medium', 'large', 'extra-large'].includes(measured.toLowerCase())) {
      incoming.frameSize = frameSizeBucket(measured);
      const { lens, bridge, temple } = measureFromSize(measured);
      const dims = incoming.dimensions && typeof incoming.dimensions === 'object' ? incoming.dimensions : {};
      incoming.dimensions = {
        width: Number.isFinite(dims.width) ? dims.width : lens,
        height: Number.isFinite(dims.height) ? dims.height : undefined,
        bridge: Number.isFinite(dims.bridge) ? dims.bridge : bridge,
        temple: Number.isFinite(dims.temple) ? dims.temple : temple
      };
    }

    const productData = {
      ...incoming,
      manufacturer: req.manufacturer._id,
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
router.get('/products', verifyManufacturer, async (req, res) => {
  try {
    
    const products = await Product.find({ 
      manufacturer: req.manufacturer._id,
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
router.put('/products/:id', verifyManufacturer, async (req, res) => {
  try {
    
    const product = await Product.findOne({ 
      _id: req.params.id,
      manufacturer: req.manufacturer._id
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
router.post('/products/:id/discontinue', verifyManufacturer, async (req, res) => {
  try {
    
    const product = await Product.findOne({ 
      _id: req.params.id,
      manufacturer: req.manufacturer._id
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    product.isDiscontinued = true;
    product.discontinuedAt = new Date();
    product.discontinuedBy = req.manufacturer._id;
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
router.post('/products/:id/recontinue', verifyManufacturer, async (req, res) => {
  try {
    
    const product = await Product.findOne({ 
      _id: req.params.id,
      manufacturer: req.manufacturer._id
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
router.post('/products/bulk-upload', verifyManufacturer, upload.single('file'), async (req, res) => {
  try {
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const products = [];
    const errors = [];

    // Sunglasses and eyeglasses must arrive in separate files: mixed uploads
    // are the commonest cause of a whole sheet being mapped to one category.
    const categoriesSeen = new Set();
    const list = (v, map) => String(v ?? '').split('|').map((x) => map ? map(x) : x.trim()).filter(Boolean);

    // sheet_to_json() already uses the first spreadsheet line as the column
    // names, so data[0] is a real product row. Starting at 1 silently dropped the
    // first row of every upload while still replying "success".
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || Object.values(row).every((v) => v === '' || v === undefined || v === null)) continue;
      const line = i + 2; // spreadsheet row: the header is line 1

      // Column names are matched loosely so a sheet exported from Excel with
      // spaces or capital letters still loads.
      const get = (...keys) => {
        for (const k of Object.keys(row)) {
          const norm = String(k).toLowerCase().replace(/[\s_-]/g, '');
          if (keys.some((key) => norm === key)) return row[k];
        }
        return undefined;
      };

      const title = String(get('title', 'name', 'productname') ?? '').trim();
      const price = Number(get('price', 'sellingprice'));
      const categoryRaw = String(get('category') ?? '').trim();
      const brand = String(get('brand', 'brandname') ?? '').trim();
      const genderRaw = String(get('gender') ?? '').trim();

      const missing = [];
      if (!title) missing.push('title');
      if (!Number.isFinite(price) || price <= 0) missing.push('price');
      if (!categoryRaw) missing.push('category');
      if (!brand) missing.push('brand');
      if (!String(get('description') ?? '').trim()) missing.push('description');
      if (!String(get('modelnumber', 'modelno', 'model') ?? '').trim()) missing.push('modelNumber');
      if (!String(get('productcode', 'productid', 'sku') ?? '').trim()) missing.push('productCode');

      const category = String(categoryRaw).toLowerCase().replace(/[\s_-]/g, '');
      const EYEWEAR = ['sunglasses', 'eyeglasses', 'readingglasses', 'sportseyewear', 'kids'];
      if (category && !EYEWEAR.includes(category) && !['contactlenses', 'solution', 'accessories'].includes(category)) {
        errors.push(`Row ${line}: unknown category "${categoryRaw}". Use sunglasses, eyeglasses, readingglasses, sportseyewear, kids, contactlenses, solution or accessories.`);
        continue;
      }
      if (EYEWEAR.includes(category)) {
        categoriesSeen.add(category);
        if (!genderRaw) missing.push('gender');
        if (!String(get('frameshape', 'faceshape') ?? '').trim()) missing.push('frameShape');
        if (!String(get('frametype') ?? '').trim()) missing.push('frameType');
        if (!String(get('framematerial', 'material') ?? '').trim()) missing.push('frameMaterial');
        if (!String(get('framesize', 'size') ?? '').trim()) missing.push('frameSize');
        if (!String(get('framewidth') ?? '').trim()) missing.push('frameWidth');
        if (!String(get('frameweight') ?? '').trim()) missing.push('frameWeight');
        const sizeParts = measureFromSize(get('framesize', 'size'));
        const dimGiven = String(get('framedimensions', 'dimensions') ?? '').trim()
          || (sizeParts.lens && sizeParts.temple)
          || ['width', 'height', 'bridge', 'temple'].every((k) => Number(String(get('dim' + k) ?? '')) > 0);
        if (!dimGiven) missing.push('dimensions (one string like 54 x 52 x 16 x 145, or the four dimWidth/dimHeight/dimBridge/dimTemple columns)');
        if (!String(get('framecolor', 'color', 'colours') ?? '').trim()) missing.push('frameColor');
        if (/^kids$/.test(category) || String(genderRaw).toLowerCase() === 'kids') {
          if (!String(get('subgender', 'boygirl') ?? '').trim()) missing.push('subGender (boys or girls)');
          if (!String(get('agegroup', 'age') ?? '').trim()) missing.push('ageGroup');
        }
      } else if (category === 'contactlenses') {
        ['powertype', 'lensesperbox', 'replacementperiod', 'diameter', 'basecurve', 'watercontent'].forEach((k) => {
          if (!String(get(k) ?? '').trim()) missing.push(k);
        });
      }

      if (missing.length) {
        errors.push(`Row ${line} (${title || 'untitled'}): missing required ${missing.join(', ')}`);
        continue;
      }

      const imageField = String(get('images', 'image', 'imagelinks', 'imageurls') ?? '').trim();
      if (!imageField) {
        errors.push(`Row ${line}: images are required - put one or more | separated links in the images column`);
        continue;
      }
      categoriesSeen.add(category);

      const dimRaw = String(get('framedimensions', 'dimensions') ?? '');
      // An empty spreadsheet cell arrives as '', and Number('') is 0 - so blank
      // measurements used to be stored as zero widths and zero temples.
      const num = (v) => {
        const raw = String(v ?? '').trim();
        if (!raw) return undefined;
        const n = Number(raw.replace(/[^0-9.\-]/g, ''));
        if (!Number.isFinite(n) || n === 0) return undefined;
        return n;
      };
      const first = (...vals) => {
        for (const v of vals) { const n = num(v); if (n !== undefined) return n; }
        return undefined;
      };

      products.push({
        title,
        description: String(get('description') ?? '').trim(),
        price,
        discountedPrice: get('discountedprice') ? Number(get('discountedprice')) : undefined,
        originalPrice: get('originalprice') ? Number(get('originalprice')) : price,
        category,
        brand,
        stock: parseInt(get('stock')) || 0,
        modelNumber: String(get('modelnumber', 'modelno', 'model')).trim(),
        productCode: String(get('productcode', 'productid', 'sku')).trim(),
        gender: String(genderRaw).toLowerCase(),
        subGender: ['boys', 'girls'].includes(String(get('subgender') ?? '').toLowerCase()) ? String(get('subgender')).toLowerCase() : undefined,
        ageGroup: String(get('agegroup') ?? '').trim() || undefined,
        frameShape: String(get('frameshape', 'faceshape')).trim(),
        frameType: String(get('frametype')).trim(),
        frameMaterial: String(get('framematerial', 'material')).trim(),
        frameColor: String(get('framecolor', 'color', 'colours')).trim(),
        // Frame size is typed by the manufacturer, not chosen from three labels.
        frameSize: frameSizeBucket(get('framesize', 'size')),
        sizes: list(get('sizes')),
        frameWidth: num(get('framewidth')),
        frameWeight: num(get('frameweight')),
        materials: list(get('materials', 'material')),
        colors: list(get('colors', 'colours')).map((c) => ({ name: c })),
        /*
         * The measurement is written on the temple as lens - bridge - temple and
         * sheets express it either as one "54 x 52 x 16 x 145" string or as four
         * columns. The old code read a composite only for width/height and
         * expected columns for bridge/temple, so the last two numbers of a normal
         * sheet vanished silently.
         */
        dimensions: (() => {
          const parts = dimRaw.split(/\s*(?:[x\u00D7]|[-,])\s*/).filter((p) => String(p).trim() !== '');
          const four = parts.length >= 4;
          const fromSize = measureFromSize(get('framesize', 'size'));
          return {
            width: first(get('dimwidth'), four ? parts[0] : undefined, fromSize.lens),
            height: first(get('dimheight'), four ? parts[1] : undefined),
            bridge: first(get('dimbridge'), four ? parts[2] : parts[1], fromSize.bridge),
            temple: first(get('dimtemple'), four ? parts[3] : parts[2], fromSize.temple)
          };
        })(),
        images: imageField.split('|').map((u) => u.trim()).filter(Boolean),
        // Powered declaration from the sheet, validated on save.
        poweredOptionsAvailable: ['true', 'yes', 'y', '1'].includes(String(get('powered', 'withpower', 'poweredoptionsavailable') ?? '').toLowerCase()),
        prescriptionLensTypes: list(get('prescriptionlenstypes', 'lenstypes')),
        warranty: String(get('warranty') ?? ''),
        tags: list(get('tags')),
        returnWindowDays: get('returnwindowdays') !== undefined ? Number(get('returnwindowdays')) : undefined,
        // Contact-lens specifics when the row is a lens product.
        ...(category === 'contactlenses' ? {
          contactLens: {
            powerType: ['distance', 'toric', 'multifocal', 'none'].includes(String(get('powertype')).toLowerCase()) ? String(get('powertype')).toLowerCase() : 'distance',
            lensesPerBox: Number(get('lensesperbox')) || 6,
            replacementPeriod: String(get('replacementperiod')).toLowerCase(),
            diameter: Number(get('diameter')),
            baseCurve: Number(get('basecurve')),
            waterContent: Number(get('watercontent')),
            allowsZeroPower: ['true', 'yes'].includes(String(get('allowszeropower') ?? '').toLowerCase()),
            isCosmetic: ['true', 'yes'].includes(String(get('iscosmetic', 'coloured', 'color') ?? '').toLowerCase()),
            colorTone: String(get('colortone') ?? '')
          }
        } : {})
      });
    }

    // Mixed-category sheets are refused rather than silently half-imported.
    const sunCount = categoriesSeen.has('sunglasses');
    const eyeCount = [...categoriesSeen].some((c) => ['eyeglasses', 'readingglasses', 'kids', 'sportseyewear'].includes(c));
    if (sunCount && eyeCount) {
      return res.status(400).json({
        success: false,
        message: 'Sunglasses and eyeglasses must be uploaded in separate files. This sheet mixes both categories.'
      });
    }

    if (!products.length && errors.length) {
      return res.status(400).json({ success: false, message: 'No rows could be imported.', errors: errors.slice(0, 50) });
    }

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: `${errors.length} row(s) need attention before the file can be imported. Nothing was saved.`,
        errors: errors.slice(0, 50)
      });
    }

    // Pull each image link down to our own store so the listing never depends on
    // a third-party URL staying alive.
    const stored = [];
    for (const p of products) {
      try {
        p.images = await storeRemoteImages(p.images, req.manufacturerSellerId || 'manufacturer');
      } catch (imgErr) {
        errors.push(`${p.title}: ${imgErr.message}`);
      }
      p.manufacturer = req.manufacturer._id;
      p.isManufacturerProduct = true;
      stored.push(p);
    }
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Some image links could not be fetched. Nothing was saved.', errors: errors.slice(0, 20) });
    }

    /*
     * Every row is checked against the schema before anything is written, and
     * failures name the row and the word that did not match. insertMany skips
     * validators, which is how a sheet could be rejected with a bare "Server
     * error" after the whole batch was already lost - and how `name` used to be
     * left empty for imported rows.
     */
    const rowProblems = [];
    for (const [index, p] of products.entries()) {
      for (const field of Object.keys(ENUM_ALIASES)) {
        const path = ENUM_ALIASES[field];
        if (p[field] === undefined) continue;
        const matched = matchEnum(Product, path, p[field]);
        if (matched.unknown) {
          rowProblems.push(`${p.title || `row ${index + 1}`}: ${field} "${p[field]}" is not one of ${enumsOf(Product, path).join(', ')}`);
        }
        p[field] = matched.value;
      }
      if (p.title && !p.name) p.name = p.title;

      const invalid = new Product(p).validateSync();
      if (invalid) {
        rowProblems.push(`${p.title || `row ${index + 1}`}: ${Object.entries(invalid.errors)
          .map(([k, v]) => `${k} - ${v.message.replace(/^Path \`.*?\` is invalid: /, '')}`)
          .join('; ')}`);
      }
    }
    if (rowProblems.length) {
      return res.status(400).json({
        success: false,
        message: `${rowProblems.length} row(s) need attention before the file can be imported. Nothing was saved.`,
        errors: rowProblems.slice(0, 20)
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
router.post('/sellers', verifyManufacturer, async (req, res) => {
  try {
    
    const sellerData = {
      ...req.body,
      manufacturer: req.manufacturer._id,
      createdBy: req.manufacturer._id
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
router.get('/sellers', verifyManufacturer, async (req, res) => {
  try {
    
    const sellers = await ManufacturerSeller.find({ 
      manufacturer: req.manufacturer._id
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
router.post('/sellers/bulk-upload', verifyManufacturer, upload.single('file'), async (req, res) => {
  try {
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const sellers = [];
    // (errors came from the validation pass above)

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
        manufacturer: req.manufacturer._id,
        gstNumber: row.gstNumber,
        panNumber: row.panNumber,
        bankDetails: {
          accountNumber: row.accountNumber,
          ifscCode: row.ifscCode,
          bankName: row.bankName,
          branchName: row.branchName
        },
        createdBy: req.manufacturer._id
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
router.post('/sellers/:id/ban', verifyManufacturer, async (req, res) => {
  try {
    
    const seller = await ManufacturerSeller.findOne({ 
      _id: req.params.id,
      manufacturer: req.manufacturer._id
    });

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    seller.isBanned = true;
    seller.banReason = req.body.reason || '';
    seller.bannedAt = new Date();
    seller.bannedBy = req.manufacturer._id;
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
router.post('/staff', verifyManufacturer, async (req, res) => {
  try {
    
    const staffData = {
      ...req.body,
      manufacturer: req.manufacturer._id,
      createdBy: req.manufacturer._id
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
router.get('/staff', verifyManufacturer, async (req, res) => {
  try {
    
    const staff = await ManufacturerStaff.find({ 
      manufacturer: req.manufacturer._id
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


router.delete('/sellers/:sellerId', verifyManufacturer, async (req, res) => {
  try {
    const { sellerId } = req.params;
    const manufacturerId = req.manufacturer._id;
    const result = await deleteManufacturerSeller(sellerId, manufacturerId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sellers/:sellerId/ban', verifyManufacturer, async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { reason } = req.body;
    const manufacturerId = req.manufacturer._id;
    const result = await banManufacturerSeller(sellerId, manufacturerId, reason);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Manufacturer's own account: profile and brand list.
// Without these the brand chips and company details could never be corrected
// after creation, which is what "already added brand is not editable" referred to.
// ---------------------------------------------------------------------------

router.get('/profile', verifyManufacturer, async (req, res) => {
  try {
    const me = await Manufacturer.findById(req.manufacturer._id).select('-password -loginOtp -loginOtpExpiry').lean();
    res.json({ success: true, data: me });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/profile', verifyManufacturer, async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'companyName', 'gstNumber', 'panNumber', 'brands', 'address'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    if (updates.brands !== undefined) {
      const list = Array.isArray(updates.brands) ? updates.brands : String(updates.brands).split(',');
      const cleaned = [...new Set(list.map((b) => String(b).trim()).filter(Boolean))];
      if (cleaned.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one brand is required.' });
      }
      updates.brands = cleaned;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update.' });
    }

    const me = await Manufacturer.findByIdAndUpdate(req.manufacturer._id, updates, { new: true, runValidators: true })
      .select('-password -loginOtp -loginOtpExpiry');
    res.json({ success: true, message: 'Profile updated.', data: me });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Lift a ban on one of this manufacturer's sellers.
router.post('/sellers/:sellerId/unban', verifyManufacturer, async (req, res) => {
  try {
    const manufacturerId = req.manufacturer._id;
    const seller = await ManufacturerSeller.findOne({ _id: req.params.sellerId, manufacturer: manufacturerId });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found under your manufacturer account.' });
    }

    seller.isBanned = false;
    seller.banReason = '';
    seller.bannedAt = null;
    seller.isActive = true;
    await seller.save();

    res.json({ success: true, message: 'Seller reinstated.', data: seller });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Edit a seller's commercial details (store info, contact, address).
router.put('/sellers/:sellerId', verifyManufacturer, async (req, res) => {
  try {
    const seller = await ManufacturerSeller.findOne({ _id: req.params.sellerId, manufacturer: req.manufacturer._id });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found under your manufacturer account.' });
    }

    const allowed = ['name', 'phone', 'storeName', 'storeDescription', 'storeAddress', 'gstNumber', 'panNumber'];
    allowed.forEach((k) => { if (req.body[k] !== undefined) seller[k] = req.body[k]; });
    if (req.body.storeAddress) {
      seller.storeAddress = { ...seller.storeAddress, ...req.body.storeAddress };
    }

    await seller.save();
    res.json({ success: true, message: 'Seller updated.', data: seller });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/products/validate-bulk', verifyManufacturer, async (req, res) => {
  try {
    const { products } = req.body;
    const result = await validateBulkUpload(products);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/products/pending', verifyManufacturer, async (req, res) => {
  try {
    const manufacturerId = req.manufacturer._id;
    const result = await getManufacturerPendingProducts(manufacturerId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/products/pending/:productId', verifyManufacturer, async (req, res) => {
  try {
    const { productId } = req.params;
    const manufacturerId = req.manufacturer._id;
    const result = await updatePendingProduct(productId, req.body, manufacturerId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/products/pending/:productId', verifyManufacturer, async (req, res) => {
  try {
    const { productId } = req.params;
    const manufacturerId = req.manufacturer._id;
    const result = await deletePendingProduct(productId, manufacturerId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
