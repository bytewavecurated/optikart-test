/**
 * WebSocket Service for Real-time Inventory Alerts
 * Sends notifications when stock falls below threshold
 */

const LOW_STOCK_THRESHOLD = 10;
const OUT_OF_STOCK_THRESHOLD = 0;

/**
 * Emit inventory alert to seller via WebSocket
 */
export const emitInventoryAlert = (io, sellerId, product, alertType) => {
  if (!io) return;

  const alert = {
    type: 'inventory_alert',
    alertType, // 'low_stock' or 'out_of_stock'
    productId: product._id,
    productName: product.title,
    currentStock: product.stock,
    threshold: alertType === 'out_of_stock' ? OUT_OF_STOCK_THRESHOLD : LOW_STOCK_THRESHOLD,
    timestamp: new Date().toISOString(),
    message: alertType === 'out_of_stock'
      ? `Product "${product.title}" is now out of stock!`
      : `Product "${product.title}" is running low on stock (${product.stock} remaining)`
  };

  // Emit to seller's room
  io.to(`seller_${sellerId}`).emit('inventory_alert', alert);
  
  // Also emit to admin room for monitoring
  io.to('admin_room').emit('inventory_alert', { ...alert, sellerId });

  console.log(`📦 Inventory Alert (${alertType}): ${product.title} - Stock: ${product.stock}`);
};

/**
 * Check stock levels and emit alerts if needed
 */
export const checkStockLevels = async (io, product, previousStock) => {
  if (!product || !product.seller) return;

  const sellerId = product.seller.toString();

  // Check if stock just went below threshold
  if (product.stock === OUT_OF_STOCK_THRESHOLD && previousStock > OUT_OF_STOCK_THRESHOLD) {
    emitInventoryAlert(io, sellerId, product, 'out_of_stock');
  } else if (product.stock <= LOW_STOCK_THRESHOLD && product.stock > OUT_OF_STOCK_THRESHOLD && previousStock > LOW_STOCK_THRESHOLD) {
    emitInventoryAlert(io, sellerId, product, 'low_stock');
  }
};

/**
 * Emit order update notification
 */
export const emitOrderUpdate = (io, userId, order, status) => {
  if (!io) return;

  const notification = {
    type: 'order_update',
    orderId: order._id,
    orderNumber: order.orderNumber,
    status,
    timestamp: new Date().toISOString(),
    message: `Your order #${order.orderNumber} status has been updated to: ${status}`
  };

  io.to(`user_${userId}`).emit('order_update', notification);
};

/**
 * Emit delivery partner assignment notification
 */
export const emitDeliveryAssignment = (io, partnerId, order) => {
  if (!io) return;

  const notification = {
    type: 'delivery_assignment',
    orderId: order._id,
    orderNumber: order.orderNumber,
    timestamp: new Date().toISOString(),
    message: `New delivery assignment: Order #${order.orderNumber}`
  };

  io.to(`partner_${partnerId}`).emit('delivery_assignment', notification);
};

export default {
  emitInventoryAlert,
  checkStockLevels,
  emitOrderUpdate,
  emitDeliveryAssignment
};
