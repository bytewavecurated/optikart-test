/**
 * Commission Tracking Service
 * Tracks and manages commissions from each order
 */

import Order from '../models/Order.js';
import Seller from '../models/Seller.js';

const DEFAULT_COMMISSION_PERCENTAGE = 3; // 3% commission

/**
 * Calculate commission for an order
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

    // Calculate commission
    const orderAmount = order.totalAmount || order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const commissionPercentage = order.commissionPercentage || DEFAULT_COMMISSION_PERCENTAGE;
    const commissionData = calculateCommission(orderAmount, commissionPercentage);

    // Update order with commission details
    order.commissionAmount = commissionData.commissionAmount;
    order.commissionPercentage = commissionPercentage;
    order.netAmountToSeller = commissionData.netAmount;
    order.commissionRecorded = true;
    order.commissionRecordedAt = new Date();

    await order.save();

    // Update seller's total commission earned
    await Seller.findByIdAndUpdate(order.seller._id, {
      $inc: { 
        totalCommissionEarned: commissionData.commissionAmount,
        totalSales: orderAmount
      }
    });

    return {
      success: true,
      message: 'Commission recorded successfully',
      commission: commissionData,
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
      averageCommissionPercentage: 0,
      bySeller: {}
    };

    orders.forEach(order => {
      summary.totalOrderAmount += order.totalAmount || 0;
      summary.totalCommission += order.commissionAmount || 0;
      summary.totalNetToSellers += order.netAmountToSeller || 0;

      const sellerId = order.seller._id.toString();
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
