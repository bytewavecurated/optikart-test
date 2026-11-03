/**
 * Delivery route planning for partners carrying more than one run.
 *
 * Two things used to make this unusable: it read the partner's position as
 * `currentLocation.coordinates[1]` while the schema stores
 * `{ latitude, longitude }`, and it looked for orders on `order.deliveryPartner`
 * with a `deliveryStatus`, neither of which exists - the real fields are
 * `assignedDeliveryPartner` and `orderStatus`. Both are corrected here, and the
 * duplicated Haversine implementation is replaced by the shared geo helper.
 */
import Order from '../models/Order.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import { pointOf, kmBetween } from './partnerDispatch.js';

/** City driving plus the walk-up and doorbell time at each stop. */
const AVERAGE_SPEED_KMH = 25;
const MINUTES_PER_STOP = 6;

const estimateMinutes = (distanceKm) => Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60 + MINUTES_PER_STOP);

/** The drop-off point of an order, or null when the address has no coordinates. */
const dropOf = (order) => pointOf(order?.deliveryLocation) || pointOf(order?.shippingAddress?.coordinates) || pointOf(order?.shippingAddress);

/**
 * Orders the partner is carrying right now, in the state that means they are
 * physically holding the parcels.
 */
const carryings = async (partnerId) =>
  Order.find({
    assignedDeliveryPartner: partnerId,
    orderStatus: { $in: ['packed', 'picked_up', 'in_transit'] }
  })
    .populate('user', 'name phone')
    .sort({ createdAt: 1 })
    .lean();

const asStop = (order, from, priority) => {
  const at = dropOf(order);
  const distance = at && from ? kmBetween(from, at) : null;
  return {
    order,
    at,
    distance,
    estimatedMinutes: distance === null ? null : estimateMinutes(distance),
    priority,
    createdAt: order.createdAt
  };
};

/**
 * Nearest-neighbour order over the runs the partner is carrying. Stops without
 * usable coordinates are kept at the end rather than dropped: an address that
 * cannot be geocoded is still a delivery that has to be made.
 */
export const optimizeRoute = async (partnerId) => {
  try {
    const partner = await DeliveryPartner.findById(partnerId).lean();
    const start = pointOf(partner?.currentLocation);
    if (!start) {
      return { success: false, error: 'Turn on location sharing so the route can be planned from where you actually are.' };
    }

    const orders = await carryings(partnerId);
    if (!orders.length) {
      return {
        success: true,
        message: 'No deliveries in hand right now',
        data: { optimizedRoute: [], metrics: { totalDistance: 0, totalTime: 0, totalDeliveries: 0 }, recommendations: [] }
      };
    }

    const located = [];
    const unresolved = [];
    for (const order of orders) {
      const priority = order.orderStatus === 'picked_up' ? 1 : 2;
      const stop = asStop(order, start, priority);
      (stop.at ? located : unresolved).push(stop);
    }

    const route = [];
    let cursor = start;
    let totalDistance = 0;
    let totalTime = 0;

    while (located.length) {
      let best = 0;
      let bestScore = Infinity;
      located.forEach((stop, index) => {
        const leg = kmBetween(cursor, stop.at);
        if (leg === null) return;
        // Picked-up parcels are already in the bag and owed first, so their
        // distance is discounted rather than the list being guessed at.
        const score = leg * (stop.priority === 1 ? 0.8 : 1);
        if (score < bestScore) { bestScore = score; best = index; }
      });

      const [next] = located.splice(best, 1);
      const leg = next.distance !== null && cursor === next.at ? 0 : kmBetween(cursor, next.at);
      const minutes = leg === null ? MINUTES_PER_STOP : estimateMinutes(leg);
      route.push({
        sequenceNumber: route.length + 1,
        orderId: String(next.order._id),
        orderNumber: next.order.orderNumber,
        customerName: next.order.user?.name || 'Customer',
        phone: next.order.user?.phone || '',
        address: next.order.deliveryLocation?.address
          || [next.order.shippingAddress?.street, next.order.shippingAddress?.city, next.order.shippingAddress?.pincode].filter(Boolean).join(', '),
        coordinates: next.at,
        status: next.order.orderStatus,
        distanceFromPreviousKm: leg === null ? null : Math.round(leg * 100) / 100,
        minutesFromPrevious: minutes,
        earnings: Math.round((next.order.deliveryFee || 0) * 100) / 100
      });
      totalDistance += leg || 0;
      totalTime += minutes;
      cursor = next.at;
    }

    for (const stop of unresolved) {
      route.push({
        sequenceNumber: route.length + 1,
        orderId: String(stop.order._id),
        orderNumber: stop.order.orderNumber,
        customerName: stop.order.user?.name || 'Customer',
        address: [stop.order.shippingAddress?.street, stop.order.shippingAddress?.city, stop.order.shippingAddress?.pincode].filter(Boolean).join(', '),
        coordinates: null,
        status: stop.order.orderStatus,
        distanceFromPreviousKm: null,
        minutesFromPrevious: null,
        needsAddressFix: true
      });
    }

    const deliveries = route.length;
    return {
      success: true,
      data: {
        optimizedRoute: route,
        metrics: {
          totalDistance: Math.round(totalDistance * 100) / 100,
          totalTime: Math.round(totalTime),
          totalDeliveries: deliveries,
          avgDistancePerDelivery: deliveries ? Math.round((totalDistance / deliveries) * 100) / 100 : 0,
          avgMinutesPerDelivery: deliveries ? Math.round(totalTime / deliveries) : 0,
          totalEarnings: Math.round(route.reduce((sum, r) => sum + (r.earnings || 0), 0) * 100) / 100
        },
        recommendations: generateRecommendations(route, totalDistance, totalTime)
      }
    };
  } catch (error) {
    console.error('Route optimization error:', error);
    return { success: false, error: error.message };
  }
};

