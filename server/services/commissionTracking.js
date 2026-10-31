/**
 * Commission Tracking Service
 * Tracks and manages commissions from each order
 */

import Order from '../models/Order.js';
import Seller from '../models/Seller.js';

const DEFAULT_COMMISSION_PERCENTAGE = 3; // 3% commission

/**
 * Build the money picture for one order.
 *
 * Rules the platform operates on:
 *  - Commission is charged on the merchandise subtotal only. Delivery and
 *    platform fees are not merchandise, so taking a percentage of them would
 *    over-charge the seller.
 *  - Fulfilment cost is borne by the seller: the Shiprocket bill for automatic
 *    deliveries, or the per-order fee when the platform delivers it itself.
 *  - Everything the customer paid that is not passed to the seller (platform
 *    commission, platform fee, the customer-facing delivery charge) is platform
 *    revenue and lands in the Razorpay account.
 */
export const buildOrderSettlement = (order) => {
  const subtotal = Number(order.subtotal)
    || (order.items || []).reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0);
  const commissionPercentage = Number(order.commissionPercentage ?? DEFAULT_COMMISSION_PERCENTAGE);
  const customerDeliveryCharge = Number(order.deliveryCharge || 0);
  const platformFee = Number(order.platformFee || 0);
  // What it actually cost to get the parcel delivered.
  const fulfilmentCost = order.deliveryAssignmentMode === 'self'
    ? Number(order.deliveryFee || 0)
    : Number(order.shiprocketDeliveryCharge || 0);

  const commission = Math.round(((subtotal * commissionPercentage) / 100) * 100) / 100;
  const netAmountToSeller =
    Math.round((subtotal - commission - fulfilmentCost) * 100) / 100;

  return {
    merchandiseAmount: subtotal,
    commissionPercentage,
    commissionAmount: commission,
    fulfilmentCost,
    netAmountToSeller,
    // Platform-side revenue, all of which is collected in the Razorpay account.
    platformRevenue: Math.round((commission + platformFee + customerDeliveryCharge) * 100) / 100
  };
};

/**
 * Calculate commission for an order.
 * `orderAmount` stays the merchandise base for backwards compatibility.
 */
export const calculateCommission = (orderAmount, commissionPercentage = DEFAULT_COMMISSION_PERCENTAGE) => {
  const commission = (orderAmount * commissionPercentage) / 100;
  return {
    orderAmount,
    commissionPercentage,
    commissionAmount: Math.round(commission * 100) / 100, // Round to 2 decimal places
    netAmount: Math.round((orderAmount - commission) * 100) / 100
  };
};

/**
 * Record commission for an order
 */
export const recordCommission = async (orderId) => {
  try {
    const order = await Order.findById(orderId).populate('seller');
    
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.commissionRecorded) {
      return { success: false, error: 'Commission already recorded for this order' };
    }

    // Calculate commission on merchandise only, and take the delivery cost out
    // of the seller's share as agreed.
    const settlement = buildOrderSettlement(order);

    order.commissionPercentage = settlement.commissionPercentage;
    order.commissionAmount = settlement.commissionAmount;
    order.netAmountToSeller = settlement.netAmountToSeller;
    order.commissionRecorded = true;
    order.commissionRecordedAt = new Date();

    await order.save();

    // Update the seller's running totals. The reference may not resolve if the
    // account was removed, so the ids are read off the raw document.
    const sellerRefId = order.seller && order.seller._id
      ? order.seller._id
      : order.seller;

    await Seller.findByIdAndUpdate(sellerRefId, {
      $inc: {
        totalCommissionEarned: settlement.commissionAmount,
        totalSales: settlement.merchandiseAmount
      }
    });

  
    return {
      success: true,
      message: 'Commission recorded successfully',
      commission: settlement,
      order: order.orderNumber
    };
  } catch (error) {
    console.error('Error recording commission:', error);
    return {
      success: false,
      error: error.message
    };
  }
};


/**
 * Called whenever an order reaches 'delivered'. Recording the commission here -
 * instead of waiting for an admin to press a button - is what makes the
 * commission model automatic. Safe to call repeatedly.
 */
