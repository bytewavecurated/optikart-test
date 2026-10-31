import express from 'express';
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator';
import DeliveryPartner from '../models/DeliveryPartner.js';
import Order from '../models/Order.js';
import { verifyToken, verifyAdmin, verifyDeliveryPartner } from '../middleware/auth.js';
import { sendOTP } from '../services/email.js';
import {
  findNearbyDeliveryPartners,
  assignDeliveryPartner,
  processWithdrawal,
  updatePartnerLocation,
  completeDelivery,
  getPartnerDashboard,
  getAllDeliveryPartners
} from '../services/deliveryPartner.js';

const router = express.Router();

const generateDeliveryPartnerToken = (partnerId) => {
  return jwt.sign({ id: partnerId, partnerId, role: 'deliveryPartner' }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

/**
 * POST /api/delivery-partner/register
 * Register new delivery partner (admin only)
 */
router.post('/register', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const {
      name, email, password, phone, vehicleType, vehicleNumber,
      licenseNumber, aadharNumber, panNumber, bankDetails
    } = req.body;

    const existingPartner = await DeliveryPartner.findOne({ email });
    if (existingPartner) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    const partner = new DeliveryPartner({
      name,
      email,
      password,
      phone,
      vehicleType,
      vehicleNumber,
      licenseNumber,
      aadharNumber,
      panNumber,
      bankDetails
    });

    await partner.save();

    // Send credentials email
    await sendOTP(email, password, 'credentials');

    res.status(201).json({
      success: true,
      message: 'Delivery partner registered successfully',
      partner: partner.toJSON()
    });
  } catch (error) {
    console.error('Error registering delivery partner:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/delivery-partner/login
 * Delivery partner login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const partner = await DeliveryPartner.findOne({ email });
    if (!partner) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!partner.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    if (partner.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Account has been banned'
      });
    }

    // Check if account is locked
    if (partner.lockUntil && partner.lockUntil > new Date()) {
      const remainingTime = Math.ceil((partner.lockUntil - new Date()) / 1000 / 60);
      return res.status(423).json({
        success: false,
        message: `Account is locked. Please try again in ${remainingTime} minutes.`,
        locked: true,
        lockUntil: partner.lockUntil
      });
    }

    const isMatch = await partner.comparePassword(password);
    if (!isMatch) {
      partner.failedLoginAttempts = (partner.failedLoginAttempts || 0) + 1;
      
      if (partner.failedLoginAttempts >= 3) {
        partner.lockUntil = new Date(Date.now() + 3 * 60 * 1000);
        partner.failedLoginAttempts = 0;
        await partner.save();
        
        return res.status(423).json({
          success: false,
          message: 'Too many failed attempts. Account locked for 3 minutes.',
          locked: true,
          lockUntil: partner.lockUntil
        });
      }
      
      await partner.save();
      const remainingAttempts = 3 - partner.failedLoginAttempts;
      return res.status(401).json({
        success: false,
        message: `Invalid email or password. ${remainingAttempts} attempts remaining.`
      });
    }

    partner.failedLoginAttempts = 0;
    partner.lockUntil = null;

    // Check if this is a test credential - bypass OTP for testing
    // Must match the account created by seed.js, so the printed login works.
    const testPartnerEmails = ['suresh.partner@optikart.com'];
    // Second-factor OTP may only be skipped outside production, and only
    // for the well-known seededdemo accounts whose password is also public.
    const allowOtpBypass = process.env.NODE_ENV !== 'production' && process.env.AUTH_OTP_BYPASS !== 'false';
    const isTestCredential = allowOtpBypass && testPartnerEmails.includes(email);

    if (isTestCredential) {
      // Direct login for test credentials
      const token = generateDeliveryPartnerToken(partner._id);
      partner.loginTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      partner.lastLoginAt = new Date();
      await partner.save();

      res.json({
        success: true,
        message: 'Login successful.',
        token,
        partner: partner.toJSON()
      });
    } else {
      const loginOtp = otpGenerator.generate(6, { 
        upperCaseAlphabets: false, 
        specialChars: false, 
        lowerCaseAlphabets: false 
      });

      partner.loginOtp = loginOtp;
      partner.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await partner.save();

      await sendOTP(email, loginOtp, 'login');

      res.json({
        success: true,
        requiresOTP: true,
        message: 'Login OTP sent to your email.',
        partnerId: partner._id
      });
    }
  } catch (error) {
    console.error('Delivery partner login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login.',
      error: error.message
    });
  }
});

/**
 * POST /api/delivery-partner/verify-login-otp
 * Verify delivery partner login OTP
 */
router.post('/verify-login-otp', async (req, res) => {
  try {
    const { partnerId, otp } = req.body;

    if (!partnerId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Partner ID and OTP are required'
      });
    }

    const partner = await DeliveryPartner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }

    if (partner.loginOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    if (new Date() > partner.loginOtpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    partner.loginOtp = undefined;
    partner.loginOtpExpiry = undefined;
    partner.lastLoginAt = new Date();
    await partner.save();

    const token = generateDeliveryPartnerToken(partner._id);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      partner: partner.toJSON()
    });
  } catch (error) {
    console.error('Verify delivery partner login OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message
    });
  }
});

/**
 * GET /api/delivery-partner/me
 * Get delivery partner profile
 */
