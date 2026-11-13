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

// Used only where a product has not stated its own window.
const DEFAULT_WINDOW_DAYS = 7;

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

    const deliveredDate = new Date(order.deliveredAt || order.updatedAt);
    const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));

    /*
     * Each line carries its own window. The platform default of 7 days applies
     * only when a product has not stated one; a seller can tighten it (sale
     * items, clearance) or a manufacturer can set a longer window per product.
     * An order is returnable while at least one line is still inside its window.
     */
    const DEFAULT_WINDOW_DAYS = 7;
    const windowFor = (product) => {
      const p = product || {};
      const raw = p.returnWindowDays;
      if (raw === undefined || raw === null || raw === '') return DEFAULT_WINDOW_DAYS;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? n : DEFAULT_WINDOW_DAYS;
    };

    const lineWindows = (order.items || []).map((item) => {
      const days = windowFor(item.product);
      return {
        product: item.product?._id,
        name: item.product?.title || item.name,
        returnWindowDays: days,
        returnable: item.product?.isReturnable !== false,
        exchangeable: item.product?.isExchangeable !== false,
        withinWindow: days > 0 ? daysSinceDelivery <= days : false
      };
    });

    const openLines = lineWindows.filter((l) => l.returnable && l.withinWindow);
    if (lineWindows.length && openLines.length === 0) {
      const widest = Math.max(...lineWindows.map((l) => l.returnWindowDays));
      return {
        success: false,
        eligible: false,
        daysSinceDelivery,
        returnWindowDays: widest,
        lineWindows,
        message: daysSinceDelivery > widest
          ? `The return window has closed for every item in this order (shortest was ${Math.min(...lineWindows.map((l) => l.returnWindowDays))} day(s), longest ${widest} day(s); ${daysSinceDelivery} day(s) since delivery).`
          : 'None of the items in this order can be returned.'
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

    // Check if any items are returnable
    // Only lines still inside their own window and allowed by the seller are offered.
    const selectable = lineWindows.filter((l) => l.returnable && l.withinWindow);

    return {
      success: true,
      eligible: true,
      order,
      daysSinceDelivery,
      // Longest window present on the order, plus the per-line detail so the
      // customer sees which item is expiring when.
      returnWindowDays: Math.max(...lineWindows.map((l) => l.returnWindowDays)),
      daysRemaining: Math.max(...lineWindows.filter((l) => l.returnable).map((l) => l.returnWindowDays - daysSinceDelivery)),
      lineWindows,
      items: selectable.map((line) => {
        const source = (order.items || []).find((i) => String(i.product?._id || i.product) === String(line.product)) || {};
        return {
          product: source.product,
          quantity: source.quantity,
          price: source.price,
          variant: source.variant,
          isReturnable: true,
          isExchangeable: line.exchangeable,
          returnWindowDays: line.returnWindowDays,
          daysRemaining: line.returnWindowDays - daysSinceDelivery
        };
      })
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
export const createCustomerReturnRequest = async (orderId, userId, items, reason, description, images = [], type = 'return') => {
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

      // Check if product is returnable at all (the seller's listing toggle).
      if (orderItem.product.isReturnable === false) {
        return {
          success: false,
          message: `Product "${orderItem.product.title}" is not eligible for return`
        };
      }

      // Re-apply the per-product window here as well. Eligibility is only a
      // preview; a client can post a request directly, and an exchange request
      // must respect the same rule.
      const lineWindow = Number.isFinite(Number(orderItem.product.returnWindowDays))
        ? Number(orderItem.product.returnWindowDays)
        : DEFAULT_WINDOW_DAYS;
      const delivered = new Date(order.deliveredAt || order.updatedAt);
      const daysSince = Math.floor((Date.now() - delivered.getTime()) / (1000 * 60 * 60 * 24));
      const wantsExchange = type === 'exchange';
      if (wantsExchange && orderItem.product.isExchangeable === false) {
        return { success: false, message: `Product "${orderItem.product.title}" cannot be exchanged` };
      }
      if (daysSince > lineWindow) {
        return {
          success: false,
          message: `The return window for "${orderItem.product.title}" closed after ${lineWindow} day(s); ${daysSince} day(s) have passed since delivery`
        };
      }
      if (lineWindow === 0) {
        return { success: false, message: `"${orderItem.product.title}" is final sale and cannot be returned` };
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
        images: item.images || images || []
      });
    }

    /*
     * What the customer is owed, spelled out.
     *
     * Refunds are priced from the returned lines, so platform fees, delivery and
     * the cash-on-delivery handling charge are never in this number - which was
     * true before and after this change, but invisible. A customer who paid ₹39
     * for COD handling and sees a refund ₹39 short of their order total is not
     * being overcharged, they are seeing a charge that was spent on the cash leg
     * of the delivery. Saying so is the difference between a policy and a
     * dispute, and it costs one line here.
     */
    const chargedTotal = Number(order.totalAmount) || 0;
    const codFeeHeld = order.paymentMethod === 'cod' ? (Number(order.codFee) || 0) : 0;

    // Create return request
    const returnRequest = await ReturnRequest.create({
      order: orderId,
      user: userId,
      seller: order.seller,
      items: returnItems,
      refundAmount,
      // Kept on the request so the customer-facing message and the admin's
      // ledger quote the same figure rather than recomputing it differently.
      nonRefundableCodFee: codFeeHeld,
      orderChargedTotal: chargedTotal,
      requestType: type,
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
