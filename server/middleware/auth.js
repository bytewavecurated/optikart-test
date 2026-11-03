import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Seller from '../models/Seller.js';
import StaffRole from '../models/StaffRole.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import Manufacturer from '../models/Manufacturer.js';
import Executive from '../models/Executive.js';

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id || decoded.userId);
    if (!user) {
      return res.status(403).json({ success: false, message: 'Your sign-in is not a customer account. Use the console link in the header.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    return res.status(500).json({ success: false, message: 'Server error during authentication.', error: error.message });
  }
};


/**
 * Accepts any valid signed-in principal (user, seller, admin, staff,
 * executive, manufacturer, manufacturer seller or delivery partner).
 *
 * Endpoints that are shared across roles - such as notifications - must not
 * answer 401 just because the caller is not a customer User: a 401 makes the
 * client drop an otherwise perfectly valid session. The resolved identity is
 * exposed as req.principal.
 */
export const verifyAnyPrincipal = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const id = decoded.id || decoded.userId || decoded.sellerId || decoded.executiveId;

    const principal = { id, role: decoded.role || 'user', decoded };

    // Attach the matching document when it exists, without failing otherwise.
    try {
      if (decoded.role === 'seller') {
        const { default: MongSeller } = await import('../models/Seller.js');
        const sellerDoc = await MongSeller.findById(id);
        if (sellerDoc) { req.seller = sellerDoc; principal.seller = sellerDoc; principal.doc = sellerDoc; }
      } else {
        const userDoc = await User.findById(id);
        if (userDoc) { req.user = userDoc; principal.user = userDoc; principal.doc = userDoc; }
        else {
          const sellerDoc = await Seller.findById(id);
          if (sellerDoc) { req.seller = sellerDoc; principal.seller = sellerDoc; principal.doc = sellerDoc; }
        }
      }
    } catch (lookupErr) {
      // Document resolution is best-effort; the token itself is valid.
    }

    req.principal = principal;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    return res.status(500).json({ success: false, message: 'Server error during authentication.' });
  }
};

export const verifySeller = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const seller = await Seller.findById(decoded.id || decoded.sellerId);
    if (!seller) {
      return res.status(403).json({ success: false, message: 'This area is for seller accounts. Your session is a different type of account.' });
    }

    if (!seller.isActive) {
      return res.status(403).json({ success: false, message: 'Seller account has been deactivated.' });
    }

    if (!seller.isVerified) {
      return res.status(403).json({ success: false, message: 'Seller account is not verified.' });
    }

    req.seller = seller;
    req.user = { id: seller._id, role: 'seller', name: seller.name, email: seller.email };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid seller token.' });
  }
};

export const verifyAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
  }
  next();
};

export const verifyStaff = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    const staff = await StaffRole.findOne({ email: req.user.email, isActive: true });
    if (!staff) {
      return res.status(403).json({ success: false, message: 'Access denied. Staff privileges required.' });
    }

    req.staff = staff;
    req.user.role = 'staff';
    req.user.staffRole = staff.role;
    req.user.permissions = staff.permissions;
    next();
  } catch (error) {
    // A malformed or expired token is an authentication failure, not a crash;
    // answering 500 made clients discard a perfectly good session.
    if (error && (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError')) {
      return res.status(401).json({ success: false, message: error.name === 'TokenExpiredError' ? 'Token has expired.' : 'Invalid token.' });
    }
    return res.status(500).json({ success: false, message: 'Server error during staff verification.', error: error.message });
  }
};

export const verifyStaffPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.role === 'staff' && req.user.permissions && req.user.permissions.includes(requiredPermission)) {
      return next();
    }

    return res.status(403).json({ success: false, message: `Access denied. Required permission: ${requiredPermission}` });
  };
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id || decoded.userId);
    if (user && user.isActive) {
      req.user = user;
    }
    next();
  } catch (error) {
    next();
  }
};

/**
 * Retailer appointed by a manufacturer. These accounts are their own document
 * type (not Sellers), which is why routing to a retailer looks up this model too
 * when resolving an offer.
 */
export const verifyManufacturerSeller = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const { default:ManufacturerSeller } = await import('../models/ManufacturerSeller.js');
    const seller = await ManufacturerSeller.findById(decoded.id || decoded.sellerId);
    if (!seller) return res.status(403).json({ success: false, message: 'This area is for retailer (manufacturer-seller) accounts. Your session is a different type of account.' });
    if (seller.isActive === false) return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    if (seller.isBanned) return res.status(403).json({ success: false, message: 'This retailer account is blocked.' });
    req.manufacturerSeller = seller;
    // Exposed as `seller` so stock routes can treat both kinds alike.
    req.seller = seller;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token has expired.' });
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

/** Independent seller OR manufacturer-appointed retailer, whichever the token is. */
export const verifyAnySeller = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const id = decoded.id || decoded.sellerId;
    const own = await Seller.findById(id);
    if (own && own.isActive !== false) { req.seller = own; req.sellerKind = 'seller'; return next(); }
    const { default:ManufacturerSeller } = await import('../models/ManufacturerSeller.js');
    const ms = await ManufacturerSeller.findById(id);
    if (ms && ms.isActive !== false && !ms.isBanned) { req.seller = ms; req.sellerKind = 'manufacturerSeller'; return next(); }
    return res.status(401).json({ success: false, message: 'Invalid token. No seller account matched.' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token has expired.' });
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

export const verifyDeliveryPartner = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const partner = await DeliveryPartner.findById(decoded.id || decoded.partnerId);
    if (!partner) {
      return res.status(403).json({ success: false, message: 'This area is for delivery partner accounts. Your session is a different type of account.' });
    }

    if (!partner.isActive) {
      return res.status(403).json({ success: false, message: 'Delivery partner account has been deactivated.' });
    }

    if (partner.isBanned) {
      return res.status(403).json({ success: false, message: 'Delivery partner account has been banned.' });
    }

    req.partner = partner;
    req.user = { id: partner._id, role: 'deliveryPartner', name: partner.name, email: partner.email };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid delivery partner token.' });
  }
};

export const verifyManufacturer = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const manufacturer = await Manufacturer.findById(decoded.id || decoded.manufacturerId);
    if (!manufacturer) {
      return res.status(403).json({ success: false, message: 'This area is for manufacturer accounts. Your session is a different type of account.' });
    }

    if (!manufacturer.isActive) {
      return res.status(403).json({ success: false, message: 'Manufacturer account has been deactivated.' });
    }

    if (manufacturer.isBanned) {
      return res.status(403).json({ success: false, message: 'Manufacturer account has been banned.' });
    }

    req.manufacturer = manufacturer;
    req.user = { id: manufacturer._id, role: 'manufacturer', name: manufacturer.name, email: manufacturer.email };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid manufacturer token.' });
  }
};

export const verifyExecutive = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const executive = await Executive.findById(decoded.id || decoded.executiveId);
    if (!executive) {
      return res.status(403).json({ success: false, message: 'This area is for executive accounts. Your session is a different type of account.' });
    }

    if (!executive.isActive) {
      return res.status(403).json({ success: false, message: 'Executive account has been deactivated.' });
    }

    if (executive.isBanned) {
      return res.status(403).json({ success: false, message: 'Executive account has been banned.' });
    }

    req.executive = executive;
    req.user = { id: executive._id, role: 'executive', name: executive.name, email: executive.email };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid executive token.' });
  }
};
