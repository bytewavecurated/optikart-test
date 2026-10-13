import ReturnRequest from '../models/ReturnRequest.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { sendReturnConfirmation } from './email.js';
import { processRefund } from './razorpay.js';
import { createReturnPickup } from './shiprocket.js';

/**
 * Create a return request
 */
export const createReturnRequest = async (orderId, userId, items, reason) => {
  try {
    const order = await Order.findById(orderId).populate('seller');
    
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.user.toString() !== userId) {
      throw new Error('Unauthorized to return this order');
    }

    // Check if order is delivered and within return window (7 days)
    if (order.status !== 'delivered') {
      throw new Error('Order must be delivered to initiate return');
    }

    const deliveredDate = new Date(order.deliveredAt || order.updatedAt);
    const daysSinceDelivery = (Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceDelivery > 7) {
      throw new Error('Return window has expired (7 days from delivery)');
    }

    // Calculate refund amount
    let refundAmount = 0;
    const returnItems = [];

    for (const item of items) {
      const orderItem = order.items.find(i => i.product.toString() === item.productId);
      
      if (!orderItem) {
        throw new Error(`Product ${item.productId} not found in order`);
      }

      if (item.quantity > orderItem.quantity) {
        throw new Error(`Return quantity exceeds ordered quantity for product ${item.productId}`);
      }

      const itemRefund = orderItem.price * item.quantity;
      refundAmount += itemRefund;

      returnItems.push({
        product: item.productId,
        quantity: item.quantity,
        reason: reason || item.reason || 'Customer request',
        description: item.description || '',
        images: item.images || []
      });
    }

    // Create return request
    const returnRequest = await ReturnRequest.create({
      order: orderId,
      user: userId,
      seller: order.seller._id,
      items: returnItems,
      refundAmount,
      status: 'requested'
    });

    // Send confirmation email
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(userId);
    
    await sendReturnConfirmation(user.email, {
      returnId: returnRequest.returnId,
      orderNumber: order.orderNumber,
      reason: reason || 'Customer request',
      status: returnRequest.status
    });

    return {
      success: true,
      returnRequest
    };
  } catch (error) {
    console.error('Error creating return request:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Approve a return request
 */
export const approveReturnRequest = async (returnId, adminNotes = '') => {
  try {
    const returnRequest = await ReturnRequest.findById(returnId)
      .populate('order')
      .populate('user');

    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    if (returnRequest.status !== 'requested') {
      throw new Error('Return request is not in requested status');
    }

    returnRequest.status = 'approved';
    returnRequest.approvedAt = new Date();
    returnRequest.adminNotes = adminNotes;
    await returnRequest.save();

    // Generate return shipping label
    const shippingLabel = await generateReturnShippingLabel(returnRequest);
    
    if (shippingLabel.success) {
      returnRequest.returnShippingLabel = shippingLabel.label;
      await returnRequest.save();
    }

    // Send approval email to customer
    // (Email sending logic here)

    return {
      success: true,
      returnRequest,
      shippingLabel: shippingLabel.label
    };
  } catch (error) {
    console.error('Error approving return request:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Reject a return request
 */
export const rejectReturnRequest = async (returnId, reason) => {
  try {
    const returnRequest = await ReturnRequest.findById(returnId);

    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    if (returnRequest.status !== 'requested') {
      throw new Error('Return request is not in requested status');
    }

    returnRequest.status = 'rejected';
    returnRequest.rejectedAt = new Date();
    returnRequest.rejectionReason = reason;
    await returnRequest.save();

    // Send rejection email to customer
    // (Email sending logic here)

    return {
      success: true,
      returnRequest
    };
  } catch (error) {
    console.error('Error rejecting return request:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generate return shipping label
 */
export const generateReturnShippingLabel = async (returnRequest) => {
  try {
    await returnRequest.populate('order');
    await returnRequest.populate('user');

    const order = returnRequest.order;
    const user = returnRequest.user;

    // Create return pickup via Shiprocket
    const pickupResult = await createReturnPickup({
      orderId: order.orderNumber,
      returnId: returnRequest.returnId,
      pickupAddress: {
        name: user.name,
        phone: user.phone,
        email: user.email,
        address: order.shippingAddress.address,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        pincode: order.shippingAddress.pincode
      },
      weight: 0.5 // Default weight for eyewear
    });

    if (pickupResult.success) {
      return {
        success: true,
        label: {
          labelUrl: pickupResult.labelUrl,
          trackingNumber: pickupResult.awbCode,
          courier: pickupResult.courierName
        }
      };
    } else {
      throw new Error('Failed to generate shipping label');
    }
  } catch (error) {
    console.error('Error generating return shipping label:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update return status to picked up
 */
export const markAsPickedUp = async (returnId) => {
  try {
    const returnRequest = await ReturnRequest.findById(returnId);

    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    returnRequest.status = 'picked_up';
    returnRequest.pickedUpAt = new Date();
    await returnRequest.save();

    return {
      success: true,
      returnRequest
    };
  } catch (error) {
    console.error('Error marking return as picked up:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update return status to received
 */
export const markAsReceived = async (returnId) => {
  try {
    const returnRequest = await ReturnRequest.findById(returnId);

    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    returnRequest.status = 'received';
    returnRequest.receivedAt = new Date();
    await returnRequest.save();

    return {
      success: true,
      returnRequest
    };
  } catch (error) {
    console.error('Error marking return as received:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Process refund for a return
 */
export const processReturnRefund = async (returnId) => {
  try {
    const returnRequest = await ReturnRequest.findById(returnId)
      .populate('order');

    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    if (returnRequest.status !== 'received') {
      throw new Error('Return must be received before processing refund');
    }

    const order = returnRequest.order;

    // Process refund via Razorpay
    const refundResult = await processRefund({
      paymentId: order.paymentId,
      amount: returnRequest.refundAmount * 100, // Convert to paise
      speed: 'optimum',
      notes: {
        returnId: returnRequest.returnId,
        orderId: order.orderNumber
      }
    });

    if (refundResult.success) {
      returnRequest.status = 'completed';
      returnRequest.refundStatus = 'completed';
      returnRequest.razorpayRefundId = refundResult.refundId;
      returnRequest.completedAt = new Date();
      await returnRequest.save();

      // Restore stock
      for (const item of returnRequest.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity }
        });
      }

      return {
        success: true,
        returnRequest,
        refundId: refundResult.refundId
      };
    } else {
      returnRequest.refundStatus = 'failed';
      await returnRequest.save();
      
      throw new Error('Refund processing failed');
    }
  } catch (error) {
    console.error('Error processing return refund:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get user's return requests
 */
export const getUserReturns = async (userId) => {
  try {
    const returns = await ReturnRequest.find({ user: userId })
      .populate('order')
      .populate('items.product')
      .sort({ createdAt: -1 });

    return {
      success: true,
      returns
    };
  } catch (error) {
    console.error('Error getting user returns:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get seller's return requests
 */
export const getSellerReturns = async (sellerId) => {
  try {
    const returns = await ReturnRequest.find({ seller: sellerId })
      .populate('order')
      .populate('user', 'name email')
      .populate('items.product')
      .sort({ createdAt: -1 });

    return {
      success: true,
      returns
    };
  } catch (error) {
    console.error('Error getting seller returns:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get all return requests (admin)
 */
export const getAllReturns = async (filters = {}) => {
  try {
    const returns = await ReturnRequest.find(filters)
      .populate('order')
      .populate('user', 'name email')
      .populate('seller', 'storeName')
      .populate('items.product')
      .sort({ createdAt: -1 });

    return {
      success: true,
      returns
    };
  } catch (error) {
    console.error('Error getting all returns:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  createReturnRequest,
  approveReturnRequest,
  rejectReturnRequest,
  generateReturnShippingLabel,
  markAsPickedUp,
  markAsReceived,
  processReturnRefund,
  getUserReturns,
  getSellerReturns,
  getAllReturns
};
