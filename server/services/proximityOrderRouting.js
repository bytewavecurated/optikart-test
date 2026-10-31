/**
 * Proximity-Based Order Routing Service
 * Finds sellers within 5-10km of customer location for order assignment
 */

import Seller from '../models/Seller.js';
import Order from '../models/Order.js';
import { sendEmail, notify } from './email.js';

const DEFAULT_RADIUS_KM = 10;
const ORDER_ACCEPTANCE_TIMEOUT_MINUTES = 30;

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
 * Find sellers within radius of customer location
 */
export const findNearbySellers = async (customerLat, customerLon, radiusKm = DEFAULT_RADIUS_KM) => {
  try {
    // Use MongoDB geospatial query
    const sellers = await Seller.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [customerLon, customerLat]
          },
          $maxDistance: radiusKm * 1000 // Convert km to meters
        }
      },
      isActive: true,
      isBanned: false,
      isOnline: true
    }).limit(5); // Get top 5 nearest sellers

    // Calculate actual distances
    const sellersWithDistance = sellers.map(seller => {
      const distance = calculateDistance(
        customerLat,
        customerLon,
        seller.location.coordinates[1],
        seller.location.coordinates[0]
      );
      return {
        ...seller.toObject(),
        distance: Math.round(distance * 100) / 100
      };
    });

    return {
      success: true,
      sellers: sellersWithDistance,
      count: sellersWithDistance.length
    };
  } catch (error) {
    console.error('Error finding nearby sellers:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Assign order to nearest available seller with 30-min timeout
 */
export const assignOrderToNearestSeller = async (orderId, customerLat, customerLon) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    // Find nearby sellers
    const nearbyResult = await findNearbySellers(customerLat, customerLon);
    
    if (!nearbyResult.success || nearbyResult.count === 0) {
      // No sellers found - mark as admin assignment required
      order.assignmentStatus = 'admin_required';
      order.assignmentNotes = 'No sellers found within 10km radius';
      await order.save();
      
      return {
        success: false,
        message: 'No sellers found nearby. Admin assignment required.',
        requiresAdminAssignment: true
      };
    }

    // Assign to first seller with 30-min timeout
    const selectedSeller = nearbyResult.sellers[0];
    const acceptanceDeadline = new Date(Date.now() + ORDER_ACCEPTANCE_TIMEOUT_MINUTES * 60 * 1000);

    order.seller = selectedSeller._id;
    order.assignmentStatus = 'pending_acceptance';
    order.assignmentDeadline = acceptanceDeadline;
    order.assignedAt = new Date();
    order.assignmentDistance = selectedSeller.distance;
    
    await order.save();

    // Send notification to seller
    await notify(selectedSeller.email, 'New Order Assignment', 
      `You have a new order assignment. Please accept within 30 minutes. Order: ${order.orderNumber}`);

    // Set timeout to move to next seller if not accepted
    setTimeout(async () => {
      await checkOrderAcceptance(orderId);
    }, ORDER_ACCEPTANCE_TIMEOUT_MINUTES * 60 * 1000);

    return {
      success: true,
      message: 'Order assigned to nearest seller',
      seller: selectedSeller,
      deadline: acceptanceDeadline
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
 * Check if order was accepted, if not move to next seller
 */
const checkOrderAcceptance = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    
    if (!order || order.assignmentStatus !== 'pending_acceptance') {
      return;
    }

    // Order not accepted - move to next seller
    const customerLat = order.shippingAddress?.coordinates?.[1];
    const customerLon = order.shippingAddress?.coordinates?.[0];

    if (!customerLat || !customerLon) {
      order.assignmentStatus = 'admin_required';
      await order.save();
      return;
    }

    const nearbyResult = await findNearbySellers(customerLat, customerLon);
    
    if (!nearbyResult.success || nearbyResult.count === 0) {
      order.assignmentStatus = 'admin_required';
      order.assignmentNotes = 'No sellers available after timeout';
      await order.save();
      return;
    }

    // Find next seller (exclude current one)
    const currentSellerId = order.seller.toString();
    const nextSeller = nearbyResult.sellers.find(s => s._id.toString() !== currentSellerId);

    if (!nextSeller) {
      order.assignmentStatus = 'admin_required';
      order.assignmentNotes = 'All nearby sellers declined or timed out';
      await order.save();
      return;
    }

    // Assign to next seller
    const acceptanceDeadline = new Date(Date.now() + ORDER_ACCEPTANCE_TIMEOUT_MINUTES * 60 * 1000);
    order.seller = nextSeller._id;
    order.assignmentDeadline = acceptanceDeadline;
    order.assignedAt = new Date();
    order.assignmentDistance = nextSeller.distance;
    
    await order.save();

    // Notify next seller
    await notify(nextSeller.email, 'New Order Assignment', 
      `You have a new order assignment. Please accept within 30 minutes. Order: ${order.orderNumber}`);

    // Set timeout again
    setTimeout(async () => {
      await checkOrderAcceptance(orderId);
    }, ORDER_ACCEPTANCE_TIMEOUT_MINUTES * 60 * 1000);

  } catch (error) {
    console.error('Error checking order acceptance:', error);
  }
};

/**
 * Accept order by seller
 */
export const acceptOrder = async (orderId, sellerId) => {
  try {
    const order = await Order.findById(orderId);
    
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.seller.toString() !== sellerId) {
      return { success: false, error: 'Order not assigned to this seller' };
    }

    if (order.assignmentStatus !== 'pending_acceptance') {
      return { success: false, error: 'Order not in pending acceptance state' };
    }

    order.assignmentStatus = 'accepted';
    order.acceptedAt = new Date();
    order.orderStatus = 'confirmed';
    
    await order.save();

    return {
      success: true,
      message: 'Order accepted successfully',
      order
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
 * Reject order by seller
 */
export const rejectOrder = async (orderId, sellerId, reason) => {
  try {
    const order = await Order.findById(orderId);
    
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.seller.toString() !== sellerId) {
      return { success: false, error: 'Order not assigned to this seller' };
    }

    // Move to next seller
    const customerLat = order.shippingAddress?.coordinates?.[1];
    const customerLon = order.shippingAddress?.coordinates?.[0];

    if (!customerLat || !customerLon) {
      order.assignmentStatus = 'admin_required';
      await order.save();
      return { success: true, message: 'Order marked for admin assignment' };
    }

    const nearbyResult = await findNearbySellers(customerLat, customerLon);
    
    if (!nearbyResult.success || nearbyResult.count === 0) {
      order.assignmentStatus = 'admin_required';
      order.assignmentNotes = 'No sellers available after rejection';
      await order.save();
      return { success: true, message: 'Order marked for admin assignment' };
    }

    // Find next seller
    const currentSellerId = order.seller.toString();
    const nextSeller = nearbyResult.sellers.find(s => s._id.toString() !== currentSellerId);

    if (!nextSeller) {
      order.assignmentStatus = 'admin_required';
      order.assignmentNotes = 'All nearby sellers declined';
      await order.save();
      return { success: true, message: 'Order marked for admin assignment' };
    }

    // Assign to next seller
    const acceptanceDeadline = new Date(Date.now() + ORDER_ACCEPTANCE_TIMEOUT_MINUTES * 60 * 1000);
    order.seller = nextSeller._id;
    order.assignmentStatus = 'pending_acceptance';
    order.assignmentDeadline = acceptanceDeadline;
    order.assignedAt = new Date();
    order.assignmentDistance = nextSeller.distance;
    
    await order.save();

    // Notify next seller
    await notify(nextSeller.email, 'New Order Assignment', 
      `You have a new order assignment. Please accept within 30 minutes. Order: ${order.orderNumber}`);

    return {
      success: true,
      message: 'Order rejected and moved to next seller',
      nextSeller
    };
  } catch (error) {
    console.error('Error rejecting order:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  findNearbySellers,
  assignOrderToNearestSeller,
  acceptOrder,
  rejectOrder
};
