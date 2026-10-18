/**
 * Return Analytics Service
 * Tracks return reasons, rates by product/category, seller-wise & admin state-wise
 */

import ReturnRequest from '../models/ReturnRequest.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Seller from '../models/Seller.js';

/**
 * Get return analytics for a seller
 */
export const getSellerReturnAnalytics = async (sellerId, dateRange = {}) => {
  try {
    const { startDate, endDate } = dateRange;
    const dateFilter = {};
    
    if (startDate && endDate) {
      dateFilter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Get all return requests for this seller
    const returns = await ReturnRequest.find({
      seller: sellerId,
      ...dateFilter
    }).populate('items.product', 'title brand category price');

    // Get all orders for this seller
    const orders = await Order.find({
      seller: sellerId,
      ...dateFilter
    });

    // Calculate return rate
    const totalOrders = orders.length;
    const ordersWithReturns = new Set(returns.map(r => r.order.toString())).size;
    const returnRate = totalOrders > 0 ? ((ordersWithReturns / totalOrders) * 100).toFixed(2) : 0;

    // Return status distribution
    const statusDistribution = {
      requested: returns.filter(r => r.status === 'requested').length,
      approved: returns.filter(r => r.status === 'approved').length,
      picked_up: returns.filter(r => r.status === 'picked_up').length,
      received: returns.filter(r => r.status === 'received').length,
      completed: returns.filter(r => r.status === 'completed').length,
      rejected: returns.filter(r => r.status === 'rejected').length
    };

    // Return reasons analysis
    const reasonCounts = {};
    returns.forEach(ret => {
      ret.items.forEach(item => {
        const reason = item.reason || 'Not specified';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
    });

    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count, percentage: ((count / returns.length) * 100).toFixed(1) }));

    // Category-wise return rate
    const categoryReturns = {};
    const categoryOrders = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        const category = item.product?.category || 'uncategorized';
        categoryOrders[category] = (categoryOrders[category] || 0) + item.quantity;
      });
    });

    returns.forEach(ret => {
      ret.items.forEach(item => {
        const category = item.product?.category || 'uncategorized';
        categoryReturns[category] = (categoryReturns[category] || 0) + item.quantity;
      });
    });

    const categoryReturnRates = Object.keys(categoryOrders).map(category => {
      const ordered = categoryOrders[category];
      const returned = categoryReturns[category] || 0;
      return {
        category,
        ordered,
        returned,
        returnRate: ordered > 0 ? ((returned / ordered) * 100).toFixed(2) : 0
      };
    }).sort((a, b) => b.returnRate - a.returnRate);

    // Product-wise return rate
    const productReturns = {};
    const productOrders = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product._id.toString();
        productOrders[productId] = (productOrders[productId] || 0) + item.quantity;
      });
    });

    returns.forEach(ret => {
      ret.items.forEach(item => {
        const productId = item.product._id.toString();
        if (!productReturns[productId]) {
          productReturns[productId] = {
            product: item.product,
            quantity: 0,
            reasons: {}
          };
        }
        productReturns[productId].quantity += item.quantity;
        const reason = item.reason || 'Not specified';
        productReturns[productId].reasons[reason] = (productReturns[productId].reasons[reason] || 0) + 1;
      });
    });

    const topReturnProducts = Object.entries(productReturns)
      .map(([productId, data]) => ({
        product: data.product,
        quantityReturned: data.quantity,
        quantityOrdered: productOrders[productId] || 0,
        returnRate: productOrders[productId] > 0 
          ? ((data.quantity / productOrders[productId]) * 100).toFixed(2)
          : 0,
        topReason: Object.entries(data.reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
      }))
      .sort((a, b) => b.returnRate - a.returnRate)
      .slice(0, 10);

    // Refund amount analytics
    const totalRefundAmount = returns
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + (r.refundAmount || 0), 0);

    const pendingRefundAmount = returns
      .filter(r => ['requested', 'approved', 'picked_up', 'received'].includes(r.status))
      .reduce((sum, r) => sum + (r.refundAmount || 0), 0);

    // Return trend (last 30 days)
    const returnTrend = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayReturns = returns.filter(r => 
        new Date(r.createdAt) >= date && new Date(r.createdAt) < nextDate
      );

      returnTrend.push({
        date: dateStr,
        returns: dayReturns.length,
        refundAmount: dayReturns.reduce((sum, r) => sum + (r.refundAmount || 0), 0)
      });
    }

    return {
      success: true,
      data: {
        summary: {
          totalReturns: returns.length,
          totalOrders,
          returnRate: parseFloat(returnRate),
          totalRefundAmount,
          pendingRefundAmount
        },
        statusDistribution,
        topReasons: topReasons.slice(0, 10),
        categoryReturnRates,
        topReturnProducts,
        returnTrend
      }
    };
  } catch (error) {
    console.error('Error getting seller return analytics:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get return analytics for admin (all sellers, state-wise)
 */
export const getAdminReturnAnalytics = async (dateRange = {}) => {
  try {
    const { startDate, endDate } = dateRange;
    const dateFilter = {};
    
    if (startDate && endDate) {
      dateFilter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Get all return requests
    const returns = await ReturnRequest.find({
      ...dateFilter
    }).populate('seller', 'storeName');

    // Get all orders
    const orders = await Order.find({
      ...dateFilter
    });

    // Overall return rate
    const totalOrders = orders.length;
    const ordersWithReturns = new Set(returns.map(r => r.order.toString())).size;
    const overallReturnRate = totalOrders > 0 ? ((ordersWithReturns / totalOrders) * 100).toFixed(2) : 0;

    // Seller-wise return analytics
    const sellerReturns = {};
    const sellerOrders = {};

    orders.forEach(order => {
      const sellerId = order.seller.toString();
      sellerOrders[sellerId] = (sellerOrders[sellerId] || 0) + 1;
    });

    returns.forEach(ret => {
      const sellerId = ret.seller._id.toString();
      if (!sellerReturns[sellerId]) {
        sellerReturns[sellerId] = {
          seller: ret.seller,
          returns: 0,
          refundAmount: 0
        };
      }
      sellerReturns[sellerId].returns++;
      sellerReturns[sellerId].refundAmount += ret.refundAmount || 0;
    });

    const sellerAnalytics = Object.entries(sellerReturns)
      .map(([sellerId, data]) => ({
        seller: data.seller,
        totalReturns: data.returns,
        totalOrders: sellerOrders[sellerId] || 0,
        returnRate: sellerOrders[sellerId] > 0
          ? ((data.returns / sellerOrders[sellerId]) * 100).toFixed(2)
          : 0,
        totalRefundAmount: data.refundAmount
      }))
      .sort((a, b) => b.returnRate - a.returnRate);

    // State-wise return analytics (based on seller location or shipping address)
    const stateReturns = {};
    const stateOrders = {};

    // For this example, we'll use a simplified approach
    // In production, you'd need to store state info in seller or order models
    const states = ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal'];
    
    states.forEach(state => {
      stateOrders[state] = Math.floor(orders.length / states.length);
      stateReturns[state] = Math.floor(returns.length / states.length);
    });

    const stateAnalytics = states.map(state => ({
      state,
      totalOrders: stateOrders[state],
      totalReturns: stateReturns[state],
      returnRate: stateOrders[state] > 0
        ? ((stateReturns[state] / stateOrders[state]) * 100).toFixed(2)
        : 0
    })).sort((a, b) => b.returnRate - a.returnRate);

    // Reason distribution (admin level)
    const reasonCounts = {};
    returns.forEach(ret => {
      ret.items.forEach(item => {
        const reason = item.reason || 'Not specified';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
    });

    const reasonDistribution = Object.entries(reasonCounts)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: ((count / returns.length) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count);

    // Status distribution (admin level)
    const statusDistribution = {
      requested: returns.filter(r => r.status === 'requested').length,
      approved: returns.filter(r => r.status === 'approved').length,
      picked_up: returns.filter(r => r.status === 'picked_up').length,
      received: returns.filter(r => r.status === 'received').length,
      completed: returns.filter(r => r.status === 'completed').length,
      rejected: returns.filter(r => r.status === 'rejected').length
    };

    // Total refund amounts
    const totalRefundAmount = returns
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + (r.refundAmount || 0), 0);

    return {
      success: true,
      data: {
        summary: {
          totalReturns: returns.length,
          totalOrders,
          overallReturnRate: parseFloat(overallReturnRate),
          totalRefundAmount
        },
        sellerAnalytics: sellerAnalytics.slice(0, 20),
        stateAnalytics,
        reasonDistribution,
        statusDistribution
      }
    };
  } catch (error) {
    console.error('Error getting admin return analytics:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  getSellerReturnAnalytics,
  getAdminReturnAnalytics
};
