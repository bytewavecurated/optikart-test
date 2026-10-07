import InventoryAlert from '../models/InventoryAlert.js';
import Product from '../models/Product.js';

const LOW_STOCK_THRESHOLD = 10;
const OUT_OF_STOCK_THRESHOLD = 0;

export const checkInventoryLevels = async (sellerId) => {
  try {
    const products = await Product.find({ seller: sellerId, isActive: true });
    const alerts = [];

    for (const product of products) {
      const stock = product.stock || 0;
      
      if (stock === OUT_OF_STOCK_THRESHOLD) {
        // Check if alert already exists
        const existingAlert = await InventoryAlert.findOne({
          seller: sellerId,
          product: product._id,
          type: 'out_of_stock',
          isRead: false
        });

        if (!existingAlert) {
          const alert = await InventoryAlert.create({
            seller: sellerId,
            product: product._id,
            type: 'out_of_stock',
            currentStock: stock,
            threshold: OUT_OF_STOCK_THRESHOLD,
            message: `"${product.title}" is out of stock. Please restock immediately.`
          });
          alerts.push(alert);
        }
      } else if (stock <= LOW_STOCK_THRESHOLD) {
        // Check if alert already exists
        const existingAlert = await InventoryAlert.findOne({
          seller: sellerId,
          product: product._id,
          type: 'low_stock',
          isRead: false
        });

        if (!existingAlert) {
          const alert = await InventoryAlert.create({
            seller: sellerId,
            product: product._id,
            type: 'low_stock',
            currentStock: stock,
            threshold: LOW_STOCK_THRESHOLD,
            message: `"${product.title}" is running low on stock (${stock} units remaining). Consider restocking soon.`
          });
          alerts.push(alert);
        }
      }
    }

    return alerts;
  } catch (error) {
    console.error('Error checking inventory levels:', error);
    throw error;
  }
};

export const getSellerAlerts = async (sellerId, limit = 20) => {
  try {
    const alerts = await InventoryAlert.find({ seller: sellerId })
      .populate('product', 'title images price')
      .sort({ createdAt: -1 })
      .limit(limit);

    return alerts;
  } catch (error) {
    console.error('Error getting seller alerts:', error);
    throw error;
  }
};

export const markAlertAsRead = async (alertId) => {
  try {
    const alert = await InventoryAlert.findByIdAndUpdate(
      alertId,
      { isRead: true },
      { new: true }
    );
    return alert;
  } catch (error) {
    console.error('Error marking alert as read:', error);
    throw error;
  }
};

export const markAllAlertsAsRead = async (sellerId) => {
  try {
    await InventoryAlert.updateMany(
      { seller: sellerId, isRead: false },
      { isRead: true }
    );
    return { success: true };
  } catch (error) {
    console.error('Error marking all alerts as read:', error);
    throw error;
  }
};

export const getUnreadAlertCount = async (sellerId) => {
  try {
    const count = await InventoryAlert.countDocuments({
      seller: sellerId,
      isRead: false
    });
    return count;
  } catch (error) {
    console.error('Error getting unread alert count:', error);
    throw error;
  }
};
