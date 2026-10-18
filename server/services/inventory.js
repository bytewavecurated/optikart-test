import StockReservation from '../models/StockReservation.js';
import Product from '../models/Product.js';
import { sendLowStockAlert } from './email.js';
import Seller from '../models/Seller.js';
import { checkStockLevels } from './websocket.js';

const RESERVATION_DURATION_MINUTES = 15; // 15 minutes reservation time

/**
 * Reserve stock for a product
 */
export const reserveStock = async (productId, userId, quantity) => {
  try {
    const product = await Product.findById(productId);
    
    if (!product) {
      throw new Error('Product not found');
    }

    // Check available stock (total stock - reserved stock)
    const reservedStock = await getReservedStock(productId);
    const availableStock = product.stock - reservedStock;

    if (availableStock < quantity) {
      throw new Error(`Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`);
    }

    // Create reservation
    const expiresAt = new Date(Date.now() + RESERVATION_DURATION_MINUTES * 60 * 1000);
    
    const reservation = await StockReservation.create({
      product: productId,
      user: userId,
      quantity,
      expiresAt
    });

    return {
      success: true,
      reservation,
      availableStock: availableStock - quantity
    };
  } catch (error) {
    console.error('Error reserving stock:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get total reserved stock for a product
 */
export const getReservedStock = async (productId) => {
  const reservations = await StockReservation.find({
    product: productId,
    status: 'active',
    expiresAt: { $gt: new Date() }
  });

  return reservations.reduce((total, res) => total + res.quantity, 0);
};

/**
 * Complete a reservation (convert to order)
 */
export const completeReservation = async (reservationId, orderId, io = null) => {
  try {
    const reservation = await StockReservation.findById(reservationId);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    // Update reservation status
    reservation.status = 'completed';
    reservation.orderId = orderId;
    await reservation.save();

    // Get product before stock change
    const productBefore = await Product.findById(reservation.product);
    const previousStock = productBefore.stock;

    // Deduct stock from product
    await Product.findByIdAndUpdate(reservation.product, {
      $inc: { stock: -reservation.quantity }
    });

    // Check if stock is now low and send alert
    const product = await Product.findById(reservation.product);
    if (product.stock <= 10 && product.stock > 0) {
      const seller = await Seller.findById(product.seller);
      if (seller) {
        await sendLowStockAlert(seller.email, product, seller);
      }
    }

    // Emit WebSocket alert if io is provided
    if (io) {
      await checkStockLevels(io, product, previousStock);
    }

    return {
      success: true,
      reservation
    };
  } catch (error) {
    console.error('Error completing reservation:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Cancel a reservation
 */
export const cancelReservation = async (reservationId) => {
  try {
    const reservation = await StockReservation.findById(reservationId);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    reservation.status = 'cancelled';
    await reservation.save();

    return {
      success: true,
      reservation
    };
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get user's active reservations
 */
export const getUserReservations = async (userId) => {
  try {
    const reservations = await StockReservation.find({
      user: userId,
      status: 'active',
      expiresAt: { $gt: new Date() }
    }).populate('product');

    return {
      success: true,
      reservations
    };
  } catch (error) {
    console.error('Error getting user reservations:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Bulk update stock for multiple products
 */
export const bulkUpdateStock = async (updates, io = null) => {
  try {
    const results = [];
    
    for (const update of updates) {
      const { productId, newStock } = update;
      
      // Get product before stock change
      const productBefore = await Product.findById(productId);
      const previousStock = productBefore ? productBefore.stock : 0;
      
      const product = await Product.findByIdAndUpdate(
        productId,
        { stock: newStock },
        { new: true }
      );

      if (product) {
        results.push({
          productId,
          success: true,
          newStock: product.stock
        });

        // Check if stock is low and send alert
        if (product.stock <= 10 && product.stock > 0) {
          const seller = await Seller.findById(product.seller);
          if (seller) {
            await sendLowStockAlert(seller.email, product, seller);
          }
        }

        // Emit WebSocket alert if io is provided
        if (io) {
          await checkStockLevels(io, product, previousStock);
        }
      } else {
        results.push({
          productId,
          success: false,
          error: 'Product not found'
        });
      }
    }

    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('Error in bulk stock update:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check product availability
 */
export const checkAvailability = async (productId, quantity = 1) => {
  try {
    const product = await Product.findById(productId);
    
    if (!product) {
      return {
        available: false,
        message: 'Product not found'
      };
    }

    if (!product.isActive) {
      return {
        available: false,
        message: 'Product is not active'
      };
    }

    const reservedStock = await getReservedStock(productId);
    const availableStock = product.stock - reservedStock;

    if (availableStock < quantity) {
      return {
        available: false,
        message: `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`,
        availableStock
      };
    }

    return {
      available: true,
      availableStock,
      product
    };
  } catch (error) {
    console.error('Error checking availability:', error);
    return {
      available: false,
      message: error.message
    };
  }
};

/**
 * Hide out-of-stock products from listings
 */
export const getAvailableProducts = async (query = {}, options = {}) => {
  const { page = 1, limit = 20, sort = '-createdAt' } = options;
  
  // Only show active products with stock > 0
  const filter = {
    ...query,
    isActive: true,
    stock: { $gt: 0 }
  };

  const products = await Product.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('seller', 'storeName rating');

  const total = await Product.countDocuments(filter);

  return {
    products,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page
  };
};

export default {
  reserveStock,
  getReservedStock,
  completeReservation,
  cancelReservation,
  getUserReservations,
  bulkUpdateStock,
  checkAvailability,
  getAvailableProducts
};
