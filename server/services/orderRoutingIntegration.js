import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Seller from '../models/Seller.js';
import { findNearbySellers } from './proximityOrderRouting.js';
import { sendEmail } from './email.js';

/**
 * Integrate proximity-based routing into order creation
 */
export const integrateOrderRouting = async (order) => {
  try {
    // Get customer location from shipping address
    const customerLat = order.shippingAddress?.coordinates?.[1];
    const customerLon = order.shippingAddress?.coordinates?.[0];

    if (!customerLat || !customerLon) {
      // If no coordinates, use default assignment or admin assignment
      order.assignmentStatus = 'admin_required';
      order.assignmentNotes = 'Customer location not available. Manual assignment required.';
      await order.save();
      return {
        success: false,
        message: 'Customer location not available',
        requiresAdminAssignment: true
      };
    }

    // Find nearby sellers
    const nearbyResult = await findNearbySellers(customerLat, customerLon, 10);

    if (!nearbyResult.success || nearbyResult.count === 0) {
      // No sellers found
      order.assignmentStatus = 'admin_required';
      order.assignmentNotes = 'No sellers found within 10km radius';
      await order.save();

      // Notify admin
      await notifyAdminNoSellers(order);

      return {
        success: false,
        message: 'No sellers found nearby',
        requiresAdminAssignment: true
      };
    }

    // Assign to first seller with 30-minute timer
    const selectedSeller = nearbyResult.sellers[0];
    const acceptanceDeadline = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    order.seller = selectedSeller._id;
    order.assignmentStatus = 'pending_acceptance';
    order.assignmentDeadline = acceptanceDeadline;
    order.assignedAt = new Date();
    order.assignmentDistance = selectedSeller.distance;

    await order.save();

    // Notify seller
    await notifySellerNewOrder(order, selectedSeller);

    // Set timeout to check acceptance
    setTimeout(async () => {
      await checkOrderAcceptanceTimeout(order._id);
    }, 30 * 60 * 1000);

    return {
      success: true,
      message: 'Order assigned to nearest seller',
      seller: selectedSeller,
      deadline: acceptanceDeadline
    };
  } catch (error) {
    console.error('Error integrating order routing:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Notify seller about new order assignment
 */
const notifySellerNewOrder = async (order, seller) => {
  try {
    const emailContent = `
      <h2>New Order Assignment</h2>
      <p>You have been assigned a new order. Please accept or reject within 30 minutes.</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Customer:</strong> ${order.user?.name || 'Customer'}</p>
        <p><strong>Delivery Address:</strong> ${order.shippingAddress?.city}, ${order.shippingAddress?.state}</p>
        <p><strong>Distance:</strong> ${order.assignmentDistance} km</p>
        <p><strong>Deadline:</strong> ${new Date(order.assignmentDeadline).toLocaleString()}</p>
        <p><strong>Items:</strong></p>
        <ul>
          ${order.items.map(item => `<li>${item.product?.title} x ${item.quantity}</li>`).join('')}
        </ul>
        <p><strong>Total Amount:</strong> ₹${order.totalAmount}</p>
      </div>
      <p>Please login to your seller dashboard to accept or reject this order.</p>
    `;

    await sendEmail(seller.email, `New Order Assignment - ${order.orderNumber}`, emailContent);
  } catch (error) {
    console.error('Error notifying seller:', error);
  }
};

/**
 * Notify admin when no sellers are found
 */
const notifyAdminNoSellers = async (order) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@optikart.com';
    
    const emailContent = `
      <h2>Order Requires Manual Assignment</h2>
      <p>No sellers were found within 10km of the customer's location. Manual assignment is required.</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Customer:</strong> ${order.user?.name || 'Customer'}</p>
        <p><strong>Delivery Address:</strong> ${order.shippingAddress?.city}, ${order.shippingAddress?.state}</p>
        <p><strong>Items:</strong></p>
        <ul>
          ${order.items.map(item => `<li>${item.product?.title} x ${item.quantity}</li>`).join('')}
        </ul>
        <p><strong>Total Amount:</strong> ₹${order.totalAmount}</p>
      </div>
      <p>Please login to the admin dashboard to manually assign this order to a seller.</p>
    `;

    await sendEmail(adminEmail, `Order Requires Manual Assignment - ${order.orderNumber}`, emailContent);
  } catch (error) {
    console.error('Error notifying admin:', error);
  }
};

/**
 * Check if order acceptance timed out
 */
const checkOrderAcceptanceTimeout = async (orderId) => {
  try {
    const order = await Order.findById(orderId).populate('user');

    if (!order || order.assignmentStatus !== 'pending_acceptance') {
      return;
    }

    // Order not accepted - move to next seller
    const customerLat = order.shippingAddress?.coordinates?.[1];
    const customerLon = order.shippingAddress?.coordinates?.[0];

    if (!customerLat || !customerLon) {
      order.assignmentStatus = 'admin_required';
      order.assignmentNotes = 'Customer location not available';
      await order.save();
      return;
    }

    const nearbyResult = await findNearbySellers(customerLat, customerLon, 10);

    if (!nearbyResult.success || nearbyResult.count === 0) {
      order.assignmentStatus = 'admin_required';
      order.assignmentNotes = 'No sellers available after timeout';
      await order.save();
      await notifyAdminNoSellers(order);
      return;
    }

    // Find next seller (exclude current one)
    const currentSellerId = order.seller.toString();
    const nextSeller = nearbyResult.sellers.find(s => s._id.toString() !== currentSellerId);

    if (!nextSeller) {
      order.assignmentStatus = 'admin_required';
      order.assignmentNotes = 'All nearby sellers declined or timed out';
      await order.save();
      await notifyAdminNoSellers(order);
      return;
    }

    // Assign to next seller
    const acceptanceDeadline = new Date(Date.now() + 30 * 60 * 1000);
    order.seller = nextSeller._id;
    order.assignmentStatus = 'pending_acceptance';
    order.assignmentDeadline = acceptanceDeadline;
    order.assignedAt = new Date();
    order.assignmentDistance = nextSeller.distance;

    await order.save();

    // Notify next seller
    await notifySellerNewOrder(order, nextSeller);

    // Set timeout again
    setTimeout(async () => {
      await checkOrderAcceptanceTimeout(orderId);
    }, 30 * 60 * 1000);
  } catch (error) {
    console.error('Error checking order acceptance timeout:', error);
  }
};

/**
 * AI fallback for automatic assignment
 */
export const aiFallbackAssignment = async (order) => {
  try {
    // Simple AI logic: prioritize sellers with:
    // 1. Higher rating
    // 2. More completed orders
    // 3. Lower current workload
    
    const customerLat = order.shippingAddress?.coordinates?.[1];
    const customerLon = order.shippingAddress?.coordinates?.[0];

    if (!customerLat || !customerLon) {
      return { success: false, message: 'Customer location not available' };
    }

    // Get all active sellers within 20km (expanded radius for AI fallback)
    const nearbyResult = await findNearbySellers(customerLat, customerLon, 20);

    if (!nearbyResult.success || nearbyResult.count === 0) {
      return { success: false, message: 'No sellers available' };
    }

    // Pending workload per candidate seller (assigned but not finished yet).
    const candidateIds = nearbyResult.sellers.map((x) => String(x._id));
    const workloadRows = await Order.aggregate([
      {
        $match: {
          seller: { $in: candidateIds.map((id) => new mongoose.Types.ObjectId(id)) },
          orderStatus: { $nin: ['delivered', 'cancelled', 'returned'] }
        }
      },
      { $group: { _id: '$seller', count: { $sum: 1 } } }
    ]);
    const workloadBySeller = new Map(workloadRows.map((r) => [String(r._id), r.count]));

    // Score each seller
    const scoredSellers = nearbyResult.sellers.map(seller => {
      let score = 100; // Base score
      
      // Distance penalty (closer is better)
      score -= seller.distance * 2;
      
      // Rating bonus
      score += (seller.rating || 0) * 10;
      
      // Experience bonus (more orders = more experienced)
      score += Math.min((seller.totalSales || 0) / 100, 20);
      
      // Workload penalty: fewer open orders is better.
      const openOrders = workloadBySeller.get(String(seller._id)) || 0;
      score -= openOrders * 5;

      return { ...seller, score, openOrders };
    });

    // Sort by score descending
    scoredSellers.sort((a, b) => b.score - a.score);

    // Assign to top seller
    const bestSeller = scoredSellers[0];
    const acceptanceDeadline = new Date(Date.now() + 30 * 60 * 1000);

    order.seller = bestSeller._id;
    order.assignmentStatus = 'pending_acceptance';
    order.assignmentDeadline = acceptanceDeadline;
    order.assignedAt = new Date();
    order.assignmentDistance = bestSeller.distance;
    order.assignmentNotes = `AI-assigned (Score: ${bestSeller.score.toFixed(2)})`;

    await order.save();

    // Notify seller
    await notifySellerNewOrder(order, bestSeller);

    // Set timeout
    setTimeout(async () => {
      await checkOrderAcceptanceTimeout(order._id);
    }, 30 * 60 * 1000);

    return {
      success: true,
      message: 'Order assigned by AI fallback',
      seller: bestSeller,
      score: bestSeller.score
    };
  } catch (error) {
    console.error('Error in AI fallback assignment:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  integrateOrderRouting,
  aiFallbackAssignment
};
