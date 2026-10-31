import DeliveryPartner from '../models/DeliveryPartner.js';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import { sendEmail } from './email.js';

const SELF_DELIVERY_FEE_PER_ORDER_LINE = 59;
const DELIVERY_RATE_PER_KM = 10; // ₹10 per km
const WITHDRAWAL_FEE = 3; // ₹3 per ₹50

/**
 * Calculate distance between two coordinates using Haversine formula
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Find nearby available delivery partners
 */
export const findNearbyDeliveryPartners = async (pickupLocation, maxDistance = 10) => {
  try {
    const partners = await DeliveryPartner.find({
      isActive: true,
      isAvailable: true,
      isBanned: false,
      currentOrder: null,
      currentLocation: { $exists: true }
    });

    const nearbyPartners = partners
      .map(partner => {
        const distance = calculateDistance(
          pickupLocation.latitude,
          pickupLocation.longitude,
          partner.currentLocation.latitude,
          partner.currentLocation.longitude
        );
        return { partner, distance };
      })
      .filter(item => item.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3); // Return top 3

    return nearbyPartners;
  } catch (error) {
    console.error('Error finding nearby delivery partners:', error);
    return [];
  }
};

/**
 * Assign delivery partner to order
 */
export const assignDeliveryPartner = async (orderId, partnerId, assignedBy = 'auto') => {
  try {
    const order = await Order.findById(orderId);
    const partner = await DeliveryPartner.findById(partnerId);

    if (!order || !partner) {
      throw new Error('Order or partner not found');
    }

    if (partner.currentOrder) {
      throw new Error('Partner is already assigned to an order');
    }

    // Update partner
    partner.currentOrder = orderId;
    partner.assignedBy = assignedBy;
    partner.isAvailable = false;
    await partner.save();

    // Update order. The Order schema calls these fields
    // `assignedDeliveryPartner` and `orderStatus`; writing non-existent paths
    // left partner assignments invisible to every other screen.
    order.assignedDeliveryPartner = partnerId;
    order.deliveryAssignmentMode = 'self';
    order.orderStatus = order.orderStatus === 'pending' ? 'confirmed' : order.orderStatus;
    order.pickupLocation = {
      name: order.seller?.storeName || '',
      address: order.pickupLocation?.address || '',
      lat: order.pickupLocation?.lat,
      lng: order.pickupLocation?.lng
    };
    order.deliveryLocation = {
      address: [order.shippingAddress?.street, order.shippingAddress?.city, order.shippingAddress?.pincode].filter(Boolean).join(', '),
      lat: order.shippingAddress?.coordinates?.[1],
      lng: order.shippingAddress?.coordinates?.[0]
    };

    // Platform-run delivery adds a flat Rs. 59 per line and pays the partner
    // Rs. 10 per km; both are recorded so the seller payout and the partner
    // ledger use the same figures.
    const lines = (order.items || []).length || 1;
    order.selfDeliveryCharge = SELF_DELIVERY_FEE_PER_ORDER_LINE * lines;
    order.totalAmount = Math.round(((order.subtotal || 0) + (order.deliveryCharge || 0) + (order.platformFee || 0) + order.selfDeliveryCharge - (order.couponDiscount || 0)) * 100) / 100;
    order.deliveryFee = Math.round(((order.deliveryDistanceKm || 0) * DELIVERY_RATE_PER_KM) * 100) / 100;
    order.deliveryJourney = order.deliveryJourney || [];
    order.deliveryJourney.push({ status: order.orderStatus, note: `Assigned to ${partner.name}`, at: new Date() });
    await order.save();

    // Send notification to partner
    await sendEmail({
      to: partner.email,
      subject: 'New Delivery Assignment',
      text: `You have been assigned a new delivery. Order: ${order.orderNumber}`
    });

    return {
      success: true,
      order,
      partner
    };
  } catch (error) {
    console.error('Error assigning delivery partner:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Calculate delivery earnings
 */
export const calculateDeliveryEarnings = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    
    if (!order || !order.assignedDeliveryPartner) {
      throw new Error('Order or delivery partner not found');
    }

    // Calculate distance (in production, use actual delivery distance)
    // Real travelled distance when known, otherwise a conservative estimate.
    const distance = Number(order.deliveryDistanceKm) || 0;
    const earnings = distance * DELIVERY_RATE_PER_KM;

    // Update partner earnings
    const partner = await DeliveryPartner.findById(order.assignedDeliveryPartner);
    partner.pendingEarnings += earnings;
    partner.totalDeliveries += 1;
    await partner.save();

    return {
      success: true,
      earnings,
      distance
    };
  } catch (error) {
    console.error('Error calculating delivery earnings:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Process withdrawal request
 */
export const processWithdrawal = async (partnerId, amount) => {
  try {
    const partner = await DeliveryPartner.findById(partnerId);

    if (!partner) {
      throw new Error('Partner not found');
    }

    if (amount < 50) {
      throw new Error('Minimum withdrawal amount is ₹50');
    }

    if (amount % 50 !== 0) {
      throw new Error('Withdrawal amount must be in multiples of ₹50');
    }

    if (partner.pendingEarnings < amount) {
      throw new Error('Insufficient balance');
    }

    // Check if already withdrawn today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastWithdrawal = partner.lastWithdrawalAt ? new Date(partner.lastWithdrawalAt) : null;
    if (lastWithdrawal && lastWithdrawal >= today) {
      throw new Error('You can only withdraw once per day');
    }

    // Calculate fee
    const fee = (amount / 50) * WITHDRAWAL_FEE;
    const netAmount = amount - fee;

    // Update partner
    partner.pendingEarnings -= amount;
    partner.totalEarnings += netAmount;
    partner.lastWithdrawalAt = new Date();
    await partner.save();

    // In production, integrate with RazorpayX for actual transfer
    // For now, just record the withdrawal
    console.log(`Withdrawal processed: ₹${netAmount} to ${partner.bankDetails.accountNumber}`);

    return {
      success: true,
      amount: netAmount,
      fee,
      transactionId: `WD${Date.now()}`
    };
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update partner location
 */
export const updatePartnerLocation = async (partnerId, latitude, longitude) => {
  try {
    const partner = await DeliveryPartner.findById(partnerId);

    if (!partner) {
      throw new Error('Partner not found');
    }

    partner.currentLocation = {
      latitude,
      longitude,
      updatedAt: new Date()
    };
    await partner.save();

    return {
      success: true,
      partner
    };
  } catch (error) {
    console.error('Error updating partner location:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Complete delivery
 */
export const completeDelivery = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    
    if (!order || !order.assignedDeliveryPartner) {
      throw new Error('Order or delivery partner not found');
    }

    // Calculate earnings
    const earningsResult = await calculateDeliveryEarnings(orderId);

    // Update order. The status field on Order is `orderStatus`; writing a
    // non-existent path left partner-delivered orders stuck in transit, so no
    // commission or payout was ever triggered for them.
    order.orderStatus = 'delivered';
    order.deliveredAt = new Date();
    order.deliveryDate = new Date();
    order.deliveryJourney = order.deliveryJourney || [];
    order.deliveryJourney.push({ status: 'delivered', note: 'Delivered by partner', at: new Date() });
    await order.save();

    // Booking the platform commission happens automatically on delivery.
    try {
      const { settleDeliveredOrder } = await import('./commissionTracking.js');
      await settleDeliveredOrder(order);
    } catch (settleErr) {
      console.error('Auto commission settlement after partner delivery:', settleErr.message);
    }

    // Update partner
    const partner = await DeliveryPartner.findById(order.assignedDeliveryPartner);
    partner.currentOrder = null;
    partner.isAvailable = true;
    await partner.save();

    return {
      success: true,
      order,
      earnings: earningsResult.earnings
    };
  } catch (error) {
    console.error('Error completing delivery:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get partner dashboard data
 */
export const getPartnerDashboard = async (partnerId) => {
  try {
    const partner = await DeliveryPartner.findById(partnerId)
      .select('-password -loginOtp -loginOtpExpiry');

    if (!partner) {
      throw new Error('Partner not found');
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(Date.now() - 7 * 864e5);
    const startOfMonth = new Date(Date.now() - 30 * 864e5);

    const activeFilter = {
      assignedDeliveryPartner: partnerId,
      orderStatus: { $in: ['confirmed', 'packed', 'picked_up', 'in_transit'] }
    };

    const [activeOrders, deliveredAll, deliveredToday, weekAgg, monthAgg] = await Promise.all([
      Order.find(activeFilter)
        .sort({ updatedAt: -1 })
        .limit(20)
        .populate('user', 'name phone email')
        .populate('seller', 'storeName phone address city')
        .lean(),
      Order.countDocuments({ assignedDeliveryPartner: partnerId, orderStatus: 'delivered' }),
      Order.countDocuments({
        assignedDeliveryPartner: partnerId,
        orderStatus: 'delivered',
        deliveredAt: { $gte: startOfDay }
      }),
      Order.aggregate([
        { $match: { assignedDeliveryPartner: new mongoose.Types.ObjectId(String(partnerId)), orderStatus: 'delivered', deliveredAt: { $gte: startOfWeek } } },
        { $group: { _id: null, total: { $sum: '$deliveryFee' }, count: { $sum: 1 } } }
      ]),
      Order.aggregate([
        { $match: { assignedDeliveryPartner: new mongoose.Types.ObjectId(String(partnerId)), orderStatus: 'delivered', deliveredAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$deliveryFee' }, count: { $sum: 1 } } }
      ])
    ]);

    const mapRow = (o) => ({
      orderId: String(o._id),
      orderNumber: o.orderNumber || String(o._id).slice(-8),
      orderStatus: o.orderStatus,
      customerName: o.user?.name || 'Customer',
      customerPhone: o.user?.phone || '',
      address: [o.shippingAddress?.street, o.shippingAddress?.city, o.shippingAddress?.pincode].filter(Boolean).join(', '),
      distance: Number.isFinite(o.deliveryDistanceKm) ? `${o.deliveryDistanceKm} km` : null,
      earnings: o.deliveryFee || 0,
      pickup: {
        name: o.pickupLocation?.name || o.seller?.storeName || '',
        address: o.pickupLocation?.address || [o.seller?.address?.street, o.seller?.address?.city, o.seller?.address?.pincode].filter(Boolean).join(', ') || o.seller?.city || '',
        lat: o.pickupLocation?.lat,
        lng: o.pickupLocation?.lng
      },
      drop: {
        address: [o.shippingAddress?.street, o.shippingAddress?.city, o.shippingAddress?.pincode].filter(Boolean).join(', '),
        lat: o.deliveryLocation?.lat ?? o.shippingAddress?.coordinates?.[1],
        lng: o.deliveryLocation?.lng ?? o.shippingAddress?.coordinates?.[0]
      }
    });

    const availableBalance = (partner.totalEarnings || 0) - (partner.totalWithdrawn || 0);

    return {
      success: true,
      // Flattened shape the partner dashboard renders, kept alongside the raw
      // document so nothing that reads `partner` breaks.
      partner,
      currentOrder: activeOrders[0] || null,
      recentDeliveries: deliveredAll,
      activeDeliveries: activeOrders.map(mapRow),
      todayDeliveries: deliveredToday,
      completedToday: deliveredToday,
      pendingDeliveries: activeOrders.length,
      totalDeliveries: partner.totalDeliveries || deliveredAll,
      totalEarnings: partner.totalEarnings || 0,
      pendingEarnings: partner.pendingEarnings || 0,
      availableBalance: Math.round(availableBalance * 100) / 100,
      totalWithdrawn: partner.totalWithdrawn || 0,
      weeklyEarnings: Math.round((weekAgg[0]?.total || 0) * 100) / 100,
      monthlyEarnings: Math.round((monthAgg[0]?.total || 0) * 100) / 100,
      canWithdrawToday: !partner.lastWithdrawalAt || new Date(partner.lastWithdrawalAt) < startOfDay,
      isOnline: partner.status === 'online',
      locationSharing: !!partner.locationSharing,
      rating: partner.rating || 0
    };
  } catch (error) {
    console.error('Error getting partner dashboard:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all delivery partners (admin)
 */
export const getAllDeliveryPartners = async (filters = {}) => {
  try {
    const partners = await DeliveryPartner.find(filters)
      .select('-password -loginOtp -loginOtpExpiry')
      .sort({ createdAt: -1 });

    return {
      success: true,
      partners
    };
  } catch (error) {
    console.error('Error getting all delivery partners:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  findNearbyDeliveryPartners,
  assignDeliveryPartner,
  calculateDeliveryEarnings,
  processWithdrawal,
  updatePartnerLocation,
  completeDelivery,
  getPartnerDashboard,
  getAllDeliveryPartners
};
