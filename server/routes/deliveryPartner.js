import { otpBypassAllowed } from '../config/authMode.js';
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
    // Must match the accounts created by seed.js, so the logins printed at boot
    // and listed in LOGINS.md actually work - a seeded partner left out of this
    // list is told its password is an OTP that never arrives.
    const testPartnerEmails = [
      'suresh.partner@optikart.com',
      'anjali.partner@optikart.com',
      'ramesh.partner@optikart.com'
    ];
    // Second-factor OTP may only be skipped outside production, and only
    // for the well-known seededdemo accounts whose password is also public.
    const isTestCredential = otpBypassAllowed(testPartnerEmails, email);

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
/*
 * Availability is what puts a partner into the ranking pool at all. Without this
 * endpoint the cascade could only ever use people an admin had flipped by hand,
 * while the dashboard switch only repainted itself.
 */
router.put('/availability', verifyDeliveryPartner, async (req, res) => {
  try {
    const isAvailable = !!req.body.isAvailable;
    await DeliveryPartner.findByIdAndUpdate(req.partner._id, { isAvailable });
    res.json({
      success: true,
      isAvailable,
      message: isAvailable ? 'You are now online for deliveries.' : 'You are offline.'
    });
  } catch (error) {
    console.error('Partner availability error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* Admin: who would be recommended for this order, and why. */
router.get('/recommendations/:orderId', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { recommendPartners } = await import('../services/partnerDispatch.js');
    const result = await recommendPartners(req.params.orderId, {
      radiusKm: Number(req.query.radiusKm) || 12
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Recommendation lookup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* Admin: start or restart the offer cascade for an order. */
router.post('/queue/offer/:orderId', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { offerQueue } = await import('../services/partnerDispatch.js');
    const result = await offerQueue(req.params.orderId, req.app.get('io'));
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Partner queue error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/*
 * The partner's own inbox: runs currently offered to them, with the distance,
 * what the leg pays and how long they have to answer.
 */
router.get('/offers', verifyDeliveryPartner, async (req, res) => {
  try {
    const mine = await Order.find({ 'partnerQueue.partner': req.partner._id, partnerDecision: 'offering', assignedDeliveryPartner: null })
      .sort({ partnerQueueDeadline: 1 }).limit(20)
      .populate('seller', 'storeName phone address city location').lean();
    const now = Date.now();
    const offers = mine
      .map((o) => {
        const entry = (o.partnerQueue || []).find((q) => String(q.partner) === String(req.partner._id));
        if (!entry || entry.response !== 'pending') return null;
        // A window that has closed is no longer the partner's to take: listing it
        // would let someone accept a delivery the admin already moved on from.
        if (o.partnerQueueDeadline && new Date(o.partnerQueueDeadline).getTime() < now) return null;
        return {
          orderId: String(o._id),
          orderNumber: o.orderNumber,
          pickup: o.pickupLocation?.address || o.seller?.address?.street || o.seller?.storeName || '',
          drop: [o.shippingAddress?.street, o.shippingAddress?.city, o.shippingAddress?.pincode].filter(Boolean).join(', '),
          distanceKm: entry.distanceKm,
          earning: o.deliveryFee || 0,
          deadline: o.partnerQueueDeadline,
          offeredAt: entry.offeredAt
        };
      })
      .filter(Boolean);
    res.json({ success: true, offers });
  } catch (error) {
    console.error('Partner offers lookup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* Partner answers an offer. Declining passes it to the next partner immediately. */
router.post('/offers/:orderId/respond', verifyDeliveryPartner, async (req, res) => {
  try {
    const decision = req.body.decision === 'decline' ? 'decline' : 'accept';
    const { acceptOffer, advanceQueue } = await import('../services/partnerDispatch.js');

    if (decision === 'accept') {
      const result = await acceptOffer(req.params.orderId, req.partner._id, req.app.get('io'));
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error, expired: !!result.expired });
      }
      return res.json({ success: true, message: 'Run accepted. Pickup details are on your dashboard.', ...result });
    }

    const order = await Order.findById(req.params.orderId).populate('seller', 'storeName address location');
    const entry = (order?.partnerQueue || []).find((q) => String(q.partner) === String(req.partner._id));
    if (!order || !entry) return res.status(404).json({ success: false, message: 'No such offer.' });
    entry.response = 'rejected';
    entry.respondedAt = new Date();
    await order.save();
    const next = await advanceQueue(order, req.app.get('io'));
    res.json({ success: true, message: 'Declined.', next: next.offeredName || null, escalated: !!next.escalated });
  } catch (error) {
    console.error('Partner respond error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/*
 * Runs that have left the seller's hands with nobody assigned, with the ranking
 * we would have used. This is the queue the escalation email points at: once the
 * partners have declined, the run has to land somewhere an admin can act on.
 */
/*
 * A partner reporting something they cannot fix themselves: nobody answers the
 * door, the address is wrong, the parcel was refused or damaged. The note goes
 * both into the delivery timeline the operations desk already reads and into a
 * flagged field, so the run stops looking merely "in progress".
 */
const ISSUE_TYPES = ['customer_unreachable', 'wrong_address', 'refused', 'damaged', 'other'];
const ISSUE_LABELS = {
  customer_unreachable: 'customer not reachable',
  wrong_address: 'address did not match',
  refused: 'parcel refused at the door',
  damaged: 'parcel damaged',
  other: 'issue reported'
};

router.post('/report/:orderId', verifyDeliveryPartner, async (req, res) => {
  try {
    const type = String(req.body?.type || '');
    const note = String(req.body?.note || '').trim().slice(0, 400);
    if (!ISSUE_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'Pick one of: ' + ISSUE_TYPES.join(', ') });
    }
    if (type === 'other' && !note) {
      return res.status(400).json({ success: false, message: 'Describe the problem so the desk can act on it.' });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (String(order.assignedDeliveryPartner || '') !== String(req.partner._id)) {
      return res.status(403).json({ success: false, message: 'That run is not assigned to you.' });
    }
    if (order.orderStatus === 'delivered' || order.orderStatus === 'returned') {
      return res.status(400).json({ success: false, message: 'This run is already closed.' });
    }

    order.deliveryIssue = {
      type,
      note,
      reportedAt: new Date(),
      reportedBy: req.partner._id,
      resolvedAt: null,
      resolvedBy: null
    };
    order.deliveryJourney = order.deliveryJourney || [];
    order.deliveryJourney.push({
      status: order.orderStatus,
      note: `Partner reported: ${ISSUE_LABELS[type]}${note ? ' - ' + note : ''}`,
      at: new Date()
    });
    await order.save();

    res.json({ success: true, message: 'Reported. The operations desk can see it on this order.' });
  } catch (error) {
    console.error('Partner issue report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/unassigned', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { recommendPartners } = await import('../services/partnerDispatch.js');
    const orders = await Order.find({
      orderStatus: { $in: ['confirmed', 'packed', 'picked_up', 'in_transit'] },
      assignedDeliveryPartner: null
    })
      .sort({ updatedAt: -1 }).limit(40)
      .populate('user', 'name phone')
      .populate('seller', 'storeName phone address city location')
      .lean();

    const rows = [];
    for (const o of orders) {
      const rec = await recommendPartners(o._id).catch(() => ({ recommendations: [] }));
      rows.push({
        orderId: String(o._id),
        orderNumber: o.orderNumber,
        status: o.orderStatus,
        partnerDecision: o.partnerDecision || '',
        queueLength: (o.partnerQueue || []).length,
        storeUnknown: !!rec.storeLocationUnknown,
        leadKm: rec.leadKm,
        customer: o.user?.name || 'Customer',
        drop: [o.shippingAddress?.street, o.shippingAddress?.city, o.shippingAddress?.pincode].filter(Boolean).join(', '),
        candidates: (rec.recommendations || []).map((r) => ({
          partnerId: String(r.partnerId), name: r.name, phone: r.phone, distanceKm: r.distance, earning: r.earning
        }))
      });
    }
    res.json({ success: true, orders: rows, count: rows.length });
  } catch (error) {
    console.error('Unassigned orders lookup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/*
 * Manual assignment. assignedBy records that a person chose this partner rather
 * than the ranking, which is how we can tell later whether recommendations work.
 */
router.post('/assign', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { orderId, partnerId } = req.body || {};
    if (!orderId || !partnerId) {
      return res.status(400).json({ success: false, message: 'Both an order and a partner are required.' });
    }
    // A run longer than a local delivery is not a bicycle job at any price: at
    // the ₹10/km partner rate a Mumbai-to-Kolkata parcel would pay ₹16,548, so
    // the cap is enforced here as well as in the cascade. Send it by courier.
    const { leadKm, PARTNER_MAX_LEAD_KM } = await import('../services/partnerDispatch.js');
    const preview = await Order.findById(orderId).populate('seller', 'storeName address location');
    const distance = preview ? await leadKm(preview) : null;
    if (distance !== null && distance > PARTNER_MAX_LEAD_KM) {
      return res.status(400).json({
        success: false,
        tooFar: true,
        distanceKm: Math.round(distance * 100) / 100,
        maxKm: PARTNER_MAX_LEAD_KM,
        message: `${Math.round(distance)} km is beyond a partner delivery (${PARTNER_MAX_LEAD_KM} km). Send this one by courier instead.`
      });
    }

    const result = await assignDeliveryPartner(orderId, partnerId, 'admin');
    if (!result.success) return res.status(400).json({ success: false, message: result.error });

    // The order now has a partner, so the offer queue on it is settled - leaving
    // it "offering" would keep it in the other partners' inboxes as an
    // assignable run.
    const order = await Order.findById(orderId);
    if (order && !order.assignedDeliveryPartner) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order) {
      order.partnerDecision = 'accepted';
      order.partnerQueueDeadline = null;
      (order.partnerQueue || []).forEach((q) => {
        if ((q.response || 'pending') === 'pending') {
          q.response = String(q.partner) === String(partnerId) ? 'accepted' : 'expired';
          q.respondedAt = new Date();
        }
      });
      await order.save();
    }
    res.json({ success: true, message: 'Partner assigned.' });
  } catch (error) {
    console.error('Manual partner assignment error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

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
