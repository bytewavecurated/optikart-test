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

    // Calculate totals
    const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const platformCommission = Math.round(totalSales * COMMISSION_RATE);
    const netAmount = totalSales - platformCommission;

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
      netAmount,
      status: 'pending',
      bankDetails: {
        accountNumber: seller.bankAccount.accountNumber,
        ifscCode: seller.bankAccount.ifscCode,
        accountHolderName: seller.bankAccount.accountHolderName,
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

        // Transfer funds via Razorpay
        const transferResult = await transferFunds({
          amount: payout.netAmount * 100, // Convert to paise
          accountNumber: payout.bankDetails.accountNumber,
          ifscCode: payout.bankDetails.ifscCode,
          name: payout.bankDetails.accountHolderName,
          notes: `Payout ${payout.payoutNumber} for seller ${payout.seller.name}`
        });

        // Update payout with transfer details
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
