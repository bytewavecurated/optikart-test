import mongoose from 'mongoose';
import Order from '../models/Order.js';
import OrderRouting from '../models/OrderRouting.js';
import SellerStock from '../models/SellerStock.js';
import Seller from '../models/Seller.js';
import Product from '../models/Product.js';
import { sendEmail } from './email.js';

/**
 * Proximity order routing.
 *
 * A placed order is matched against sellers who actually stock the bought
 * configuration near the buyer. Up to five are offered it in order, each with a
 * 30 minute window to accept. If nobody takes it the order waits in the admin
 * queue with every candidate's contact details, and an administrator (or the AI
 * fallback) assigns it.
 */

const OFFER_WINDOW_MINUTES = 30;
const MAX_CANDIDATES = 5;
const RADIUS_KM_MAX = 10;

const oid = (v) => (v && v._id ? v._id : v);

/** Great-circle distance in km. */
export const distanceKm = (a, b) => {
  if (!a || !b || a.lat === undefined || a.lng === undefined || b.lat === undefined || b.lng === undefined) {
    return null;
  }
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round((2 * R * Math.asin(Math.sqrt(s))) * 100) / 100;
};

/**
 * Does this seller hold the exact configuration the buyer chose?
 * Colour, size, brand, product and gender must match; prescription power must not.
 */
const sellerHoldsConfig = (stock, wanted) => {
  if (!stock || !stock.isListed || (stock.totalStock || 0) <= 0) return false;
  if (!wanted.color && !wanted.size) return true;
  return (stock.variants || []).some((v) => {
    const colorOk = !wanted.color || String(v.color || '').toLowerCase() === String(wanted.color).toLowerCase();
    const sizeOk = !wanted.size || String(v.size || '').toLowerCase() === String(wanted.size).toLowerCase();
    const stockOk = (Number(v.stock) || 0) >= (wanted.quantity || 1);
    return colorOk && sizeOk && stockOk;
  });
};

/**
 * Find candidate sellers for an order, nearest first, within the radius.
 */
const buyerPoint = (order) => buyerPointFrom(order.shippingAddress);

/**
 * Resolve a buyer point from a shipping address. Accepts GeoJSON
 * `[lng, lat]`, explicit `lat`/`lng`, or falls back to a city lookup so routing
 * still works for addresses saved before coordinates were captured.
 */
const CITY_CENTRES = {
  mumbai: [72.8777, 19.076], 'navi mumbai': [73.0243, 19.033], thane: [72.9775, 19.1972],
  delhi: [77.209, 28.6139], 'new delhi': [77.2167, 28.6448], gurugram: [77.0299, 28.4595],
  noida: [77.3095, 28.5355], 'west bengal': [88.3639, 22.5726], kolkata: [88.3639, 22.5726],
  chennai: [80.2707, 13.0827], bengaluru: [77.5946, 12.9716], bangalore: [77.5946, 12.9716],
  hyderabad: [78.4867, 17.385], pune: [73.8567, 18.5204], ahmedabad: [72.5714, 23.0225],
  surat: [72.8311, 21.1702], jaipur: [75.7873, 26.9124], lucknow: [80.9462, 26.8467],
  chandigarh: [76.7794, 30.7333], indore: [75.8577, 22.7196], kochi: [76.2673, 9.9312],
  coimbatore: [76.9558, 11.0168], nagpur: [79.0882, 21.1458], vadodara: [73.0317, 22.3072],
  kanpur: [80.3498, 26.4499], patna: [85.1432, 25.5941], bhopal: [77.4024, 23.2599],
  Visakhapatnam: [83.3416, 17.6868], ludhiana: [75.8506, 30.9009], surat: [72.8311, 21.1702]
};

const buyerPointFrom = (address) => {
  if (!address) return null;
  if (Array.isArray(address.coordinates) && address.coordinates.length === 2) {
    return { lng: Number(address.coordinates[0]), lat: Number(address.coordinates[1]) };
  }
  if (address.lat !== undefined && address.lng !== undefined) {
    return { lat: Number(address.lat), lng: Number(address.lng) };
  }
  const key = String(address.city || '').trim().toLowerCase();
  const hit = CITY_CENTRES[key];
  return hit ? { lng: hit[0], lat: hit[1] } : null;
};

