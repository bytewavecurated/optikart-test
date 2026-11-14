/**
 * Partner dispatch: who gets asked for a run, in what order, and what happens
 * when nobody answers.
 *
 * A seller packing a parcel is the moment the run becomes real, so the cascade
 * starts there. The three nearest available partners are offered it one at a
 * time with a half-hour window each; a decline or an expired window moves to the
 * next; when the list runs out, the order waits in the admin queue with the
 * ranking we computed rather than silently never being delivered.
 */
import Order from '../models/Order.js';
import Seller from '../models/Seller.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import { haversineKm, resolvePincode } from './geo.js';
import { assignDeliveryPartner } from './deliveryPartner.js';
import { sendEmail } from './email.js';

export const PARTNER_OFFER_WINDOW_MINUTES = 30;
export const PARTNER_RECOMMENDATION_COUNT = 3;
export const PARTNER_RATE_PER_KM = 10;
/*
 * A bicycle run has to stay local. Without this ceiling the ranking priced a
 * Mumbai store shipping to a Kolkata buyer at ₹16,548 (1,654 km x ₹10/km) and
 * offered it to the partner standing next to the shop. Anything longer is a
 * courier job, so it goes to the admin instead of the offer queue.
 */
/*
 * The two distances that decide whether a run is a bicycle job at all.
 *
 * PARTNER_PICKUP_RADIUS_KM (4.5) is how far a partner may be from the STORE and
 * still be asked to come and collect. The number being paid is ₹10 per km of the
 * delivery leg, not of the trip to the shop, so a partner 20 km away would spend
 * fuel and an hour reaching a counter for a run that pays them a few rupees -
 * which is why offering to them is not a courtesy but a bad instruction. Beyond
 * this radius nobody is asked and the run goes to the desk instead.
 *
 * MAX_DELIVERY_LEG_KM (23) is the longest store-to-buyer distance a partner is
 * given. It replaced 60 km: at the ₹10/km rate a 60 km lead pays ₹600 for a
 * single hand-over and keeps the buyer waiting a day, and a Mumbai-to-Kolkata
 * parcel was previously only rejected because it exceeded that ceiling. Anything
 * longer than 23 km is a courier job, and saying so at assignment time is what
 * stops a partner accepting run they cannot finish.
 *
 * Both are overridable by environment for a city where the geography differs;
 * an unset or unusable value falls back to the two above rather than to zero,
 * because a zero radius means "ask nobody, ever" and reads like a broken
 * dispatch engine.
 */
const positiveNumber = (raw, fallback) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const PARTNER_PICKUP_RADIUS_KM = positiveNumber(process.env.PARTNER_PICKUP_RADIUS_KM, 4.5);
export const MAX_DELIVERY_LEG_KM = positiveNumber(process.env.MAX_DELIVERY_LEG_KM, 23);

// Historical name kept as an alias so no call site can keep a stale copy of the
// ceiling. It is the same number, by definition, and drift between the two
// would mean the manual assignment path and the cascade disagree about what is
// deliverable - the exact class of bug this file has already been bitten by.
export const PARTNER_MAX_LEAD_KM = MAX_DELIVERY_LEG_KM;

/** One coordinate pair, whatever shape the caller had. */
export const pointOf = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    const [lng, lat] = value;
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  if (typeof value !== 'object') return null;
  if (Number.isFinite(value.lat) && Number.isFinite(value.lng)) return { lat: value.lat, lng: value.lng };
  if (Number.isFinite(value.latitude) && Number.isFinite(value.longitude)) {
    return { lat: value.latitude, lng: value.longitude };
  }
  if (value.type === 'Point' && Array.isArray(value.coordinates)) {
    const [lng, lat] = value.coordinates;
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  const pin = value.pincode || value.zip;
  if (pin) {
    const found = resolvePincode(String(pin));
    if (found) return { lat: found.lat, lng: found.lng };
  }
  return null;
};

export const kmBetween = (a, b) => haversineKm(a, b);

/** Where the partner collects from: recorded pick-up point, then the seller. */
const storePoint = async (order) => {
  const direct = pointOf(order?.pickupLocation) || pointOf(order?.seller?.address) || pointOf(order?.seller?.location);
  if (direct) return direct;
  const sellerId = order?.seller?._id ? order.seller._id : order?.seller;
  if (!sellerId || typeof sellerId !== 'object') return null;
  const seller = await Seller.findById(sellerId).select('address location').lean();
  return pointOf(seller?.address) || pointOf(seller?.location);
};

const dropPoint = (order) =>
  pointOf(order?.deliveryLocation)
  || pointOf(order?.shippingAddress?.coordinates)
  || pointOf(order?.shippingAddress);

/** The paid leg: store to door, or null when either end is unknown. */
export const leadKm = async (order) => {
  const from = await storePoint(order);
  const to = dropPoint(order);
  const measured = from && to ? kmBetween(from, to) : null;
  if (measured && measured > 0) return measured;
  const recorded = Number(order?.deliveryDistanceKm);
  if (Number.isFinite(recorded) && recorded > 0) return recorded;
  // Same-city collection and drop measured 0 km apart is still a real run:
  // charge the one-kilometre minimum rather than nothing.
  return from && to ? 1 : null;
};

