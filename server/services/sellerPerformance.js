import Order from '../models/Order.js';
import Product from '../models/Product.js';
import ReturnRequest from '../models/ReturnRequest.js';
import Review from '../models/Review.js';

/**
 * Calculate seller performance metrics
 */
export const calculateSellerMetrics = async (sellerId, dateRange = {}) => {
  try {
    const { startDate, endDate } = dateRange;
    const dateFilter = {};
    
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Get all orders for this seller
    const orders = await Order.find({
      seller: sellerId,
      ...dateFilter
    });

    // Calculate delivery metrics
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    const totalDelivered = deliveredOrders.length;
    
    let avgDeliveryTime = 0;
    if (totalDelivered > 0) {
      const deliveryTimes = deliveredOrders
        .filter(o => o.deliveredAt && o.orderDate)
        .map(o => {
          const orderDate = new Date(o.orderDate);
          const deliveredDate = new Date(o.deliveredAt);
          return (deliveredDate - orderDate) / (1000 * 60 * 60 * 24); // days
        });
      
      avgDeliveryTime = deliveryTimes.length > 0
        ? deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length
        : 0;
    }

    // Calculate return rate
    const returns = await ReturnRequest.find({
      seller: sellerId,
      ...dateFilter
    });
    
    const returnRate = orders.length > 0
      ? (returns.length / orders.length) * 100
      : 0;

    // Calculate customer satisfaction
    const reviews = await Review.find({
      seller: sellerId,
      ...dateFilter
    });
    
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    // Calculate total revenue
    const totalRevenue = orders
      .filter(o => o.paymentStatus === 'completed')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    // Calculate total orders
    const totalOrders = orders.length;

    // Calculate completion rate
    const completionRate = totalOrders > 0
      ? (deliveredOrders.length / totalOrders) * 100
      : 0;

    // Calculate cancellation rate
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');
    const cancellationRate = totalOrders > 0
      ? (cancelledOrders.length / totalOrders) * 100
      : 0;

    // Get top selling products
    const productSales = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product.toString();
        if (!productSales[productId]) {
          productSales[productId] = {
            productId,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[productId].quantity += item.quantity;
        productSales[productId].revenue += item.price * item.quantity;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Populate product details
    const topProductsWithDetails = await Promise.all(
      topProducts.map(async (p) => {
        const product = await Product.findById(p.productId);
        return {
          ...p,
          product: product ? {
            title: product.title,
            image: product.images?.[0] || null,
            brand: product.brand
          } : null
        };
      })
    );

    return {
      success: true,
      metrics: {
        totalOrders,
        totalDelivered,
        totalRevenue,
        avgDeliveryTime: Math.round(avgDeliveryTime * 10) / 10,
        returnRate: Math.round(returnRate * 10) / 10,
        avgRating: Math.round(avgRating * 10) / 10,
        completionRate: Math.round(completionRate * 10) / 10,
        cancellationRate: Math.round(cancellationRate * 10) / 10,
        totalReviews: reviews.length,
        totalReturns: returns.length,
        topProducts: topProductsWithDetails
      }
    };
  } catch (error) {
    console.error('Error calculating seller metrics:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get seller performance badge
 */
export const getSellerBadge = (metrics) => {
  if (!metrics) return null;

  const { avgRating, returnRate, avgDeliveryTime, completionRate } = metrics;

  // Top Performer: High rating, low return rate, fast delivery, high completion
  if (avgRating >= 4.5 && returnRate <= 5 && avgDeliveryTime <= 3 && completionRate >= 95) {
    return {
      type: 'top_performer',
      label: 'Top Performer',
      color: '#FFD700',
      icon: 'trophy'
    };
  }

  // High Rated: High rating
  if (avgRating >= 4.5) {
    return {
      type: 'high_rated',
      label: 'Highly Rated',
      color: '#4CAF50',
      icon: 'star'
    };
  }

  // Fast Shipper: Fast delivery
  if (avgDeliveryTime <= 2) {
    return {
      type: 'fast_shipper',
      label: 'Fast Shipper',
      color: '#2196F3',
      icon: 'truck'
    };
  }

  // Reliable: High completion rate
  if (completionRate >= 95) {
    return {
      type: 'reliable',
      label: 'Reliable Seller',
      color: '#9C27B0',
      icon: 'shield'
    };
  }

  return null;
};

/**
 * Get all sellers with performance metrics
 */
export const getAllSellersWithMetrics = async (dateRange = {}) => {
  try {
    const Seller = (await import('../models/Seller.js')).default;
    const sellers = await Seller.find({ isActive: true });

    const sellersWithMetrics = await Promise.all(
      sellers.map(async (seller) => {
        const metricsResult = await calculateSellerMetrics(seller._id, dateRange);
        
        if (metricsResult.success) {
          const badge = getSellerBadge(metricsResult.metrics);
          
          return {
            seller: {
              _id: seller._id,
              name: seller.name,
              storeName: seller.storeName,
              email: seller.email,
              avatar: seller.avatar
            },
            metrics: metricsResult.metrics,
            badge
          };
        }
        
        return null;
      })
    );

    return {
      success: true,
      sellers: sellersWithMetrics.filter(s => s !== null)
    };
  } catch (error) {
    console.error('Error getting all sellers with metrics:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  calculateSellerMetrics,
  getSellerBadge,
  getAllSellersWithMetrics
};
