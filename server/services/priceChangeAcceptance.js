import crypto from 'crypto';
import mongoose from 'mongoose';
import SellerStock from '../models/SellerStock.js';
import Product from '../models/Product.js';
import Seller from '../models/Seller.js';
import ManufacturerSeller from '../models/ManufacturerSeller.js';
import { sendEmail } from './email.js';

/**
 * Price and listing changes are proposed, emailed, and only applied once the
 * seller accepts - the brief's "they must accept within 7 working days,
 * otherwise it stays as it is".
 *
 * Without this a seller's price could change under their feet. The proposal is
 * stored on the SellerStock row, is never applied to the live price, and
 * expires on a working-day deadline computed here.
 */

const WORKING_DAYS = 7;

/**
 * Add N working days, skipping Saturdays and Sundays. Time is kept at the
 * start of the day so the deadline is a date a recipient can read.
 */
export const addWorkingDays = (from, days = WORKING_DAYS) => {
  const d = new Date(from);
  d.setHours(18, 0, 0, 0);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return d;
};

export const workingDaysBetween = (from, to) => {
  let n = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) n += 1;
  }
  return n;
};

const resolveSeller = async (sellerId) => {
  if (!sellerId || !mongoose.isValidObjectId(sellerId)) return null;
  const byId = await Seller.findById(sellerId).select('email name storeName').lean();
  if (byId) return { doc: byId, kind: 'seller' };
  // Manufacturer-appointed retailers live in their own collection.
  const alt = await ManufacturerSeller.findById(sellerId).select('email name storeName manufacturer').lean().catch(() => null);
  return alt ? { doc: alt, kind: 'manufacturerSeller' } : null;
};

const priceLabel = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;

const buildEmail = ({ sellerName, product, stock, fromPrice, toPrice, expiresAt, acceptUrl, declineUrl }) => {
  const discount = fromPrice && toPrice && toPrice < fromPrice
    ? Math.round(((fromPrice - toPrice) / fromPrice) * 100)
    : 0;
  const lines = [
    `Hello ${sellerName || 'there'},`,
    '',
    `A price change has been recorded for one of your listings and needs your confirmation:`,
    '',
    `Product      : ${product.title}`,
    `Brand        : ${product.brand}`,
    `Current price: ${priceLabel(fromPrice)}`,
    `New price    : ${priceLabel(toPrice)}${discount ? `  (${discount}% below the current price)` : ''}`,
    `Requested by : ${stock.pendingChange?.requestedBy || 'price update'}`,
    `Decision due  : by ${expiresAt ? new Date(expiresAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : 'the deadline'}`,
    '',
    'Your live listing keeps the current price until you accept. If we do not',
    `hear from you within ${WORKING_DAYS} working days, this proposal expires and nothing changes.`,
    '',
    `Accept and publish the new price:\n  ${acceptUrl}`,
    '',
    `Decline and keep the current price:\n  ${declineUrl}`,
    '',
    'If either link does not work, paste it into your browser address bar, or',
    'open your seller dashboard and confirm it from the price-change prompt.',
    '',
    '- OptiKart'
  ];
  return lines.join('\n');
};

/**
 * Raise a price-change proposal. The new price is NOT applied here.
 */
