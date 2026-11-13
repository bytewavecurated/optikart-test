import OrderRouting from '../models/OrderRouting.js';
import Order from '../models/Order.js';
import Seller from '../models/Seller.js';
import Product from '../models/Product.js';
import { sendSellerOrderNotification } from './email.js';

const SELLER_RESPONSE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_NEARBY_SELLERS = 5;
const SEARCH_RADIUS_KM = 10;

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
 * Find nearby sellers who have the product
 */
const findNearbySellers = async (productId, customerLocation) => {
  try {
    // Get all sellers with their location
    const sellers = await Seller.find({ 
      isActive: true,
      isVerified: true,
      location: { $exists: true }
    });

    // Filter sellers within radius
    const nearbySellers = sellers
      .map(seller => {
        const distance = calculateDistance(
          customerLocation.latitude,
          customerLocation.longitude,
          seller.location.latitude,
          seller.location.longitude
        );
        return { seller, distance };
      })
      .filter(item => item.distance <= SEARCH_RADIUS_KM)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_NEARBY_SELLERS);

    // Check which sellers have the product
    const sellersWithProduct = [];
    for (const { seller, distance } of nearbySellers) {
      const hasProduct = await Product.findOne({
        seller: seller._id,
        _id: productId,
        isActive: true,
        stock: { $gt: 0 }
      });

      if (hasProduct) {
        sellersWithProduct.push({
          seller: seller._id,
          distance: Math.round(distance * 10) / 10,
          hasProduct: true
        });
      }
    }

    return sellersWithProduct;
  } catch (error) {
    console.error('Error finding nearby sellers:', error);
    return [];
  }
};

/**
 * Route order to nearby sellers
 */
