import SellerPayout from '../models/SellerPayout.js';
import Order from '../models/Order.js';
import Seller from '../models/Seller.js';
import { transferFunds } from './razorpay.js';

const COMMISSION_RATE = 0.03; // 3% commission

/**
 * Generate unique payout number
 */
const generatePayoutNumber = async () => {
  const count = await SellerPayout.countDocuments();
  return `PAY${String(count + 1).padStart(6, '0')}`;
};

/**
 * Calculate seller payout for a given period
 */
export const calculateSellerPayout = async (sellerId, startDate, endDate) => {
  try {
    // Get all delivered orders for this seller in the period
    const orders = await Order.find({
      seller: sellerId,
      orderStatus: 'delivered',
      paymentStatus: 'completed',
      deliveredAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      payoutProcessed: { $ne: true }
    });

    if (orders.length === 0) {
      return {
        success: false,
        message: 'No eligible orders found for this period'
      };
    }

    // Calculate totals on the merchandise base, then subtract what it cost to
    // fulfil. Using order.totalAmount here would commission the delivery charge
    // as well, and the seller would see it on their statement as a surprise.
    let totalSales = 0;
    let fulfilmentCost = 0;
    let platformCommission = 0;

    orders.forEach((order) => {
      const merchandise = Number(order.subtotal)
        || (order.items || []).reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0);
      totalSales += merchandise;

      // Prefer the figure recorded when the order was delivered, so the payout
      // always matches what commission tracking already booked.
      const booked = Number(order.commissionAmount || 0);
      platformCommission += booked > 0
        ? booked
        : Math.round(merchandise * COMMISSION_RATE * 100) / 100;

      fulfilmentCost += order.deliveryAssignmentMode === 'self'
        ? Number(order.deliveryFee || 0)
        : Number(order.shiprocketDeliveryCharge || 0);
    });

    totalSales = Math.round(totalSales * 100) / 100;
    platformCommission = Math.round(platformCommission * 100) / 100;
    fulfilmentCost = Math.round(fulfilmentCost * 100) / 100;
    const netAmount = Math.round((totalSales - platformCommission - fulfilmentCost) * 100) / 100;

    // Get seller bank details
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return {
        success: false,
        message: 'Seller not found'
      };
    }

    // Create payout record
    const payoutNumber = await generatePayoutNumber();
    const payout = new SellerPayout({
      seller: sellerId,
      payoutNumber,
      period: {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      },
      totalSales,
      platformCommission,
      deliveryCharges: fulfilmentCost,
      netAmount,
      status: 'pending',
      bankDetails: {
        accountNumber: seller.bankAccount.accountNumber,
        ifscCode: seller.bankAccount.ifscCode,
        accountHolderName: seller.bankAccount.accountHolderName || seller.name,
        bankName: seller.bankAccount.bankName
      }
    });

    await payout.save();

    // Mark orders as payout processed
    await Order.updateMany(
      { _id: { $in: orders.map(o => o._id) } },
      { payoutProcessed: true }
    );

    return {
      success: true,
      payout,
      orderCount: orders.length
    };
  } catch (error) {
    console.error('Error calculating seller payout:', error);
    throw error;
  }
};

/**
 * Process pending payouts
 */
export const processPendingPayouts = async () => {
  try {
    const pendingPayouts = await SellerPayout.find({ status: 'pending' })
      .populate('seller', 'name email')
      .limit(10);

    const results = [];

    for (const payout of pendingPayouts) {
      try {
        // Update status to processing
        payout.status = 'processing';
        payout.processedAt = new Date();
        await payout.save();

        // Transfer funds via Razorpay. Amount is in rupees; transferFunds
        // converts to paise itself, so it must not be pre-multiplied here.
        const sourcePayment = await Order.findOne({
          seller: payout.seller._id || payout.seller,
          paymentStatus: 'completed',
          paymentId: { $exists: true, $ne: null }
        }).sort({ deliveredAt: -1 }).select('paymentId').lean();

        const transferResult = await transferFunds({
          amount: payout.netAmount,
          paymentId: sourcePayment && sourcePayment.paymentId,
          accountNumber: payout.bankDetails.accountNumber,
          ifscCode: payout.bankDetails.ifscCode,
          name: payout.bankDetails.accountHolderName,
          notes: { payout: payout.payoutNumber, seller: String(payout.seller._id || payout.seller) }
        });

        if (!transferResult.success) {
          // Nothing reached the gateway, so the payout must not look paid.
          // `not_initiated` keeps it queued; a hard rejection is recorded as failed.
          payout.status = transferResult.status === 'not_initiated' ? 'pending' : 'failed';
          payout.processedAt = null;
          payout.failureReason = transferResult.message;
          await payout.save();

          results.push({
            payoutId: payout._id,
            payoutNumber: payout.payoutNumber,
            status: payout.status === 'pending' ? 'awaiting_settlement' : 'failed',
            error: transferResult.message
          });
          continue;
        }

        payout.razorpayTransferId = transferResult.id;
        payout.transactionId = transferResult.id;
        payout.status = 'completed';
        payout.completedAt = new Date();
        await payout.save();

        results.push({
          payoutId: payout._id,
          payoutNumber: payout.payoutNumber,
          status: 'success',
          transferId: transferResult.id
        });

      } catch (error) {
        // Mark as failed
        payout.status = 'failed';
        payout.failedAt = new Date();
        payout.failureReason = error.message;
        await payout.save();

        results.push({
          payoutId: payout._id,
          payoutNumber: payout.payoutNumber,
          status: 'failed',
          error: error.message
        });
      }
    }

    return {
      success: true,
      processed: results.length,
      results
    };
  } catch (error) {
    console.error('Error processing pending payouts:', error);
    throw error;
  }
};

/**
 * Get seller payout history
 */
export const getSellerPayoutHistory = async (sellerId, limit = 20) => {
  try {
    const payouts = await SellerPayout.find({ seller: sellerId })
      .sort({ createdAt: -1 })
      .limit(limit);

    return payouts;
  } catch (error) {
    console.error('Error getting seller payout history:', error);
    throw error;
  }
};

/**
 * Get all payouts (admin)
 */
export const getAllPayouts = async (filters = {}, limit = 50) => {
  try {
    const payouts = await SellerPayout.find(filters)
      .populate('seller', 'name email storeName')
      .sort({ createdAt: -1 })
      .limit(limit);

    return payouts;
  } catch (error) {
    console.error('Error getting all payouts:', error);
    throw error;
  }
};

/**
 * Get payout summary for admin
 */
export const getPayoutSummary = async () => {
  try {
    const summary = await SellerPayout.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$netAmount' }
        }
      }
    ]);

    const totalPayouts = await SellerPayout.countDocuments();
    const totalAmount = await SellerPayout.aggregate([
      { $group: { _id: null, total: { $sum: '$netAmount' } } }
    ]);

    return {
      byStatus: summary,
      totalPayouts,
      totalAmount: totalAmount[0]?.total || 0
    };
  } catch (error) {
    console.error('Error getting payout summary:', error);
    throw error;
  }
};