export const findCandidates = async (order) => {
  const buyer = buyerPointFrom(order.shippingAddress);

  const productIds = (order.items || []).map((i) => i.product);
  const stocks = await SellerStock.find({ product: { $in: productIds }, isListed: true })
    .populate({
      path: 'seller',
      select: 'name storeName phone email location city address isBanned isActive isVerified rating totalSales'
    })
    .lean();

  const bySeller = new Map();

  for (const line of order.items || []) {
    const product = await Product.findById(line.product).select('brand category gender title').lean();
    if (!product) continue;

    const wanted = {
      color: line.variant?.color,
      size: line.variant?.size,
      quantity: line.quantity || 1
    };

    for (const stock of stocks) {
      if (!stock.seller || stock.seller.isBanned || stock.seller.isActive === false) continue;
      if (String(stock.product?._id || stock.product) !== String(line.product)) continue;
      if (!sellerHoldsConfig(stock, wanted)) continue;

      const sellerLoc = stock.seller.location?.coordinates?.length
        ? { lat: stock.seller.location.coordinates[1], lng: stock.seller.location.coordinates[0] }
        : null;
      const km = sellerLoc ? distanceKm(buyer, sellerLoc) : null;
      // No coordinates on either side keeps the seller as a fallback candidate
      // but never closer than a measured one.
      if (km !== null && km > RADIUS_KM_MAX) continue;

      const key = String(oid(stock.seller));
      const entry = bySeller.get(key) || {
        seller: stock.seller,
        sellerId: key,
        distance: km === null ? Number.MAX_SAFE_INTEGER : km,
        hasProduct: true,
        lines: [],
        priceTotal: 0,
        rating: stock.seller.rating || 0,
        totalSales: stock.seller.totalSales || 0
      };
      entry.lines.push({ product: String(oid(stock.product)), stockId: String(stock._id), price: stock.sellingPrice });
      entry.priceTotal += Number(stock.sellingPrice) * (line.quantity || 1);
      bySeller.set(key, entry);
    }
  }

  // A candidate must be able to fulfil every line of the order.
  const lineCount = (order.items || []).length;
  const full = [...bySeller.values()].filter((c) => c.lines.length >= lineCount);
  const ranked = (full.length ? full : [...bySeller.values()]).sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.priceTotal - a.priceTotal;
  });

  return ranked.slice(0, MAX_CANDIDATES).map((c) => ({
    ...c,
    // Unmeasured distances are reported as unknown rather than as a huge number.
    distance: Number.isFinite(c.distance) ? c.distance : null
  }));
};

const notifySeller = async (seller, order, routing) => {
  if (!seller?.email) return;
  const mins = Math.max(0, Math.round(((routing.timeoutAt - new Date()) / 60000)));
  await sendEmail({
    to: seller.email,
    subject: `New order offer - ${order.orderNumber}`,
    text: [
      `${seller.storeName || seller.name}, an order near you needs a seller.`,
      '',
      `Order: ${order.orderNumber}`,
      `Items: ${(order.items || []).map((i) => `${i.name} x${i.quantity}`).join(', ')}`,
      `Pick up from your store and hand over to the delivery partner.`,
      `You have ${mins} minutes to accept before it passes to the next seller.`,
      '',
      'Open your seller dashboard to accept or decline.'
    ].join('\n')
  });
};

/**
 * Start routing for a freshly placed order.
 */
export const startRouting = async (order, io = null) => {
  const candidates = await findCandidates(order);

  const routing = new OrderRouting({
    order: order._id,
    customerLocation: {
      latitude: buyerPoint(order)?.lat ?? null,
      longitude: buyerPoint(order)?.lng ?? null,
      address: [order.shippingAddress?.street, order.shippingAddress?.city, order.shippingAddress?.pincode].filter(Boolean).join(', ')
    },
    nearbySellers: candidates.map((c) => ({
      seller: c.sellerId,
      distance: c.distance,
      hasProduct: true,
      response: 'pending'
    })),
    currentSellerIndex: 0,
    status: candidates.length ? 'routing' : 'admin_required'
  });

  if (!candidates.length) {
    await Order.updateOne({ _id: order._id }, { assignmentStatus: 'admin_required' });
    return { success: true, routing, candidates: [], message: 'No nearby seller stocks this item; it is waiting in the admin queue.' };
  }

  const first = candidates[0];
  routing.currentSellerIndex = 0;
  routing.timeoutAt = new Date(Date.now() + OFFER_WINDOW_MINUTES * 60000);
  routing.nearbySellers[0].contactedAt = new Date();
  routing.status = 'seller_contacted';
  await routing.save();

  await Order.updateOne(
    { _id: order._id },
    {
      assignmentStatus: 'pending_acceptance',
      // Offered-to seller is not yet the fulfilment seller; `seller` stays as-is
      // until someone accepts.
      assignmentDeadline: routing.timeoutAt,
      assignmentDistance: first.distance,
      assignmentNotes: `Offered to ${first.seller.storeName || first.seller.name} (${first.distance ?? 'unknown'} km)`
    }
  );

  try { await notifySeller(first.seller, order, routing); } catch (e) { console.error('Offer mail failed:', e.message); }

  if (io) {
    io.to(`seller_${first.sellerId}`).emit('newOrder', {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      deadline: routing.timeoutAt
    });
  }

  return { success: true, routing, candidates };
};