router.get('/me', verifyDeliveryPartner, async (req, res) => {
  try {
    const partnerId = req.partner._id;

    const result = await getPartnerDashboard(partnerId);

    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error getting partner profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/delivery-partner/location
 * Update partner location
 */
router.post('/location', verifyDeliveryPartner, async (req, res) => {
  try {
    const partnerId = req.partner._id;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const result = await updatePartnerLocation(partnerId, latitude, longitude);

    if (result.success) {
      res.json({
        success: true,
        message: 'Location updated'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/delivery-partner/complete/:orderId
 * Complete delivery
 */
router.post('/complete/:orderId', verifyDeliveryPartner, async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await completeDelivery(orderId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Delivery completed',
        data: {
          earnings: result.earnings
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error completing delivery:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/delivery-partner/withdraw
 * Process withdrawal
 */
router.post('/withdraw', verifyDeliveryPartner, async (req, res) => {
  try {
    const partnerId = req.partner._id;
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required'
      });
    }

    const result = await processPaymentWithdrawal(partnerId, amount);

    if (result.success) {
      res.json({
        success: true,
        message: 'Withdrawal processed',
        data: {
          amount: result.amount,
          fee: result.fee,
          transactionId: result.transactionId
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/delivery-partner
 * Get all delivery partners (admin)
 */
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { isActive, isAvailable, isBanned } = req.query;
    const filters = {};

    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (isAvailable !== undefined) filters.isAvailable = isAvailable === 'true';
    if (isBanned !== undefined) filters.isBanned = isBanned === 'true';

    const result = await getAllDeliveryPartners(filters);

    if (result.success) {
      res.json({
        success: true,
        data: result.partners
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error getting all delivery partners:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * PUT /api/delivery-partner/:id/ban
 * Ban/unban delivery partner (admin)
 */
router.put('/:id/ban', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isBanned, banReason } = req.body;

    const partner = await DeliveryPartner.findByIdAndUpdate(
      id,
      {
        isBanned: isBanned !== undefined ? isBanned : undefined,
        banReason: banReason || '',
        bannedBy: req.user.id,
        bannedAt: isBanned ? new Date() : null
      },
      { new: true }
    ).select('-password');

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }

    res.json({
      success: true,
      message: 'Partner ban status updated',
      partner
    });
  } catch (error) {
    console.error('Error banning partner:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/delivery-partner/working
 * Partners with live assignments: what each is carrying, from which seller,
 * to which customer, and what they will earn. Supports search and status filters
 * so the admin can find a specific delivery immediately.
 */
router.get('/working', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { search, status, partnerId } = req.query;

    const orderFilter = {
      assignedDeliveryPartner: { $ne: null },
      orderStatus: { $in: ['picked_up', 'in_transit', 'confirmed', 'packed'] }
    };
    if (partnerId) orderFilter.assignedDeliveryPartner = partnerId;

    const orders = await Order.find(orderFilter)
      .sort({ updatedAt: -1 })
      .limit(200)
      .populate('assignedDeliveryPartner', 'name phone email vehicleType vehicleNumber status isAvailable rating')
      .populate('seller', 'storeName phone city')
      .populate('user', 'name phone email')
      .lean();

    let rows = orders.map((o) => ({
      orderId: o._id,
      orderNumber: o.orderNumber || o.orderId,
      orderStatus: o.orderStatus,
      partner: o.assignedDeliveryPartner,
      seller: o.seller ? {
        _id: o.seller._id,
        storeName: o.seller.storeName,
        phone: o.seller.phone,
        city: o.seller.city
      } : null,
      customer: o.user ? {
        _id: o.user._id,
        name: o.user.name,
        phone: o.user.phone,
        email: o.user.email
      } : null,
      destination: [o.shippingAddress?.street, o.shippingAddress?.city, o.shippingAddress?.pincode].filter(Boolean).join(', '),
      pickupLocation: o.pickupLocation || null,
      deliveryLocation: o.deliveryLocation || null,
      distanceKm: o.deliveryDistanceKm || 0,
      earnings: o.deliveryFee || 0,
      assignmentMode: o.deliveryAssignmentMode || 'none',
      updatedAt: o.updatedAt
    }));

    if (status) rows = rows.filter((r) => r.orderStatus === status);
    if (search) {
      const q = String(search).toLowerCase();
      rows = rows.filter((r) =>
        [r.orderNumber, r.partner?.name, r.partner?.phone, r.seller?.storeName,
         r.customer?.name, r.customer?.phone, r.destination]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
    }

    const byPartner = {};
    rows.forEach((r) => {
      const key = r.partner?._id || 'unassigned';
      if (!byPartner[key]) {
        byPartner[key] = { partner: r.partner, activeDeliveries: 0, expectedEarnings: 0 };
      }
      byPartner[key].activeDeliveries += 1;
      byPartner[key].expectedEarnings += r.earnings || 0;
    });

    res.json({
      success: true,
      deliveries: rows,
      partners: Object.values(byPartner).map((p) => ({
        ...p,
        expectedEarnings: Math.round(p.expectedEarnings * 100) / 100
      }))
    });
  } catch (error) {
    console.error('Working partners error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;

// Payment endpoints
import { 
  calculateDeliveryFee, 
  getDeliveryPartnerEarnings, 
  processWithdrawal as processPaymentWithdrawal
} from '../services/deliveryPartnerPayment.js';

router.get('/payment/calculate', verifyDeliveryPartner, async (req, res) => {
  try {
    const { distance } = req.query;
    if (!distance) {
      return res.status(400).json({ success: false, error: 'Distance is required' });
    }
    const fee = calculateDeliveryFee(parseFloat(distance));
    res.json({ success: true, fee });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/payment/earnings', verifyDeliveryPartner, async (req, res) => {
  try {
    const { period } = req.query;
    const partnerId = req.partner._id;
    const result = await getDeliveryPartnerEarnings(partnerId, period);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/payment/withdraw', verifyDeliveryPartner, async (req, res) => {
  try {
    const { amount } = req.body;
    const partnerId = req.partner._id;
    const result = await processPaymentWithdrawal(partnerId, amount);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