export const proposePriceChange = async ({ sellerStockId, sellerId, product, newPrice, requestedBy = 'price update', actorLabel = 'the platform' }) => {
  try {
    const stock = await SellerStock.findById(sellerStockId).populate('product', 'title brand');
    if (!stock) return { success: false, error: 'Listing not found' };

    const target = Number(newPrice);
    if (!Number.isFinite(target) || target <= 0) {
      return { success: false, error: 'A valid new price is required' };
    }

    const fromPrice = stock.sellingPrice;
    if (target === fromPrice) {
      return { success: false, error: 'The new price matches the current price' };
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = addWorkingDays(new Date(), WORKING_DAYS);

    stock.pendingChange = {
      sellingPrice: target,
      discountPercent: fromPrice ? Math.max(0, Math.round(((fromPrice - target) / fromPrice) * 100)) : 0,
      requestedBy: actorLabel,
      requestedAt: new Date(),
      expiresAt,
      acceptToken: token,
      status: 'awaiting_acceptance',
      acceptedAt: null,
      declinedAt: null,
      proposedFromPrice: fromPrice
    };
    await stock.save();

    const resolved = await resolveSeller(sellerId || stock.seller);
    const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const acceptUrl = `${base}/price-change/${String(stock._id)}?token=${token}&decision=accept`;
    const declineUrl = `${base}/price-change/${String(stock._id)}?token=${token}&decision=decline`;

    if (resolved?.doc?.email) {
      await sendEmail({
        to: resolved.doc.email,
        subject: `Confirm your new price for ${stock.product?.title || 'a listing'}`,
        text: buildEmail({
          sellerName: resolved.doc.storeName || resolved.doc.name,
          product: stock.product || {},
          stock,
          fromPrice,
          toPrice: target,
          expiresAt,
          acceptUrl,
          declineUrl
        })
      });
    }

    return {
      success: true,
      message: `Proposal sent. It takes effect once accepted, or expires ${WORKING_DAYS} working days from now.`,
      stockId: String(stock._id),
      fromPrice,
      toPrice: target,
      expiresAt,
      acceptUrl,
      declineUrl
    };
  } catch (error) {
    console.error('proposePriceChange error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Apply or discard a pending proposal. The token keeps a stranger from
 * approving someone else's price from a forwarded email link.
 */
export const decidePriceChange = async ({ stockId, token, decision }) => {
  try {
    const stock = await SellerStock.findById(stockId).populate('product', 'title brand');
    if (!stock) return { success: false, error: 'This listing no longer exists.' };
    if (!stock.pendingChange || stock.pendingChange.status !== 'awaiting_acceptance') {
      return { success: false, error: 'There is no price change waiting on this listing.' };
    }
    if (token && stock.pendingChange.acceptToken && token !== stock.pendingChange.acceptToken) {
      return { success: false, error: 'That confirmation link is not valid for this request.' };
    }
    if (stock.pendingChange.expiresAt && new Date(stock.pendingChange.expiresAt) < new Date()) {
      stock.pendingChange.status = 'expired';
      await stock.save();
      return { success: false, expired: true, error: `The ${WORKING_DAYS} working-day window closed, so the price stayed at ${priceLabel(stock.sellingPrice)}.` };
    }

    if (decision === 'accept') {
      const applied = Number(stock.pendingChange.sellingPrice);
      stock.sellingPrice = applied;
      if (stock.mrp) {
        stock.discountPercent = Math.max(0, Math.round(((stock.mrp - applied) / stock.mrp) * 100));
      }
      stock.pendingChange.status = 'accepted';
      stock.pendingChange.acceptedAt = new Date();
      await stock.save();
      return {
        success: true,
        decision: 'accept',
        message: `Price accepted. Your listing now shows ${priceLabel(applied)}.`,
        sellingPrice: applied
      };
    }

    if (decision === 'decline') {
      const kept = stock.sellingPrice;
      stock.pendingChange.status = 'declined';
      stock.pendingChange.declinedAt = new Date();
      await stock.save();
      return {
        success: true,
        decision: 'decline',
        message: `Change declined. Your listing stays at ${priceLabel(kept)}.`,
        sellingPrice: kept
      };
    }

    return { success: false, error: 'Unrecognised decision.' };
  } catch (error) {
    console.error('decidePriceChange error:', error);
    return { success: false, error: error.message };
  }
};

/** Admin-side force accept after speaking to the seller (declined by mistake). */
export const overridePriceChange = async ({ stockId, adminId, decision = 'accept' }) => {
  try {
    const stock = await SellerStock.findById(stockId).populate('product', 'title brand');
    if (!stock) return { success: false, error: 'Listing not found' };
    const states = ['declined', 'expired', 'awaiting_acceptance', 'none'];
    if (!states.includes(stock.pendingChange?.status || 'none')) {
      return { success: false, error: 'Nothing to override on this listing.' };
    }
    const target = Number(stock.pendingChange?.sellingPrice);
    if (decision === 'accept') {
      if (!Number.isFinite(target) || target <= 0) return { success: false, error: 'No proposed price to apply.' };
      stock.sellingPrice = target;
      stock.pendingChange.status = 'accepted';
      stock.pendingChange.acceptedAt = new Date();
      stock.pendingChange.requestedBy = `admin override${adminId ? ` (${String(adminId).slice(-6)})` : ''}`;
    } else {
      stock.pendingChange.status = 'declined';
      stock.pendingChange.declinedAt = new Date();
    }
    await stock.save();
    return { success: true, message: decision === 'accept' ? `Applied ${priceLabel(stock.sellingPrice)} on the seller's behalf.` : 'Proposal discarded.', stock };
  } catch (error) {
    console.error('overridePriceChange error:', error);
    return { success: false, error: error.message };
  }
};

/** Expire overdue proposals and report them so the admin queue can prompt. */
export const sweepExpiredPriceChanges = async () => {
  const due = await SellerStock.find({
    'pendingChange.status': 'awaiting_acceptance',
    'pendingChange.expiresAt': { $lt: new Date() }
  }).populate('product', 'title brand');
  for (const stock of due) {
    stock.pendingChange.status = 'expired';
    await stock.save();
  }
  return { success: true, expired: due.length, items: due.map((d) => ({ stockId: String(d._id), title: d.product?.title, keptPrice: d.sellingPrice })) };
};

/**
 * The pending list for admin / executives / staff with access: who has not
 * answered yet, and how much time is left.
 */
export const listPriceChangeStates = async ({ sellerId, status } = {}) => {
  const filter = {};
  if (sellerId) filter.seller = sellerId;
  if (status) filter['pendingChange.status'] = status;
  else filter['pendingChange.status'] = { $in: ['awaiting_acceptance', 'declined', 'expired'] };

  const rows = await SellerStock.find(filter)
    .sort({ 'pendingChange.requestedAt': -1 })
    .limit(200)
    .populate('product', 'title brand')
    .populate('seller', 'storeName name email')
    .lean();

  const now = new Date();
  return rows.map((r) => {
    const pc = r.pendingChange || {};
    const remainingDays = pc.expiresAt ? Math.max(0, workingDaysBetween(now, new Date(pc.expiresAt))) : 0;
    return {
      stockId: String(r._id),
      sellerId: String(r.seller?._id || r.seller),
      sellerName: r.seller?.storeName || r.seller?.name || '',
      sellerEmail: r.seller?.email || '',
      productTitle: r.product?.title,
      brand: r.product?.brand,
      currentPrice: r.sellingPrice,
      proposedPrice: pc.sellingPrice ?? null,
      status: pc.status,
      requestedAt: pc.requestedAt || null,
      expiresAt: pc.expiresAt || null,
      workingDaysLeft: remainingDays,
      overdue: pc.status === 'awaiting_acceptance' && remainingDays === 0
    };
  });
};

export { WORKING_DAYS };