/**
 * Move an unanswered offer on to the next candidate, and hand the order to the
 * admin queue once all five have failed to answer.
 */
export const advanceRouting = async (routingDoc, io = null) => {
  const order = await Order.findById(routingDoc.order);
  if (!order) return { success: false, error: 'Order not found' };

  const idx = routingDoc.nearbySellers.findIndex((s) => s.response === 'pending');
  if (idx === -1) {
    routingDoc.status = 'admin_required';
    routingDoc.timeoutAt = null;
    await routingDoc.save();
    await Order.updateOne({ _id: order._id }, { assignmentStatus: 'admin_required' });

    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: `No seller accepted order ${order.orderNumber}`,
          text: [
            `${routingDoc.nearbySellers.length} sellers were contacted and none accepted in time.`,
            'The order is waiting in the admin assignment queue with candidate contact details.'
          ].join('\n')
        });
      }
    } catch (e) { console.error('Admin escalation mail failed:', e.message); }

    return { success: true, escalated: true };
  }

  await routingDoc.populate({ path: 'nearbySellers.seller', select: 'name storeName phone email rating' });
  const target = routingDoc.nearbySellers[idx];
  routingDoc.currentSellerIndex = idx;
  routingDoc.status = 'seller_contacted';
  target.contactedAt = new Date();
  routingDoc.timeoutAt = new Date(Date.now() + OFFER_WINDOW_MINUTES * 60000);
  await routingDoc.save();

  await Order.updateOne(
    { _id: order._id },
    {
      assignmentStatus: 'pending_acceptance',
      assignmentDeadline: routingDoc.timeoutAt,
      assignmentNotes: `Offered to ${target.seller?.storeName || target.seller?.name} (${target.distance ?? 'unknown'} km)`
    }
  );

  try { await notifySeller(target.seller, order, routingDoc); } catch (e) { console.error('Offer mail failed:', e.message); }

  if (io && target.seller) {
    io.to(`seller_${target.seller._id}`).emit('newOrder', {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      deadline: routingDoc.timeoutAt
    });
  }

  return { success: true, contacted: target.seller?.storeName || target.seller?.name };
};

/**
 * A seller (or an admin on their behalf) accepts: that becomes the fulfilment
 * seller and the order moves to accepted.
 */
export const acceptRouting = async (orderId, sellerId, io = null) => {
  const routing = await OrderRouting.findOne({ order: orderId });
  if (!routing) return { success: false, error: 'This order is not in the routing queue.' };

  const entry = routing.nearbySellers.find((s) => String(oid(s.seller)) === String(sellerId));
  if (!entry) return { success: false, error: 'This order was not offered to you.' };
  if (entry.response === 'accepted') return { success: false, error: 'You already accepted this order.' };
  if (routing.timeoutAt && new Date(routing.timeoutAt) < new Date() && routing.status !== 'admin_assigned') {
    return { success: false, error: 'The acceptance window has closed; the order moved on.' };
  }

  entry.response = 'accepted';
  entry.respondedAt = new Date();
  routing.status = 'seller_accepted';
  routing.assignedSeller = sellerId;
  routing.completedAt = new Date();
  await routing.save();

  const order = await Order.findById(orderId);
  if (!order) return { success: false, error: 'Order not found' };

  order.seller = sellerId;
  order.assignmentStatus = 'accepted';
  order.acceptedAt = new Date();
  order.assignedAt = order.assignedAt || new Date();
  order.orderStatus = order.orderStatus === 'pending' ? 'confirmed' : order.orderStatus;
  await order.save();

  if (io) {
    io.to('admin_room').emit('orderUpdate', { orderId: String(orderId), status: 'accepted' });
  }

  return { success: true, order: order.orderNumber };
};