const describe = (order) => ({
  orderId: String(order._id),
  orderNumber: order.orderNumber,
  pickup: order.pickupLocation?.address || order.seller?.address?.street || order.seller?.storeName || '',
  drop: [order.shippingAddress?.street, order.shippingAddress?.city, order.shippingAddress?.pincode].filter(Boolean).join(', ')
});

/**
 * Rank available partners by distance from the store. An empty result with
 * `storeLocationUnknown` is honest: without a store position there is nothing to
 * rank, and guessing would send a partner to the wrong address.
 */
export const recommendPartners = async (orderOrId, { radiusKm = 12, limit = PARTNER_RECOMMENDATION_COUNT } = {}) => {
  try {
    // Callers pass either an id or a document, and the document is not always
    // populated - without the seller's store position there is nothing to rank
    // partners against, so hydrate here rather than reporting "unknown".
    const order = orderOrId?.seller?._id ? orderOrId : await asOrder(orderOrId);
    if (!order) return { success: false, error: 'Order not found' };

    const from = await storePoint(order);
    if (!from) {
      return { success: true, storeLocationUnknown: true, message: 'The seller store has no usable position, so nearby partners cannot be ranked. Assign a partner manually.', recommendations: [] };
    }

    const pool = await DeliveryPartner.find({ isActive: true, isBanned: false, isAvailable: true, currentOrder: null }).lean();
    const to = dropPoint(order);
    const leg = to ? kmBetween(from, to) : null;

    const recommendations = pool
      .map((p) => ({ partner: p, at: pointOf(p.currentLocation) || pointOf({ lat: p.currentLocation?.latitude, lng: p.currentLocation?.longitude }) }))
      .filter((x) => x.at)
      .map((x) => ({
        partnerId: x.partner._id,
        name: x.partner.name,
        phone: x.partner.phone,
        email: x.partner.email,
        vehicleType: x.partner.vehicleType,
        distance: kmBetween(from, x.at),
        rating: x.partner.rating || 0
      }))
      .filter((r) => Number.isFinite(r.distance) && r.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance || b.rating - a.rating)
      .slice(0, limit)
      .map((r) => ({ ...r, earning: Math.round((leg ? leg : 1) * PARTNER_RATE_PER_KM * 100) / 100 }));

    return { success: true, store: from, leadKm: leg, radiusKm, recommendations, excluded: pool.length - recommendations.length };
  } catch (error) {
    console.error('Partner recommendation error:', error);
    return { success: false, error: error.message, recommendations: [] };
  }
};

/** Move to the next unanswered partner, escalating to the admin when none are left. */
export const advanceQueue = async (order, io = null) => {
  const queue = order.partnerQueue || [];
  const nextIndex = queue.findIndex((q) => (q.response || 'pending') === 'pending');

  if (nextIndex === -1) {
    order.partnerDecision = 'admin_required';
    order.partnerQueueDeadline = null;
    await order.save();
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: `No delivery partner accepted ${order.orderNumber}`,
          text: `All ${queue.length} recommended partners were offered this run and none answered within ${PARTNER_OFFER_WINDOW_MINUTES} minutes. It is waiting in the admin console with their contact details.`
        });
      }
    } catch (e) { console.error('Partner escalation mail failed:', e.message); }
    return { success: true, escalated: true, message: 'No partner accepted; awaiting admin assignment.' };
  }

  const entry = queue[nextIndex];
  const leg = await leadKm(order);
  if (leg !== null && leg > PARTNER_MAX_LEAD_KM) {
    order.partnerDecision = 'admin_required';
    order.partnerQueueDeadline = null;
    order.deliveryDistanceKm = Math.round(leg * 100) / 100;
    (order.deliveryJourney || (order.deliveryJourney = [])).push({
      status: order.orderStatus,
      note: `${Math.round(leg)} km from the store is beyond a local delivery run; handed to admin for courier.`,
      at: new Date()
    });
    await order.save();
    return { success: true, escalated: true, tooFar: true, distanceKm: Math.round(leg * 100) / 100, message: `This run is ${Math.round(leg)} km, further than a partner delivery (${PARTNER_MAX_LEAD_KM} km). It is with the admin to send by courier.` };
  }

  entry.offeredAt = new Date();
  order.partnerCurrentIndex = nextIndex;
  order.partnerDecision = 'offering';
  order.partnerQueueDeadline = new Date(Date.now() + PARTNER_OFFER_WINDOW_MINUTES * 60000);
  order.deliveryDistanceKm = leg ?? order.deliveryDistanceKm ?? 0;
  order.deliveryFee = leg === null ? 0 : Math.round(leg * PARTNER_RATE_PER_KM * 100) / 100;
  await order.save();

  const partner = await DeliveryPartner.findById(entry.partner).select('name email phone').lean();
  if (partner?.email) {
    try {
      const info = describe(order);
      await sendEmail({
        to: partner.email,
        subject: `Delivery offer - ${info.orderNumber}`,
        text: [
          `A delivery near you needs a partner in the next ${PARTNER_OFFER_WINDOW_MINUTES} minutes.`,
          `Order: ${info.orderNumber}`,
          `Pick up: ${info.pickup}`,
          `Drop: ${info.drop}`,
          `Distance: ${order.deliveryDistanceKm} km, paying ₹${order.deliveryFee}.`,
          `Open your partner dashboard to accept or decline.`
        ].join('\n')
      });
    } catch (e) { console.error('Partner offer mail failed:', e.message); }
  }

  if (io) io.to(`partner:${entry.partner}`).emit('partner:offer', describe(order));
  return {
    success: true,
    offered: partner?._id,
    offeredName: partner?.name,
    queuePosition: nextIndex + 1,
    queueLength: queue.length,
    deadline: order.partnerQueueDeadline
  };
};