/** Advice worth showing, derived only from what was actually measured. */
const generateRecommendations = (route, totalDistance, totalTime) => {
  const out = [];
  const unresolved = route.filter((r) => r.needsAddressFix).length;
  if (unresolved) {
    out.push({ type: 'address', priority: 'high', message: `${unresolved} stop(s) have no usable coordinates, so they are listed last - confirm the address before setting off.` });
  }
  if (totalTime > 240) {
    out.push({ type: 'time', priority: 'high', message: 'This route is over 4 hours of riding. Consider splitting it into two trips.' });
  }
  if (totalDistance > 60) {
    out.push({ type: 'distance', priority: 'high', message: 'More than 60 km in one run. Plan fuel and a break.' });
  }
  if (route.length > 10) {
    out.push({ type: 'volume', priority: 'medium', message: `${route.length} stops. Batching the same-building deliveries saves the most time.` });
  }
  const urgent = route.filter((r) => r.status === 'picked_up').length;
  if (urgent) {
    out.push({ type: 'priority', priority: 'medium', message: `${urgent} parcel(s) are already collected and go first.` });
  }
  return out;
};

/**
 * Live ETAs from wherever the partner currently is. Stops that cannot be
 * measured are reported as unknown instead of silently inheriting the partner's
 * own position.
 */
export const getRouteUpdates = async (partnerId, currentLat, currentLon) => {
  try {
    const from = pointOf({ lat: Number(currentLat), lng: Number(currentLon) });
    if (!from) return { success: false, error: 'Current position must be a usable latitude and longitude.' };

    const orders = await carryings(partnerId);
    const updates = orders.map((order) => {
      const at = dropOf(order);
      const distance = at ? kmBetween(from, at) : null;
      return {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        customerName: order.user?.name || 'Customer',
        address: [order.shippingAddress?.street, order.shippingAddress?.city, order.shippingAddress?.pincode].filter(Boolean).join(', '),
        distance: distance === null ? null : Math.round(distance * 100) / 100,
        etaMinutes: distance === null ? null : estimateMinutes(distance),
        status: order.orderStatus
      };
    });
    return { success: true, data: updates };
  } catch (error) {
    console.error('Route updates error:', error);
    return { success: false, error: error.message };
  }
};

export default { optimizeRoute, getRouteUpdates };
