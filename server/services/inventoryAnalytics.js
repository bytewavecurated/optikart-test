/**
 * Inventory Analytics Service
 * Provides stock trends, fast/slow-moving items, and inventory health metrics
 */

import Product from '../models/Product.js';
import Order from '../models/Order.js';

/**
 * Get inventory analytics for a seller
 */
export const getSellerInventoryAnalytics = async (sellerId, dateRange = {}) => {
  try {
    const { startDate, endDate } = dateRange;
    const dateFilter = {};
    
    if (startDate && endDate) {
      dateFilter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Get all products for this seller
    const products = await Product.find({ seller: sellerId });
    
    // Calculate stock distribution
    const totalProducts = products.length;
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    const outOfStock = products.filter(p => !p.stock || p.stock === 0).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10).length;
    const healthyStock = products.filter(p => p.stock > 10).length;

    // Calculate stock value
    const totalStockValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);

    // Get orders to calculate sales velocity
    const orders = await Order.find({
      seller: sellerId,
      orderStatus: { $in: ['confirmed', 'packed', 'picked_up', 'in_transit', 'delivered'] },
      ...dateFilter
    }).populate('items.product');

    // Calculate sales by product
    const salesByProduct = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product._id.toString();
        if (!salesByProduct[productId]) {
          salesByProduct[productId] = {
            product: item.product,
            quantitySold: 0,
            revenue: 0
          };
        }
        salesByProduct[productId].quantitySold += item.quantity;
        salesByProduct[productId].revenue += item.price * item.quantity;
      });
    });

    // Calculate days since last sale for each product
    const daysSinceLastSale = {};
    products.forEach(product => {
      const productOrders = orders.filter(order => 
        order.items.some(item => item.product._id.toString() === product._id.toString())
      );
      
      if (productOrders.length > 0) {
        const lastOrder = productOrders.sort((a, b) => b.createdAt - a.createdAt)[0];
        const days = Math.floor((Date.now() - new Date(lastOrder.createdAt)) / (1000 * 60 * 60 * 24));
        daysSinceLastSale[product._id.toString()] = days;
      } else {
        daysSinceLastSale[product._id.toString()] = 999; // Never sold
      }
    });

    // Categorize products as fast/slow-moving
    const fastMoving = [];
    const slowMoving = [];
    const deadStock = [];

    Object.entries(salesByProduct).forEach(([productId, data]) => {
      const days = daysSinceLastSale[productId] || 999;
      const avgDailySales = data.quantitySold / Math.max(days, 1);
      
      if (avgDailySales >= 1) {
        fastMoving.push({ ...data, avgDailySales, daysSinceLastSale: days });
      } else if (avgDailySales > 0 && avgDailySales < 1) {
        slowMoving.push({ ...data, avgDailySales, daysSinceLastSale: days });
      } else {
        deadStock.push({ ...data, avgDailySales: 0, daysSinceLastSale: days });
      }
    });

    // Sort by sales velocity
    fastMoving.sort((a, b) => b.avgDailySales - a.avgDailySales);
    slowMoving.sort((a, b) => b.avgDailySales - a.avgDailySales);
    deadStock.sort((a, b) => a.daysSinceLastSale - b.daysSinceLastSale);

    // Category-wise stock distribution
    const categoryDistribution = {};
    products.forEach(product => {
      const category = product.category || 'uncategorized';
      if (!categoryDistribution[category]) {
        categoryDistribution[category] = {
          count: 0,
          stock: 0,
          value: 0
        };
      }
      categoryDistribution[category].count++;
      categoryDistribution[category].stock += product.stock || 0;
      categoryDistribution[category].value += (product.stock || 0) * (product.price || 0);
    });

    // Stock trend (last 30 days)
    const stockTrend = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Get orders for this date
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayOrders = await Order.find({
        seller: sellerId,
        createdAt: { $gte: date, $lt: nextDate },
        orderStatus: { $in: ['confirmed', 'packed', 'picked_up', 'in_transit', 'delivered'] }
      });

      const unitsSold = dayOrders.reduce((sum, order) => 
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
      );

      stockTrend.push({
        date: dateStr,
        unitsSold
      });
    }

    return {
      success: true,
      data: {
        summary: {
          totalProducts,
          totalStock,
          totalStockValue,
          outOfStock,
          lowStock,
          healthyStock
        },
        stockDistribution: {
          outOfStock,
          lowStock,
          healthyStock
        },
        categoryDistribution,
        fastMoving: fastMoving.slice(0, 10),
        slowMoving: slowMoving.slice(0, 10),
        deadStock: deadStock.slice(0, 10),
        stockTrend,
        salesByProduct: Object.values(salesByProduct).sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 10)
      }
    };
  } catch (error) {
    console.error('Error getting seller inventory analytics:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get inventory health score for a seller
 */
export const getInventoryHealthScore = async (sellerId) => {
  try {
    const products = await Product.find({ seller: sellerId });
    
    if (products.length === 0) {
      return { success: true, score: 0, grade: 'N/A' };
    }

    const totalProducts = products.length;
    const outOfStock = products.filter(p => !p.stock || p.stock === 0).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10).length;
    const healthyStock = products.filter(p => p.stock > 10).length;

    // Calculate health score (0-100)
    // Healthy stock = 100%, Low stock = 50%, Out of stock = 0%
    const score = Math.round(
      ((healthyStock * 100) + (lowStock * 50) + (outOfStock * 0)) / totalProducts
    );

    // Assign grade
    let grade = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';

    return {
      success: true,
      score,
      grade,
      breakdown: {
        healthyStock,
        lowStock,
        outOfStock,
        totalProducts
      }
    };
  } catch (error) {
    console.error('Error calculating inventory health score:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  getSellerInventoryAnalytics,
  getInventoryHealthScore
};