/** Start (or restart) the cascade for an order. */
/** A saved document from whatever the caller had: id, ObjectId, or document. */
const asOrder = async (orderOrId) => {
  const id = typeof orderOrId === 'string' ? orderOrId : (orderOrId?._id || orderOrId);
  return Order.findById(id).populate('seller', 'storeName phone address location');
};

export const offerQueue = async (orderOrId, io = null) => {
  // Always work with the saved document: passing a bare id straight through as
  // if it were the order blew up on the first `order.save()`, because an
  // ObjectId has no save method.
  const order = await asOrder(orderOrId);
  if (!order) return { success: false, error: 'Order not found' };

  if (order.partnerQueue?.length && order.partnerDecision === 'accepted') return { success: true, alreadyAssigned: true };

  if (!order.partnerQueue?.length) {
    const rec = await recommendPartners(order);
    if (!rec.success) return { success: false, error: rec.error };
    if (rec.storeLocationUnknown || !rec.recommendations.length) {
      order.partnerDecision = 'admin_required';
      await order.save();
      return { success: true, escalated: true, storeLocationUnknown: !!rec.storeLocationUnknown, message: rec.storeLocationUnknown ? rec.message : 'No partner is available within the search radius. Assign one manually.', recommendations: [] };
    }
    order.partnerQueue = rec.recommendations.map((r) => ({
      partner: r.partnerId, distanceKm: r.distance, offeredAt: null, respondedAt: null, response: 'pending'
    }));
    order.partnerDecision = '';
    await order.save();
  }

  return advanceQueue(order, io);
};

/** A partner answering an offer. */
export const acceptOffer = async (orderId, partnerId, io = null) => {
  const order = await Order.findById(orderId);
  if (!order) return { success: false, error: 'Order not found' };
  const entry = (order.partnerQueue || []).find((q) => String(q.partner) === String(partnerId));
  if (!entry) return { success: false, expired: false, error: 'This run was not offered to you.' };
  if (entry.response === 'accepted') return { success: true, already: true };
  if (entry.response === 'rejected') return { success: false, expired: true, error: 'You already declined this run.' };
  if (order.partnerQueueDeadline && order.partnerQueueDeadline.getTime() < Date.now()) {
    return { success: false, expired: true, error: 'That offer has expired.' };
  }

  const assigned = await assignDeliveryPartner(order._id, partnerId, 'partner_accepted');
  if (!assigned.success) return { success: false, error: assigned.error };

  /*
   * assignDeliveryPartner loads and saves its own copy of this order, so the
   * document taken before it ran is now a stale version and saving it fails with
   * a version conflict - the run was assigned, while the partner was told the
   * offer was no longer available. Re-read, then settle the queue on the fresh
   * copy.
   */
  const fresh = await Order.findById(order._id);
  const mine = (fresh?.partnerQueue || []).find((q) => String(q.partner) === String(partnerId));
  if (mine) {
    mine.response = 'accepted';
    mine.respondedAt = new Date();
  }
  fresh.partnerDecision = 'accepted';
  fresh.partnerQueueDeadline = null;
  await fresh.save();
  if (io) io.to(`partner:${partnerId}`).emit('partner:assigned', describe(order));
  return { success: true, message: 'Run accepted. Pickup details are on your dashboard.', order: assigned.order };
};

/** Close windows nobody answered, so a run cannot sit unclaimed indefinitely. */
export const sweepExpiredPartnerOffers = async (io = null) => {
  const due = await Order.find({ partnerDecision: 'offering', partnerQueueDeadline: { $lt: new Date() } })
    .populate('seller', 'storeName address location');
  for (const order of due) {
    const entry = order.partnerQueue?.[order.partnerCurrentIndex];
    if (entry && (entry.response || 'pending') === 'pending') {
      entry.response = 'expired';
      entry.respondedAt = new Date();
    }
    await advanceQueue(order, io);
  }
  return due.length;
};
