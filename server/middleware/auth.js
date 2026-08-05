import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Seller from '../models/Seller.js';
import StaffRole from '../models/StaffRole.js';

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
