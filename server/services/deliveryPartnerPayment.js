import Razorpay from 'razorpay';

/*
 * No instance here. This file used to construct one at import time, which meant
 * the API could not start without RAZORPAY keys even though nothing read that
 * variable - the payouts below build their own client, and only when
 * RAZORPAY2_* credentials are actually configured.
 */

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

/*
 * What a partner may actually withdraw.
 *
 * `totalWithdrawn` counts money that genuinely left the platform. A request
 * that is still waiting to be settled is not withdrawn - but it must not stay
 * spendable either, or one partner could queue several days of pickups against
 * the same balance while each of them sat un-settled. So pending rows are
 * reserved here, and the reserve disappears the moment a row fails.
 */
export const PARTNER_PENDING_STATES = ['awaiting_settlement'];

export const availableBalance = (partner) => {
  const withdrawn = Number(partner.totalWithdrawn || 0);
  const reserved = (partner.withdrawals || [])
    .filter((w) => PARTNER_PENDING_STATES.includes(w.status))
    .reduce((sum, w) => sum + Number(w.amount || 0), 0);
  return Math.max(0, Math.round(((Number(partner.totalEarnings || 0) - withdrawn - reserved) * 100)) / 100);
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

    const available = availableBalance(partner);
    if (amount > available) {
      return {
        success: false,
        error: `₹50 minimum, and only ₹${available.toFixed(2)} is available to withdraw right now.`,
        availableBalance: available
      };
    }

    const platformFee = calculatePlatformFee(amount);
    const netAmount = Math.round((amount - platformFee) * 100) / 100;

    /*
     * RazorpayX pays out only if its own credentials are configured. The id
     * below is whatever the gateway returns, and nothing else: this used to
     * fall back to `payout_<timestamp>`, a number that looked exactly like a
     * receipt, was stored as `processed`, and moved the balance to withdrawn -
     * so a partner's history recorded transfers that had never been attempted.
     */
    let payoutId = null;
    let payFailed = null;
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

    const settled = !!payoutId;
    partner.lastWithdrawalAt = new Date();
    if (settled) {
      partner.totalWithdrawn = (partner.totalWithdrawn || 0) + amount;
      partner.totalPlatformFees = (partner.totalPlatformFees || 0) + platformFee;
    }
    partner.withdrawals.push({
      amount,
      platformFee,
      netPaid: netAmount,
      payoutId: payoutId || '',
      status: settled ? 'processed' : 'awaiting_settlement',
      at: new Date(),
      settledAt: settled ? new Date() : null,
      settlementNote: settled
        ? 'Paid out by RazorpayX.'
        : 'No RazorpayX credentials configured (or the transfer was rejected). Held as reserved until an admin settles it against a real bank transfer.'
    });
    await partner.save();

    return {
      success: true,
      payoutId: payoutId || null,
      amount: netAmount,
      platformFee,
      status: settled ? 'processed' : 'awaiting_settlement',
      requiresManualSettlement: !settled,
      availableBalance: availableBalance(partner),
      message: settled
        ? 'Payout processed successfully'
        : 'Withdrawal queued for settlement. The balance is reserved, but no money has left the platform yet.'
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
    }).select('deliveredAt totalAmount deliveryFee deliveryDistanceKm orderId orderNumber').lean();

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
        // The order number, not just the id: a partner reconciling a week of runs
        // reads the number printed on the parcel.
        deliveries: delivered.map((o) => ({
          orderId: o.orderId,
          orderNumber: o.orderNumber,
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
    /*
     * Always load the document. The old test was `partnerOrId._id ? partnerOrId
     * : findById(partnerOrId)`, which looks harmless but is not: a Mongoose
     * ObjectId answers `_id` with itself, so a bare id passed as a document, and
     * every read below (totalEarnings, totalWithdrawn, withdrawals) came back
     * undefined. The guard then saw a zero balance and refused every withdrawal
     * made through HTTP, which is the shape of the bug this file had: partners
     * could not be paid, and the failure looked like an empty wallet.
     */
    const partner = await DeliveryPartner.findById(partnerOrId?._id ?? partnerOrId);

    if (!partner) return { success: false, error: 'Delivery partner not found.' };

    const value = Number(amount);
    if (!value || Number.isNaN(value)) {
      return { success: false, error: 'A valid withdrawal amount is required.' };
    }
    if (value < 50) {
      return { success: false, error: 'Minimum withdrawal amount is ₹50' };
    }

    const payout = await createDeliveryPayout(partner, value, null);
    if (!payout.success) return { success: false, error: payout.error };

    /*
     * The status a partner is told has to be the status the ledger recorded.
     * This used to answer `processed` and "credited within 24 hours" on every
     * success, even when no payout had been attempted at all - so the partner
     * waited for money that was only ever sitting in a queue.
     */
    const settled = payout.status === 'processed';
    return {
      success: true,
      data: {
        withdrawalId: payout.payoutId ? String(payout.payoutId) : null,
        amount: value,
        platformFee: payout.platformFee,
        netAmount: payout.amount,
        status: payout.status,
        requiresManualSettlement: !settled,
        availableBalance: payout.availableBalance,
        message: settled
          ? 'Withdrawal processed. The amount has been paid out to your account.'
          : `Withdrawal of ₹${value} is queued for settlement and your balance is reserved. An admin records the bank transfer reference when it is paid; you will see it move to Paid on the day that happens.`
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

/**
 * Mark a queued partner withdrawal as settled by hand.
 *
 * This is the only way money leaves the platform without RazorpayX: a person
 * pays the partner through the bank and records the transfer reference here.
 * It is deliberately a separate, admin-only operation rather than something a
 * partner can trigger, and it moves the balance only now - at the moment the
 * payment is asserted to have happened - so the ledger and the bank agree
 * instead of agreeing only in appearance.
 */
export const settlePartnerWithdrawal = async ({ partnerId, withdrawalId, reference, note, actor }) => {
  const partner = await (await import('../models/DeliveryPartner.js')).default.findById(partnerId);
  if (!partner) return { success: false, error: 'Delivery partner not found.' };

  const row = (partner.withdrawals || []).id(withdrawalId);
  if (!row) return { success: false, error: 'Withdrawal not found for this partner.' };
  if (row.status === 'processed') {
    return { success: false, alreadySettled: true, message: `Already settled${row.settledAt ? ` on ${row.settledAt.toISOString()}` : ''}.` };
  }

  const cleanReference = String(reference || '').trim();
  if (!cleanReference) {
    return {
      success: false,
      needsReference: true,
      error: 'A bank transfer reference (UTR) is required. Settling without one would put an untraceable payment in the partner history.'
    };
  }

  row.payoutId = cleanReference.slice(0, 40);
  row.status = 'processed';
  row.settledAt = new Date();
  row.settlementNote = `${String(note || 'Settled by bank transfer').slice(0, 180)} (by ${actor || 'admin'})`;

  partner.totalWithdrawn = (partner.totalWithdrawn || 0) + Number(row.amount || 0);
  partner.totalPlatformFees = (partner.totalPlatformFees || 0) + Number(row.platformFee || 0);
  await partner.save();

  /*
   * The partner whose money just moved must be told, in the same operation that
   * moved it. A settlement recorded only in the desk's queue means the person
   * owed goes back to checking their balance by hand - which is how a paid
   * withdrawal looks unpaid.
   */
  try {
    const { notifyPartner } = await import('./notifications.js');
    await notifyPartner({
      partnerId: partner._id,
      title: 'Withdrawal paid',
      message: `₹${row.netPaid} for your withdrawal of ₹${row.amount} was settled by the desk${cleanReference ? ` (reference ${cleanReference})` : ''}.`,
      type: 'payment',
      data: { withdrawalId: String(row._id), amount: row.amount, netPaid: row.netPaid, reference: cleanReference }
    });
  } catch (payNoteErr) {
    console.error(JSON.stringify({ event: 'settle_notify_failed', message: String(payNoteErr.message).slice(0, 140) }));
  }

  return {
    success: true,
    message: 'Withdrawal marked as settled.',
    withdrawal: { id: String(row._id), amount: row.amount, payoutId: row.payoutId, status: row.status, settledAt: row.settledAt }
  };
};

/** Queued withdrawals across every partner, oldest first: the admin queue. */
export const pendingPartnerWithdrawals = async () => {
  const DeliveryPartner = (await import('../models/DeliveryPartner.js')).default;
  const partners = await DeliveryPartner.find({ 'withdrawals.status': 'awaiting_settlement' })
    .select('name phone uniqueId totalEarnings totalWithdrawn withdrawals bankDetails')
    .lean();

  const rows = [];
  for (const partner of partners) {
    for (const w of partner.withdrawals || []) {
      if (w.status !== 'awaiting_settlement') continue;
      rows.push({
        withdrawalId: String(w._id),
        partner: { id: String(partner._id), name: partner.name, phone: partner.phone, uniqueId: partner.uniqueId },
        bank: { accountNumber: partner.bankDetails?.accountNumber || '', ifsc: partner.bankDetails?.ifscCode || '', holder: partner.bankDetails?.accountHolderName || '' },
        amount: w.amount,
        platformFee: w.platformFee,
        netPaid: w.netPaid,
        requestedAt: w.at
      });
    }
  }
  rows.sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
  return {
    success: true,
    count: rows.length,
    totalValue: Math.round(rows.reduce((sum, r) => sum + Number(r.amount || 0), 0) * 100) / 100,
    withdrawals: rows
  };
};
