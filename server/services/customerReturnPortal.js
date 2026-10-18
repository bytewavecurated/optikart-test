/**
 * Customer Return Portal Service
 * Self-service return requests with photo upload and return period validation
 */

import Order from '../models/Order.js';
import ReturnRequest from '../models/ReturnRequest.js';
import Product from '../models/Product.js';
import { sendReturnConfirmation } from './email.js';
import fs from 'fs';
import path from 'path';

const RETURN_WINDOW_DAYS = 7; // 7-day return window

/**
 * Check if order is eligible for return
 */
export const checkReturnEligibility = async (orderId, userId) => {
  try {
    const order = await Order.findById(orderId).populate('items.product');
    
    if (!order) {
      return {
        success: false,
        message: 'Order not found'
      };
    }

    // Verify ownership
    if (order.user.toString() !== userId) {
      return {
        success: false,
        message: 'Unauthorized to return this order'
      };
    }

    // Check if order is delivered
    if (order.orderStatus !== 'delivered') {
      return {
        success: false,
        message: 'Order must be delivered to initiate return',
        eligible: false
      };
    }

    // Check return window
    const deliveredDate = new Date(order.deliveredAt || order.updatedAt);
    const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceDelivery > RETURN_WINDOW_DAYS) {
      return {
        success: false,
        message: `Return window has expired (${RETURN_WINDOW_DAYS} days from delivery)`,
        eligible: false,
        daysSinceDelivery,
        returnWindowDays: RETURN_WINDOW_DAYS
      };
    }

    // Check if return already requested
    const existingReturn = await ReturnRequest.findOne({
      order: orderId,
      status: { $nin: ['rejected', 'cancelled'] }
    });

    if (existingReturn) {
      return {
        success: false,
        message: 'Return already requested for this order',
        eligible: false,
        existingReturn
      };
    }

    return {
      success: true,
      eligible: true,
      order,
      daysSinceDelivery,
      returnWindowDays: RETURN_WINDOW_DAYS,
      daysRemaining: RETURN_WINDOW_DAYS - daysSinceDelivery,
      items: order.items.map(item => ({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        variant: item.variant
      }))
    };
  } catch (error) {
    console.error('Error checking return eligibility:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Create return request with photo upload
 */
export const createCustomerReturnRequest = async (orderId, userId, items, reason, description, images = []) => {
  try {
    // Check eligibility first
    const eligibility = await checkReturnEligibility(orderId, userId);
    
    if (!eligibility.success || !eligibility.eligible) {
      return {
        success: false,
        message: eligibility.message
      };
    }

    const order = eligibility.order;

    // Validate items
    let refundAmount = 0;
    const returnItems = [];

    for (const item of items) {
      const orderItem = order.items.find(i => i.product._id.toString() === item.productId);
      
      if (!orderItem) {
        return {
          success: false,
          message: `Product ${item.productId} not found in order`
        };
      }

      if (item.quantity > orderItem.quantity) {
        return {
          success: false,
          message: `Return quantity exceeds ordered quantity for product ${item.productId}`
        };
      }

      const itemRefund = orderItem.price * item.quantity;
      refundAmount += itemRefund;

      returnItems.push({
        product: item.productId,
        quantity: item.quantity,
        reason: reason || item.reason || 'Customer request',
        description: description || item.description || '',
        images: item.images || []
      });
    }

    // Create return request
    const returnRequest = await ReturnRequest.create({
      order: orderId,
      user: userId,
      seller: order.seller,
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
      status: returnRequest.status,
      refundAmount
    });

    return {
      success: true,
      returnRequest,
      message: 'Return request created successfully'
    };
  } catch (error) {
    console.error('Error creating return request:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Upload return images
 */
export const uploadReturnImages = async (files, returnId) => {
  try {
    if (!files || files.length === 0) {
      return {
        success: false,
        message: 'No files uploaded'
      };
    }

    const returnRequest = await ReturnRequest.findById(returnId);
    if (!returnRequest) {
      return {
        success: false,
        message: 'Return request not found'
      };
    }

    const imageUrls = [];
    const uploadDir = path.join(process.cwd(), 'uploads', 'returns');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    for (const file of files) {
      const filename = `${returnId}_${Date.now()}_${file.originalname}`;
      const filepath = path.join(uploadDir, filename);
      
      // Move file to uploads directory
      fs.writeFileSync(filepath, file.buffer);
      
      const imageUrl = `/uploads/returns/${filename}`;
      imageUrls.push(imageUrl);
    }

    // Update return request with image URLs
    returnRequest.items.forEach(item => {
      if (!item.images) item.images = [];
      item.images.push(...imageUrls);
    });
    
    await returnRequest.save();

    return {
      success: true,
      imageUrls,
      message: 'Images uploaded successfully'
    };
  } catch (error) {
    console.error('Error uploading return images:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Get user's return requests
 */
export const getUserReturnRequests = async (userId, status = null) => {
  try {
    const query = { user: userId };
    if (status) {
      query.status = status;
    }

    const returns = await ReturnRequest.find(query)
      .populate('order')
      .populate('items.product', 'title brand images price')
      .sort({ createdAt: -1 });

    return {
      success: true,
      returns
    };
  } catch (error) {
    console.error('Error getting user return requests:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Cancel return request (only if not yet approved)
 */
export const cancelReturnRequest = async (returnId, userId) => {
  try {
    const returnRequest = await ReturnRequest.findById(returnId);
    
    if (!returnRequest) {
      return {
        success: false,
        message: 'Return request not found'
      };
    }

    if (returnRequest.user.toString() !== userId) {
      return {
        success: false,
        message: 'Unauthorized to cancel this return'
      };
    }

    if (returnRequest.status !== 'requested') {
      return {
        success: false,
        message: 'Can only cancel return requests that are still pending approval'
      };
    }

    returnRequest.status = 'cancelled';
    await returnRequest.save();

    return {
      success: true,
      message: 'Return request cancelled successfully'
    };
  } catch (error) {
    console.error('Error cancelling return request:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

export default {
  checkReturnEligibility,
  createCustomerReturnRequest,
  uploadReturnImages,
  getUserReturnRequests,
  cancelReturnRequest
};