export const settleDeliveredOrder = async (order) => {
  try {
    if (!order || order.orderStatus !== 'delivered') {
      return { success: false, skipped: true, reason: 'order is not delivered' };
    }
    if (order.commissionRecorded) {
      return { success: true, skipped: true, reason: 'already recorded' };
    }
    return await recordCommission(order._id);
  } catch (error) {
    console.error('Auto commission settlement failed:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get commission summary for admin
 */
export const getCommissionSummary = async (dateRange = {}) => {
  try {
    const dateFilter = {};
    if (dateRange.startDate && dateRange.endDate) {
      dateFilter.createdAt = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate)
      };
    }

    const orders = await Order.find({
      commissionRecorded: true,
      ...dateFilter
    }).populate('seller', 'storeName name email');

    const summary = {
      totalOrders: orders.length,
      totalOrderAmount: 0,
      totalCommission: 0,
      totalNetToSellers: 0,
      // Everything the platform keeps, itemised so the Razorpay balance can be
      // reconciled against it: commission + platform fee + customer delivery.
      totalPlatformFees: 0,
      totalDeliveryRevenue: 0,
      totalFulfilmentCost: 0,
      platformRevenue: 0,
      averageCommissionPercentage: 0,
      bySeller: {}
    };

    orders.forEach(order => {
      summary.totalOrderAmount += order.totalAmount || 0;
      summary.totalCommission += order.commissionAmount || 0;
      summary.totalNetToSellers += order.netAmountToSeller || 0;
      summary.totalPlatformFees += order.platformFee || 0;
      summary.totalDeliveryRevenue += order.deliveryCharge || 0;
      summary.totalFulfilmentCost += order.deliveryAssignmentMode === 'self'
        ? (order.deliveryFee || 0)
        : (order.shiprocketDeliveryCharge || 0);

      // Sellers can be deleted or banned, so the reference may not populate.
      const sellerId = String(order.seller?._id || order.seller || 'unknown');
      if (!summary.bySeller[sellerId]) {
        summary.bySeller[sellerId] = {
          seller: order.seller,
          totalOrders: 0,
          totalAmount: 0,
          totalCommission: 0,
          totalNet: 0
        };
      }

      summary.bySeller[sellerId].totalOrders++;
      summary.bySeller[sellerId].totalAmount += order.totalAmount || 0;
      summary.bySeller[sellerId].totalCommission += order.commissionAmount || 0;
      summary.bySeller[sellerId].totalNet += order.netAmountToSeller || 0;
    });

    const rupee = (n) => Math.round((Number(n) || 0) * 100) / 100;
    summary.platformRevenue = rupee(summary.totalCommission + summary.totalPlatformFees + summary.totalDeliveryRevenue);
    summary.totalOrderAmount = rupee(summary.totalOrderAmount);
    summary.totalCommission = rupee(summary.totalCommission);
    summary.totalNetToSellers = rupee(summary.totalNetToSellers);
    summary.totalPlatformFees = rupee(summary.totalPlatformFees);
    summary.totalDeliveryRevenue = rupee(summary.totalDeliveryRevenue);
    summary.totalFulfilmentCost = rupee(summary.totalFulfilmentCost);

    if (summary.totalOrders > 0) {
      summary.averageCommissionPercentage = (summary.totalCommission / summary.totalOrderAmount * 100).toFixed(2);
    }

    // Convert bySeller object to array and sort by commission
    summary.bySeller = Object.values(summary.bySeller).sort((a, b) => b.totalCommission - a.totalCommission);

    return {
      success: true,
      summary
    };
  } catch (error) {
    console.error('Error getting commission summary:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get commission details for a specific seller
 */
export const getSellerCommissionDetails = async (sellerId, dateRange = {}) => {
  try {
    const dateFilter = {};
    if (dateRange.startDate && dateRange.endDate) {
      dateFilter.createdAt = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate)
      };
    }

    const orders = await Order.find({
      seller: sellerId,
      commissionRecorded: true,
      ...dateFilter
    }).sort({ createdAt: -1 });

    const summary = {
      totalOrders: orders.length,
      totalOrderAmount: 0,
      totalCommission: 0,
      totalNet: 0,
      averageCommissionPercentage: 0,
      recentOrders: orders.slice(0, 10).map(order => ({
        orderNumber: order.orderNumber,
        orderAmount: order.totalAmount,
        commission: order.commissionAmount,
        netAmount: order.netAmountToSeller,
        date: order.createdAt
      }))
    };

    orders.forEach(order => {
      summary.totalOrderAmount += order.totalAmount || 0;
      summary.totalCommission += order.commissionAmount || 0;
      summary.totalNet += order.netAmountToSeller || 0;
    });

    if (summary.totalOrders > 0) {
      summary.averageCommissionPercentage = (summary.totalCommission / summary.totalOrderAmount * 100).toFixed(2);
    }

    return {
      success: true,
      summary
    };
  } catch (error) {
    console.error('Error getting seller commission details:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get pending commissions (orders not yet recorded)
 */
export const getPendingCommissions = async () => {
  try {
    const orders = await Order.find({
      commissionRecorded: { $ne: true },
      orderStatus: 'delivered'
    }).populate('seller', 'storeName name email')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    return {
      success: true,
      count: orders.length,
      orders: orders.map(order => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        seller: order.seller,
        customer: order.user,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt
      }))
    };
  } catch (error) {
    console.error('Error getting pending commissions:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  calculateCommission,
  recordCommission,
  getCommissionSummary,
  getSellerCommissionDetails,
  getPendingCommissions
};
