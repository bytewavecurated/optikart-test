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
 * Process a refund for a payment
 */
export const processRefund = async ({ paymentId, amount, speed = 'optimum', notes = {} }) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'your_razorpay_key_id_here') {
      // Mock refund for development/testing
      console.log('Mock refund:', { paymentId, amount, speed, notes });
      return {
        success: true,
        refundId: `rf_mock_${Date.now()}`,
        amount: amount,
        status: 'processed',
        message: 'Mock refund processed'
      };
    }

    const refund = await razorpay.payments.refund(paymentId, {
      amount,
      speed,
      notes
    });

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
      message: 'Refund processed successfully'
    };
  } catch (error) {
    console.error('Error processing refund:', error);
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
/**
 * Settle money to a seller's bank account.
 *
 * This deliberately does NOT invent a successful transfer. Previously it
 * returned a fake `tr_mock_...` id (even when RazorpayX credentials were
 * present) and a random 90% pass rate, which marked real payouts as completed
 * with receipts that never existed. A payout now only leaves `pending` when a
 * transfer is actually accepted by the gateway, so the ledger can be trusted.
 *
 * Requires RAZORPAYX_KEY_ID / RAZORPAYX_KEY_SECRET and a seeded fund account.
 */
/**
 * Settle money to a seller.
 *
 * This deliberately never invents a successful transfer. The previous version
 * returned a fabricated `tr_mock_...` id (even when credentials were present)
 * and a random 90% pass rate, which marked real payouts completed against
 * receipts that never existed. A payout now only leaves `pending` when the
 * gateway actually accepts it, so the ledger can be trusted.
 *
 * Two supported paths:
 *  1. paymentId given  -> a real Razorpay transfer off that captured payment
 *     (this is what the `razorpay` SDK exposes as `transfers.create`).
 *  2. no paymentId     -> bank settlement must be done through RazorpayX
 *     payouts, which the payments SDK does not implement. Until that is wired
 *     up with its own credentials, the payout is reported as not_initiated and
 *     stays pending in the admin queue for manual settlement.
 */
export const transferFunds = async ({ amount, paymentId, accountNumber, ifscCode, name, notes }) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return { success: false, status: 'failed', message: 'A positive transfer amount is required.' };
  }

  if (!paymentId) {
    return {
      success: false,
      status: 'not_initiated',
      requiresManualSettlement: true,
      message: 'No source payment for an automated transfer. Settle from the RazorpayX dashboard or supply paymentId; the payout stays pending until it is actually paid.'
    };
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return {
      success: false,
      configMissing: true,
      status: 'not_initiated',
      message: 'Razorpay API keys are not configured. The payout stays pending.'
    };
  }

  try {
    const transfer = await razorpay.transfers.create({
      payments: [{ id: paymentId }],
      total_amount: Math.round(value * 100), // paise
      currency: 'INR',
      // A recipient entity is required by the API; without a linked sub-
      // account the call fails loudly rather than reporting false success.
      transfers: [{
        account_number: accountNumber,
        ifsc: ifscCode,
        amount: Math.round(value * 100),
        currency: 'INR',
        name: name || undefined
      }],
      oneshot: true,
      notes: notes || undefined
    });

    return {
      success: true,
      id: transfer.id,
      amount: value,
      status: transfer.status || 'processed',
      message: 'Transfer accepted by Razorpay.'
    };
  } catch (error) {
    console.error('Razorpay transfer failed:', error.message);
    return {
      success: false,
      status: 'failed',
      message: (error && error.error && error.error.description) || error.message || 'Transfer rejected by Razorpay.'
    };
  }
};

export default razorpay;