export const routeOrder = async (orderId, customerLocation) => {
  try {
    const order = await Order.findById(orderId).populate('items.product');
    
    if (!order) {
      throw new Error('Order not found');
    }

    // Get the first product from the order
    const productId = order.items[0].product._id;

    // Find nearby sellers
    const nearbySellers = await findNearbySellers(productId, customerLocation);

    if (nearbySellers.length === 0) {
      // No nearby sellers found, mark for admin assignment
      const routing = await OrderRouting.create({
        order: orderId,
        customerLocation,
        nearbySellers: [],
        status: 'routing',
        timeoutAt: new Date(Date.now() + SELLER_RESPONSE_TIMEOUT)
      });

      return {
        success: false,
        message: 'No nearby sellers found',
        routing
      };
    }

    // Create order routing record
    const routing = await OrderRouting.create({
      order: orderId,
      customerLocation,
      nearbySellers: nearbySellers.map(s => ({
        ...s,
        response: 'pending'
      })),
      currentSellerIndex: 0,
      status: 'routing',
      timeoutAt: new Date(Date.now() + SELLER_RESPONSE_TIMEOUT)
    });

    // Contact first seller
    await contactNextSeller(routing._id);

    return {
      success: true,
      routing,
      nearbySellers: nearbySellers.length
    };
  } catch (error) {
    console.error('Error routing order:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Contact next seller in the list
 */
export const contactNextSeller = async (routingId) => {
  try {
    const routing = await OrderRouting.findById(routingId)
      .populate('order')
      .populate({
        path: 'nearbySellers.seller',
        select: 'name email storeName phone'
      });

    if (!routing) {
      throw new Error('Routing not found');
    }

    if (routing.currentSellerIndex >= routing.nearbySellers.length) {
      // All sellers contacted, mark for admin assignment
      routing.status = 'timeout';
      await routing.save();
      
      return {
        success: false,
        message: 'All sellers contacted, no response'
      };
    }

    const currentSeller = routing.nearbySellers[routing.currentSellerIndex];
    
    // Mark as contacted
    currentSeller.contactedAt = new Date();
    currentSeller.response = 'pending';
    routing.status = 'seller_contacted';
    routing.timeoutAt = new Date(Date.now() + SELLER_RESPONSE_TIMEOUT);
    
    await routing.save();

    // Send notification to seller
    const seller = await Seller.findById(currentSeller.seller);
    if (seller) {
      await sendSellerOrderNotification(seller.email, routing.order, seller);
    }

    // Set timeout to contact next seller
    setTimeout(async () => {
      await handleSellerTimeout(routingId);
    }, SELLER_RESPONSE_TIMEOUT);

    return {
      success: true,
      seller: currentSeller.seller,
      timeoutAt: routing.timeoutAt
    };
  } catch (error) {
    console.error('Error contacting next seller:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Handle seller timeout
 */
const handleSellerTimeout = async (routingId) => {
  try {
    const routing = await OrderRouting.findById(routingId);
    
    if (!routing || routing.status !== 'seller_contacted') {
      return;
    }

    const currentSeller = routing.nearbySellers[routing.currentSellerIndex];
    
    // Mark as timeout
    currentSeller.response = 'timeout';
    currentSeller.respondedAt = new Date();
    routing.currentSellerIndex += 1;

    await routing.save();

    // Contact next seller
    if (routing.currentSellerIndex < routing.nearbySellers.length) {
      await contactNextSeller(routingId);
    } else {
      // All sellers timed out
      routing.status = 'timeout';
      await routing.save();
    }
  } catch (error) {
    console.error('Error handling seller timeout:', error);
  }
};

/**
 * Seller accepts order
 */
export const sellerAcceptOrder = async (routingId, sellerId) => {
  try {
    const routing = await OrderRouting.findById(routingId);
    
    if (!routing) {
      throw new Error('Routing not found');
    }

    const sellerIndex = routing.nearbySellers.findIndex(
      s => s.seller.toString() === sellerId.toString()
    );

    if (sellerIndex === -1) {
      throw new Error('Seller not in routing list');
    }

    const currentSeller = routing.nearbySellers[sellerIndex];
    
    // Mark as accepted
    currentSeller.response = 'accepted';
    currentSeller.respondedAt = new Date();
    routing.status = 'seller_accepted';
    routing.assignedSeller = sellerId;
    routing.completedAt = new Date();
    
    await routing.save();

    // Update order with assigned seller
    await Order.findByIdAndUpdate(routing.order, {
      seller: sellerId,
      status: 'confirmed'
    });

    return {
      success: true,
      message: 'Order accepted by seller'
    };
  } catch (error) {
    console.error('Error accepting order:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Seller rejects order
 */
export const sellerRejectOrder = async (routingId, sellerId, reason) => {
  try {
    const routing = await OrderRouting.findById(routingId);
    
    if (!routing) {
      throw new Error('Routing not found');
    }

    const sellerIndex = routing.nearbySellers.findIndex(
      s => s.seller.toString() === sellerId.toString()
    );

    if (sellerIndex === -1) {
      throw new Error('Seller not in routing list');
    }

    const currentSeller = routing.nearbySellers[sellerIndex];
    
    // Mark as rejected
    currentSeller.response = 'rejected';
    currentSeller.respondedAt = new Date();
    routing.currentSellerIndex += 1;

    await routing.save();

    // Contact next seller
    if (routing.currentSellerIndex < routing.nearbySellers.length) {
      await contactNextSeller(routingId);
    } else {
      // All sellers rejected
      routing.status = 'timeout';
      await routing.save();
    }

    return {
      success: true,
      message: 'Order rejected by seller'
    };
  } catch (error) {
    console.error('Error rejecting order:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Admin assigns order to seller
 */
export const adminAssignOrder = async (routingId, sellerId, adminNotes) => {
  try {
    const routing = await OrderRouting.findById(routingId);
    
    if (!routing) {
      throw new Error('Routing not found');
    }

    routing.status = 'admin_assigned';
    routing.assignedSeller = sellerId;
    routing.assignedBy = 'admin';
    routing.adminNotes = adminNotes;
    routing.completedAt = new Date();
    
    await routing.save();

    // Update order with assigned seller
    await Order.findByIdAndUpdate(routing.order, {
      seller: sellerId,
      status: 'confirmed'
    });

    return {
      success: true,
      message: 'Order assigned by admin'
    };
  } catch (error) {
    console.error('Error assigning order:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * AI auto-assigns order based on logic
 */
/**
 * Assign the best-ranked candidate on the shortlist.
 *
 * The name says AI, and the old body matched it in the worst way: it read
 * `seller.rating`, `seller.avgDeliveryTime` and `seller.returnRate` straight off
 * the Seller document and combined them into a score. Those three fields exist on
 * the schema with a default of 0, and no code in this project ever writes to
 * them - so every seller's history looked perfect and, apart from distance,
 * every seller looked the same. The decision string then told the admin it was
 * `Auto-assigned based on score`.
 *
 * It now takes the ranking that services/sellerRanking.js measured from real
 * orders, returns and reviews and stored on this routing document, and records
 * the reasons it used. Nothing here is intelligent; it is a rule with visible
 * arithmetic, which is what an operations desk can actually audit.
 */
export const aiAutoAssignOrder = async (routingId) => {
  try {
    const routing = await OrderRouting.findById(routingId)
      .populate({ path: 'nearbySellers.seller', select: 'name storeName phone email location rating' });

    if (!routing) throw new Error('Routing not found');

    const ranked = [...(routing.nearbySellers || [])]
      .filter((entry) => entry.seller)
      .sort((a, b) => {
        const sa = Number.isFinite(a.score) ? a.score : (Number.isFinite(a.distance) ? 100 - a.distance : -1);
        const sb = Number.isFinite(b.score) ? b.score : (Number.isFinite(b.distance) ? 100 - b.distance : -1);
        return sb - sa;
      });

    if (!ranked.length) {
      routing.status = 'admin_required';
      await routing.save();
      return {
        success: false,
        status: 'admin_required',
        message: 'No seller was available to rank. This order needs a manual assignment.'
      };
    }

    const best = ranked[0];
    const reasons = (best.scoreReasons || []).filter(Boolean);
    const measured = best.score
      ? `rank #${best.rank ?? 1} of ${ranked.length}, score ${best.score.toFixed(1)}`
      : `closest candidate at ${best.distance ?? 'unknown'} km (no measured score on this routing)`;

    routing.status = 'seller_accepted';
    routing.assignedSeller = best.seller._id;
    routing.assignedBy = 'auto';
    routing.assignedAt = new Date();
    routing.aiDecision = `Assigned ${best.seller.storeName || best.seller.name} - ${measured}. ${reasons.join('; ')}`;
    routing.completedAt = new Date();
    await routing.save();

    await Order.findByIdAndUpdate(routing.order, {
      seller: best.seller._id,
      status: 'confirmed',
      assignmentStatus: 'assigned'
    });

    return {
      success: true,
      message: 'Assigned to the highest-ranked seller on the shortlist.',
      assignedSeller: best.seller,
      score: best.score ?? null,
      reasons,
      candidatesConsidered: ranked.length
    };
  } catch (error) {
    console.error('Error auto-assigning order:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get order routing details
 */
export const getOrderRouting = async (routingId) => {
  try {
    const routing = await OrderRouting.findById(routingId)
      .populate('order')
      .populate('nearbySellers.seller', 'name email storeName phone rating')
      .populate('assignedSeller', 'name email storeName phone');

    if (!routing) {
      throw new Error('Routing not found');
    }

    return {
      success: true,
      routing
    };
  } catch (error) {
    console.error('Error getting order routing:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get all order routings (admin)
 */
export const getAllOrderRoutings = async (filters = {}) => {
  try {
    const routings = await OrderRouting.find(filters)
      .populate('order')
      .populate('nearbySellers.seller', 'name storeName')
      .populate('assignedSeller', 'name storeName')
      .sort({ createdAt: -1 });

    return {
      success: true,
      routings
    };
  } catch (error) {
    console.error('Error getting all order routings:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  routeOrder,
  contactNextSeller,
  sellerAcceptOrder,
  sellerRejectOrder,
  adminAssignOrder,
  aiAutoAssignOrder,
  getOrderRouting,
  getAllOrderRoutings
};
