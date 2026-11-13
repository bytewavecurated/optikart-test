import Order from '../models/Order.js';
import Review from '../models/Review.js';
import ReturnRequest from '../models/ReturnRequest.js';
import Seller from '../models/Seller.js';

/**
 * Which seller should be asked to fulfil this order.
 *
 * Why this exists separately: the candidate finder in `orderProximity.js`
 * already decides *eligibility* well - exact colour and size held, powered
 * requests only to sellers who opted into prescription sales, every order line
 * covered, banned and inactive accounts excluded, distance capped. What it then
 * did with that list was sort by distance, and the auto-assign path in
 * `orderRouting.js` scored sellers on `rating`, `avgDeliveryTime` and
 * `returnRate` fields that exist on the Seller schema with a default of 0 and
 * that **nothing in the codebase ever writes**. A brand new seller and one with
 * 300 on-time deliveries looked identical to that formula, and the label on the
 * decision said AI.
 *
 * So metrics are computed here from the records that actually exist (orders,
 * returns, reviews) over a fixed window, and every candidate carries the reason
 * it was placed where it was. An admin has to be able to argue with the order
 * of this list, which is only possible if the numbers behind it are visible.
 *
 * Weights, summing to 1.00, chosen so no single factor can decide on its own:
 *
 *   speed of past delivery   0.27
 *   reliability (returns)     0.22
 *   price to the platform     0.18
 *   distance to the buyer     0.18
 *   customer rating           0.15
 *
 * Distance is deliberately not dominant: a seller 2 km away who takes six days
 * and returns a quarter of their orders is not the better choice, and a seller
 * who is slightly further but has never had a return should get the chance.
 */

const WINDOW_DAYS = 90;

const WEIGHTS = {
  speed: 0.27,
  reliability: 0.22,
  price: 0.18,
  distance: 0.18,
  rating: 0.15
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/**
 * Measured behaviour for a set of sellers, over one window, in a handful of
 * queries. Sellers with no history are reported as *unknown*, not as zero: a
 * zero return rate and a measured zero return rate are different facts, and
 * pretending otherwise would either freeze new sellers out of every order or
 * hand them a perfect score they have not earned.
 */
export const metricsForSellers = async (sellerIds, { now = new Date() } = {}) => {
  const ids = [...new Set(sellerIds.map(String))];
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const orders = await Order.find({
    seller: { $in: ids },
    createdAt: { $gte: since }
  })
    .select('seller status deliveredAt orderDate createdAt')
    .lean();

  const returns = await ReturnRequest.find({
    seller: { $in: ids },
    createdAt: { $gte: since }
  }).select('seller').lean();

  const bySeller = new Map();
  for (const id of ids) {
    bySeller.set(id, {
      sellerId: id,
      orders: 0,
      delivered: 0,
      cancelled: 0,
      deliveryDays: [],
      returns: 0,
      reviewCount: 0,
      reviewSum: 0,
      since
    });
  }

  for (const o of orders) {
    const row = bySeller.get(String(o.seller?._id || o.seller));
    if (!row) continue;
    row.orders += 1;
    if (o.status === 'delivered') {
      row.delivered += 1;
      const from = new Date(o.orderDate || o.createdAt);
      const to = new Date(o.deliveredAt);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to >= from) {
        row.deliveryDays.push((to - from) / 86400000);
      }
    } else if (o.status === 'cancelled') {
      row.cancelled += 1;
    }
  }

  for (const r of returns) {
    const row = bySeller.get(String(r.seller?._id || r.seller));
    if (row) row.returns += 1;
  }

  // Aggregate cannot match a list of string ids against an ObjectId path, so
  // ratings are read as documents and summed here.
  const reviewRows = await Review.find({ seller: { $in: ids }, createdAt: { $gte: since } })
    .select('seller rating')
    .lean();
  for (const rev of reviewRows) {
    const row = bySeller.get(String(rev.seller?._id || rev.seller));
    if (row) {
      row.reviewCount += 1;
      row.reviewSum += Number(rev.rating || 0);
    }
  }

  for (const row of bySeller.values()) {
    row.avgDeliveryDays = row.deliveryDays.length
      ? row.deliveryDays.reduce((a, b) => a + b, 0) / row.deliveryDays.length
      : null;
    row.returnPct = row.orders > 0 ? (row.returns / row.orders) * 100 : null;
    row.cancellationPct = row.orders > 0 ? (row.cancelled / row.orders) * 100 : null;
    row.avgRating = row.reviewCount > 0 ? row.reviewSum / row.reviewCount : null;
  }

  return bySeller;
};

/* Each factor answers one question on a 0-100 scale, and `null` (no history)
 * becomes NEUTRAL rather than 0, so a new seller is not ranked as though they
 * had delivered badly or never been reviewed. */
const NEUTRAL = 55;

const speedScore = (days) => {
  if (days === null || days === undefined) return NEUTRAL;
  if (days <= 1) return 100;
  if (days >= 7) return 0;
  return 100 * (1 - (days - 1) / 6);
};

const reliabilityScore = (returnPct) => {
  if (returnPct === null || returnPct === undefined) return NEUTRAL;
  if (returnPct <= 2) return 100;
  if (returnPct >= 25) return 0;
  return 100 * (1 - (returnPct - 2) / 23);
};

const ratingScore = (avg) => (avg === null || avg === undefined ? NEUTRAL : (avg / 5) * 100);

