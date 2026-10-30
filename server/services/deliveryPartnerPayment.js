import Razorpay from 'razorpay';

// Initialize Razorpay instance for delivery partners (Razorpay2)
const razorpay2 = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Calculate delivery fee based on distance
 * Rate: 10 INR per km
 */
export const calculateDeliveryFee = (distanceInKm) => {
  const ratePerKm = 10;
  const fee = distanceInKm * ratePerKm;
  return Math.round(fee * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate platform fee (3 INR per 50 INR)
 */
export const calculatePlatformFee = (amount) => {
  const feePer50 = 3;
  const multiples = Math.ceil(amount / 50);
  return multiples * feePer50;
};

/**
 * Create payout for delivery partner
 */
export const createDeliveryPayout = async (partner, amount, deliveryId) => {
  try {
    const partnerId = partner._id || partner;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // One withdrawal per calendar day.
    if (partner.lastWithdrawalAt && new Date(partner.lastWithdrawalAt) >= todayStart) {
      return {
        success: false,
        error: 'Only one withdrawal is allowed per day. Please try again tomorrow.'
      };
    }

    const available = (partner.totalEarnings || 0) - (partner.totalWithdrawn || 0);
    if (amount > available) {
      return { success: false, error: 'Withdrawal amount exceeds your available balance.' };
    }

    const platformFee = calculatePlatformFee(amount);
    const netAmount = Math.round((amount - platformFee) * 100) / 100;

    // Razorpay2 (separate account) handles partner payouts. Without live
    // RazorpayX credentials the payout is recorded and settled manually,
    // but the ledger below is always the source of truth.
    let payoutId = `payout_${Date.now()}`;
    if (process.env.RAZORPAY2_KEY_ID && process.env.RAZORPAY2_KEY_SECRET) {
      const rz2 = new Razorpay({
        key_id: process.env.RAZORPAY2_KEY_ID,
        key_secret: process.env.RAZORPAY2_KEY_SECRET
      });
      const payout = await rz2.payouts.create({
        account_number: partner.bankDetails?.accountNumber,
        ifsc: partner.bankDetails?.ifscCode,
        amount: Math.round(netAmount * 100),
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'payout',
        notes: { partner: String(partnerId), delivery_id: deliveryId || '', platform_fee: String(platformFee) }
      });
      payoutId = payout.id;
    }

    partner.totalWithdrawn = (partner.totalWithdrawn || 0) + amount;
    partner.totalPlatformFees = (partner.totalPlatformFees || 0) + platformFee;
    partner.lastWithdrawalAt = new Date();
    partner.withdrawals.push({
      amount,
      platformFee,
      netPaid: netAmount,
      payoutId,
      status: 'processed',
      at: new Date()
    });
    await partner.save();

    return {
      success: true,
      payoutId,
      amount: netAmount,
      platformFee,
      status: 'processed',
      message: 'Payout processed successfully'
    };
  } catch (error) {
    console.error('Error creating delivery payout:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get delivery partner earnings
 */
export const getDeliveryPartnerEarnings = async (partnerId, period = 'month') => {
  try {
    const startDate = new Date();
    if (period === 'week') startDate.setDate(startDate.getDate() - 7);
    else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
    else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);

    const { default: Order } = await import('../models/Order.js');

    const delivered = await Order.find({
      assignedDeliveryPartner: partnerId,
      orderStatus: 'delivered',
      deliveredAt: { $gte: startDate }
    }).select('deliveredAt totalAmount deliveryFee deliveryDistanceKm orderId').lean();

    const gross = delivered.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
    const distance = delivered.reduce((sum, o) => sum + (o.deliveryDistanceKm || 0), 0);
    const platformFees = delivered.length ? calculatePlatformFee(gross) : 0;

    return {
      success: true,
      data: {
        totalEarnings: gross,
        totalDeliveries: delivered.length,
        totalDistanceKm: Math.round(distance * 100) / 100,
        averageEarningPerDelivery: delivered.length
          ? Math.round((gross / delivered.length) * 100) / 100
          : 0,
        platformFees,
        netEarnings: Math.round((gross - platformFees) * 100) / 100,
        deliveries: delivered.map((o) => ({
          orderId: o.orderId,
          deliveredAt: o.deliveredAt,
          fee: o.deliveryFee || 0,
          distanceKm: o.deliveryDistanceKm || 0
        })),
        period,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error getting delivery partner earnings:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Process withdrawal request
 */
export const processWithdrawal = async (partnerOrId, amount) => {
  try {
    const { default: DeliveryPartner } = await import('../models/DeliveryPartner.js');
    const partner = partnerOrId && partnerOrId._id
      ? partnerOrId
      : await DeliveryPartner.findById(partnerOrId);

    if (!partner) return { success: false, error: 'Delivery partner not found.' };

    const value = Number(amount);
    if (!value || Number.isNaN(value)) {
      return { success: false, error: 'A valid withdrawal amount is required.' };
    }
    if (value < 50) {
      return { success: false, error: 'Minimum withdrawal amount is Rs. 50' };
    }

    const payout = await createDeliveryPayout(partner, value, null);
    if (!payout.success) return { success: false, error: payout.error };

    const platformFee = payout.platformFee;
    return {
      success: true,
      data: {
        withdrawalId: payout.payoutId,
        amount: value,
        platformFee,
        netAmount: payout.amount,
        status: 'processed',
        message: 'Withdrawal processed successfully. The amount will be credited to your account within 24 hours.'
      }
    };
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return { success: false, error: error.message };
  }
};

export default {
  calculateDeliveryFee,
  calculatePlatformFee,
  createDeliveryPayout,
  getDeliveryPartnerEarnings,
  processWithdrawal
};
