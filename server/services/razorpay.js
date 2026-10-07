import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

export const createOrder = async (amount, currency = 'INR', receipt) => {
  try {
    const options = {
      amount: amount * 100,
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);
    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt
    };
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return { success: false, error: error.message };
  }
};

export const verifyOrder = (orderId, paymentId, signature) => {
  try {
    const sign = orderId + '|' + paymentId;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest('hex');

    if (signature === expectedSign) {
      return { success: true, verified: true };
    }

    return { success: false, verified: false, message: 'Payment verification failed' };
  } catch (error) {
    console.error('Error verifying Razorpay order:', error);
    return { success: false, verified: false, error: error.message };
  }
};

export const createSubscription = async (planId, customerEmail, totalAmount = 590) => {
  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12,
      quantity: 1,
      notes: {
        email: customerEmail,
        amount: totalAmount
      }
    });

    return {
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      planId: subscription.plan_id,
      quantity: subscription.quantity
    };
  } catch (error) {
    console.error('Error creating Razorpay subscription:', error);
    return { success: false, error: error.message };
  }
};

export const verifySubscription = async (subscriptionId) => {
  try {
    const subscription = await razorpay.subscriptions.fetch(subscriptionId);
    return {
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      planId: subscription.plan_id,
      currentStart: subscription.current_start,
      currentEnd: subscription.current_end
    };
  } catch (error) {
    console.error('Error verifying Razorpay subscription:', error);
    return { success: false, error: error.message };
  }
};

export const fetchPayment = async (paymentId) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return {
      success: true,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      method: payment.method
    };
  } catch (error) {
    console.error('Error fetching Razorpay payment:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Transfer funds to seller's bank account
 * Note: This requires RazorpayX integration for actual fund transfers
 * For now, this is a mock implementation that simulates the transfer
 * 
 * To enable real transfers:
 * 1. Sign up for RazorpayX (https://razorpay.com/x/)
 * 2. Get RazorpayX API keys
 * 3. Replace this mock with actual RazorpayX API calls
 */
export const transferFunds = async ({ amount, accountNumber, ifscCode, name, notes }) => {
  try {
    // Check if RazorpayX is configured
    if (!process.env.RAZORPAYX_KEY_ID || !process.env.RAZORPAYX_KEY_SECRET) {
      // Mock transfer for development/testing
      console.log('Mock fund transfer:', { amount, accountNumber, ifscCode, name, notes });
      
      // Simulate transfer delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate success (90% success rate for testing)
      const isSuccess = Math.random() > 0.1;
      
      if (isSuccess) {
        return {
          success: true,
          id: `tr_mock_${Date.now()}`,
          amount: amount,
          status: 'processed',
          mode: 'imps',
          message: 'Mock transfer successful'
        };
      } else {
        throw new Error('Mock transfer failed - insufficient funds');
      }
    }

    // Real RazorpayX transfer (when configured)
    // This would use the RazorpayX API
    // For now, return mock response
    console.warn('RazorpayX transfer not yet implemented. Using mock transfer.');
    
    return {
      success: true,
      id: `tr_mock_${Date.now()}`,
      amount: amount,
      status: 'processed',
      mode: 'neft',
      message: 'Transfer initiated (mock)'
    };
    
  } catch (error) {
    console.error('Error transferring funds:', error);
    throw error;
  }
};

export default razorpay;