const distanceScore = (km, radiusKm) => {
  if (km === null || km === undefined || !Number.isFinite(km)) return NEUTRAL - 15;
  if (km <= 0) return 100;
  if (km >= radiusKm) return 0;
  return 100 * (1 - km / radiusKm);
};

/**
 * Rank eligible candidates.
 *
 * `candidates` come from the eligibility finder and each carries `seller`,
 * `distance` and `priceTotal`. Sellers who cannot cover every line of the order
 * are pushed below the ones who can, rather than dropped, because the finder
 * already decided partial coverage is better than no candidate at all - that
 * judgement belongs to eligibility, not to ranking.
 */
export const rankCandidates = async (candidates, { radiusKm = 10, completeCoverage = true } = {}) => {
  if (!candidates?.length) return [];

  const metrics = await metricsForSellers(candidates.map((c) => c.sellerId || c.seller?._id || c.seller));

  const prices = candidates.map((c) => Number(c.priceTotal) || 0).filter((p) => p > 0);
  const cheapest = prices.length ? Math.min(...prices) : 0;
  const dearest = prices.length ? Math.max(...prices) : 0;

  const scored = candidates.map((c) => {
    const m = metrics.get(String(c.sellerId || c.seller?._id || c.seller)) || {};
    const price = Number(c.priceTotal) || 0;
    const priceScore = dearest > cheapest
      ? 100 * (1 - (price - cheapest) / (dearest - cheapest))
      : 80;

    const factors = {
      speed: speedScore(m.avgDeliveryDays),
      reliability: reliabilityScore(m.returnPct),
      price: priceScore,
      distance: distanceScore(c.distance, radiusKm),
      rating: ratingScore(m.avgRating)
    };

    const score = Object.entries(factors)
      .reduce((sum, [key, value]) => sum + value * WEIGHTS[key], 0);

    const reasons = [];
    reasons.push(m.avgDeliveryDays === null
      ? 'No delivery in the last 90 days, so speed is unknown'
      : `Usually delivers in ${m.avgDeliveryDays.toFixed(1)} days (${m.delivered} orders)`);
    reasons.push(m.returnPct === null
      ? 'No returns recorded yet'
      : `${m.returnPct.toFixed(1)}% of orders ended in a return`);
    reasons.push(c.distance === null || c.distance === undefined
      ? 'Distance to the buyer is not measured'
      : `${c.distance.toFixed(1)} km from the buyer`);
    const tiedCheapest = prices.filter((x) => x === cheapest).length > 1;
    reasons.push(price === cheapest
      ? (tiedCheapest
        ? `Tied for cheapest at ${inr(price)}`
        : `Cheapest of the candidates at ${inr(price)}`)
      : `Quotes ${inr(price)}`);
    reasons.push(m.avgRating === null
      ? 'Not rated by customers in the last 90 days'
      : `Rated ${m.avgRating.toFixed(1)} from ${m.reviewCount} review${m.reviewCount === 1 ? '' : 's'}`);
    if (completeCoverage && c.coverage && !c.coverage.complete) {
      reasons.push(`Covers ${c.coverage.have} of ${c.coverage.need} lines, so it is ranked below full-cover sellers`);
    }

    return {
      ...c,
      score: Math.round(score * 10) / 10,
      scoreFactors: Object.fromEntries(
        Object.entries(factors).map(([k, v]) => [k, Math.round(v * 10) / 10])
      ),
      scoreReasons: reasons,
      measured: {
        orders: m.orders ?? 0,
        delivered: m.delivered ?? 0,
        avgDeliveryDays: m.avgDeliveryDays === null ? null : Math.round(m.avgDeliveryDays * 10) / 10,
        returnPct: m.returnPct === null ? null : Math.round(m.returnPct * 10) / 10,
        avgRating: m.avgRating === null ? null : Math.round(m.avgRating * 10) / 10,
        reviewCount: m.reviewCount ?? 0,
        windowDays: WINDOW_DAYS
      },
      _coveragePenalty: completeCoverage && c.coverage && !c.coverage.complete ? 1 : 0
    };
  });

  scored.sort((a, b) => {
    if (a._coveragePenalty !== b._coveragePenalty) return a._coveragePenalty - b._coveragePenalty;
    if (b.score !== a.score) return b.score - a.score;
    // Ties break on distance, then on price, so the list is reproducible.
    const da = Number.isFinite(a.distance) ? a.distance : 1e9;
    const db = Number.isFinite(b.distance) ? b.distance : 1e9;
    if (da !== db) return da - db;
    return (Number(a.priceTotal) || 0) - (Number(b.priceTotal) || 0);
  });

  return scored.map(({ _coveragePenalty, ...c }, i) => ({ ...c, rank: i + 1 }));
};

/** Sellers whose own stored flags disagree with reality, for reporting only. */
export const staleSellerFlags = async (sellerIds) => {
  const docs = await Seller.find({ _id: { $in: sellerIds } })
    .select('name storeName rating avgDeliveryTime returnRate')
    .lean();
  return docs.filter((d) => (d.avgDeliveryTime || 0) === 0 && (d.returnRate || 0) === 0)
    .map((d) => String(d._id));
};

export const RANKING_WEIGHTS = WEIGHTS;
export const RANKING_WINDOW_DAYS = WINDOW_DAYS;