export const rejectRouting = async (orderId, sellerId, reason = '') => {
  const routing = await OrderRouting.findOne({ order: orderId });
  if (!routing) return { success: false, error: 'This order is not in the routing queue.' };

  const entry = routing.nearbySellers.find((s) => String(oid(s.seller)) === String(sellerId));
  if (!entry) return { success: false, error: 'This order was not offered to you.' };

  entry.response = 'rejected';
  entry.respondedAt = new Date();
  await routing.save();

  return advanceRouting(routing);
};

/**
 * Pick the best candidate without a human: cheapest credible seller, favouring
 * closeness and rating. Used for the "no admin available" mode.
 */
export const aiPick = (routing) => {
  const ranked = (routing.nearbySellers || [])
    .filter((s) => s.hasProduct !== false)
    .map((s) => {
      const seller = s.seller || {};
      const dist = Number.isFinite(s.distance) ? s.distance : 8;
      const price = Number(s.priceTotal ?? s.sellingPrice ?? 0);
      const rating = Number(seller.rating ?? 0);
      let score = 100;
      score -= dist * 2;
      score += rating * 6;
      score -= Math.min(price / 1000, 15);
      score += Math.min((seller.totalSales || 0) / 40, 10);
      return { entry: s, score };
    })
    .sort((a, b) => b.score - a.score);
  return ranked[0] || null;
};

/**
 * Sweep routings whose 30 minute window has elapsed and cascade them, or
 * escalate to the admin queue / AI when `auto` is on.
 */
export const sweepExpiredOffers = async (io = null) => {
  const due = await OrderRouting.find({
    status: 'seller_contacted',
    timeoutAt: { $lt: new Date() }
  }).populate('nearbySellers.seller', 'name storeName phone email rating totalSales');

  const results = [];
  for (const routing of due) {
    const stale = routing.nearbySellers.find((s) => s.response === 'pending' || !s.response);
    if (stale) stale.response = 'timeout';
    await routing.save();

    if (process.env.AI_ORDER_ASSIGNMENT === 'true') {
      await routing.populate('nearbySellers.seller', 'name storeName rating totalSales');
      const pick = aiPick(routing);
      if (pick?.entry?.seller) {
        const r = await acceptRouting(routing.order, oid(pick.entry.seller), io);
        if (r.success) {
          routing.assignedBy = 'ai';
          routing.aiDecision = `auto-selected ${pick.entry.seller.storeName || pick.entry.seller.name} (score ${pick.score.toFixed(1)})`;
          await routing.save();
          results.push({ routing: String(routing._id), aiAssigned: true });
          continue;
        }
      }
    }

    const advanced = await advanceRouting(routing, io);
    results.push({ routing: String(routing._id), escalated: !!advanced.escalated });
  }
  return { success: true, swept: due.length, results };
};

/**
 * Admin assigns a specific seller from the queue.
 */
export const adminAssign = async (orderId, sellerId, io = null, notes = '') => {
  let routing = await OrderRouting.findOne({ order: orderId });
  const order = await Order.findById(orderId);
  if (!order) return { success: false, error: 'Order not found' };

  const stock = await SellerStock.findOne({ seller: sellerId, product: order.items?.[0]?.product }).lean();

  if (!routing) {
    routing = new OrderRouting({
      order: orderId,
      nearbySellers: [{ seller: sellerId, hasProduct: !!stock, response: 'accepted' }]
    });
  }

  const entry = routing.nearbySellers.find((s) => String(oid(s.seller)) === String(sellerId));
  if (entry) { entry.response = 'accepted'; entry.respondedAt = new Date(); }
  else routing.nearbySellers.push({ seller: sellerId, hasProduct: !!stock, response: 'accepted', respondedAt: new Date() });

  routing.status = 'admin_assigned';
  routing.assignedSeller = sellerId;
  routing.assignedBy = 'admin';
  routing.completedAt = new Date();
  routing.adminNotes = notes || 'Assigned manually by admin';
  routing.timeoutAt = null;
  await routing.save();

  order.seller = sellerId;
  order.assignmentStatus = 'assigned';
  order.acceptedAt = new Date();
  if (order.orderStatus === 'pending') order.orderStatus = 'confirmed';
  await order.save();

  if (io) io.to('admin_room').emit('orderUpdate', { orderId: String(orderId), status: 'admin_assigned' });

  return { success: true, order: order.orderNumber };
};

export { OFFER_WINDOW_MINUTES, MAX_CANDIDATES, RADIUS_KM_MAX, buyerPointFrom };
