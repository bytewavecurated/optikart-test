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
export const createDeliveryPayout = async (partnerId, amount, deliveryId) => {
  try {
    // Check if withdrawal is allowed (once per day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // In a real implementation, check if partner has already withdrawn today
    // For now, we'll just create the payout
    
    const platformFee = calculatePlatformFee(amount);
    const netAmount = amount - platformFee;
    
    // Create Razorpay payout (using RazorpayX or similar)
    // Note: This is a simplified version. In production, use RazorpayX for payouts
    const payoutData = {
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
      fund_account_id: partnerId, // This should be the partner's fund account ID
      amount: Math.round(netAmount * 100), // Amount in paise
      currency: 'INR',
      mode: 'IMPS',
      purpose: 'payout',
      queue: 'low',
      notes: {
        delivery_id: deliveryId,
        platform_fee: platformFee,
        description: `Delivery payout - Platform fee: ₹${platformFee}`
      }
    };
    
    // In production, call RazorpayX API
    // const payout = await razorpay2.payouts.create(payoutData);
    
    // For now, return mock response
    return {
      success: true,
      payoutId: `payout_${Date.now()}`,
      amount: netAmount,
      platformFee: platformFee,
      status: 'processed',
      message: 'Payout processed successfully'
    };
  } catch (error) {
    console.error('Error creating delivery payout:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get delivery partner earnings
 */
export const getDeliveryPartnerEarnings = async (partnerId, period = 'month') => {
  try {
    // In a real implementation, query the database for completed deliveries
    // For now, return mock data
    
    const startDate = new Date();
    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }
    
    // Mock data
    return {
      success: true,
      data: {
        totalEarnings: 15000,
        totalDeliveries: 45,
        averageEarningPerDelivery: 333.33,
        platformFees: 900,
        netEarnings: 14100,
        period: period,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error getting delivery partner earnings:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Process withdrawal request
 */
export const processWithdrawal = async (partnerId, amount) => {
  try {
    // Validate amount
    if (amount < 50) {
      return {
        success: false,
        error: 'Minimum withdrawal amount is ₹50'
      };
    }
    
    // Check if withdrawal is allowed (once per day)
    // In a real implementation, check last withdrawal date
    
    const platformFee = calculatePlatformFee(amount);
    const netAmount = amount - platformFee;
    
    // Create payout
    const payout = await createDeliveryPayout(partnerId, amount, null);
    
    if (!payout.success) {
      return payout;
    }
    
    return {
      success: true,
      data: {
        withdrawalId: payout.payoutId,
        amount: amount,
        platformFee: platformFee,
        netAmount: netAmount,
        status: 'processed',
        message: 'Withdrawal processed successfully. Amount will be credited to your account within 24 hours.'
      }
    };
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  calculateDeliveryFee,
  calculatePlatformFee,
  createDeliveryPayout,
  getDeliveryPartnerEarnings,
  processWithdrawal
};
