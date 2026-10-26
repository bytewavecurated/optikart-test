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
      return res.status(401).json({ success: false, message: 'Invalid token. User not found.' });
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
      return res.status(401).json({ success: false, message: 'Invalid token. Seller not found.' });
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
      return res.status(401).json({ success: false, message: 'Invalid token. Delivery partner not found.' });
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
      return res.status(401).json({ success: false, message: 'Invalid token. Manufacturer not found.' });
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
      return res.status(401).json({ success: false, message: 'Invalid token. Executive not found.' });
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
