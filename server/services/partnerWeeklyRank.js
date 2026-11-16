import Order from '../models/Order.js';
import DeliveryPartner from '../models/DeliveryPartner.js';

/**
 * Weekly delivery-partner ranking, Rapido-style: measured actions decide the
 * order of the queue, and nothing is scored that nobody writes.
 *
 * Deliberately absent from every formula: `rating`, `totalEarnings`,
 * `avgDeliveryTime`, `returnRate`. Those fields exist on the partner documents
 * with a default and nothing maintains them, so scoring on them would rank
 * partners by a number that is quietly always the same value. The same trap was
 * found in the seller ranking earlier this session - it is asserted against
 * here rather than commented, and `scripts/partner_ranking_unit.mjs` scans the
 * source of this file to enforce it.
 *
 * Everything that IS scored comes from Order, which the delivery flow actually
 * writes: `orderStatus`/`deliveredAt`/`assignedDeliveryPartner` for completed
 * runs; `partnerQueue[].{partner,response,offeredAt,respondedAt}` for offers
 * this partner was actually asked about; `cashCollected` versus `totalAmount`
 * for cash integrity on delivered COD orders; and `orderStatus: 'cancelled'`
 * while assigned to a cancellation.
 *
 * Windows come in as an explicit instant or an ISO week label. `Date.now()`
 * is used only when neither is supplied. `at` being a parameter is what makes
 * window arithmetic testable under a frozen clock.
 */

const DAY = 86400000;
const WEEK = 7 * DAY;
const HOUR = 3600000;

/** Weights sum to 1; the unit test asserts it, so adding a 4th component fails loudly. */
export const RANK_WEIGHTS = { reliability: 0.45, throughput: 0.3, cashIntegrity: 0.25 };

/**
 * Cash tolerance in rupees: a partner is not penalised for legitimately
 * holding back the platform's ₹39 cash-handling fee. Anything beyond that is a
 * real gap in the envelope and lowers the score.
 */
export const COD_TOLERANCE_RUPEE = Math.max(0, Number(process.env.PARTNER_RANK_COD_TOLERANCE_RUPEE ?? 1) || 0);

/** An offer left unanswered is neither a refusal nor a success: it weighs as half a miss. */
export const UNANSWERED_PENALTY = 0.5;

/** India default: the week is a working week on local time, not UTC. */
export const DEFAULT_TZ_OFFSET_MINUTES = Number(process.env.PARTNER_RANK_TZ_OFFSET_MINUTES ?? 330);

const idOf = (v) => (v && v._id ? String(v._id) : v === null || v === undefined ? '' : String(v));
/*
 * Dates, numbers and strings all arrive here, and they must all be read the
 * same way: a millisecond number is an instant, not something for Date.parse,
 * which returns NaN for numbers and made window arithmetic throw on every
 * numeric call while working fine in the string-shaped tests that came first.
 */
const toMs = (v) => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') { const n = Date.parse(v); return Number.isFinite(n) ? n : null; }
  return null;
};
const pad2 = (n) => String(n).padStart(2, '0');
const clampRatio = (num, den) => (den > 0 ? Math.max(0, Math.min(1, num / den)) : null);

/**
 * Monday of the UTC day containing `ms` (or the UTC day itself when a UTC
 * milliseconds value falls exactly on midnight).
 */
const utcMondayMs = (ms) => {
  const d = new Date(ms);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = (new Date(midnight).getUTCDay() + 6) % 7;
  return midnight - dow * DAY;
};

/**
 * ISO-8601 week of an instant: Monday-based, and the year is the ISO year - the
 * year that owns the week's Thursday. That is what makes the last days of
 * December belong to the previous ISO year (or the first days of January belong
 * to the last ISO week), and a label derived any other way would not survive a
 * year boundary.
 */
export function isoWeekWindow(at, { tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES } = {}) {
  const instMs = toMs(at);
  if (instMs === null) throw new RangeError('A valid instant is required to resolve an ISO week.');
  const offset = tzOffsetMinutes * 60000;
  const monday = utcMondayMs(instMs + offset);
  const isoYear = new Date(monday + 3 * DAY).getUTCFullYear();
  const week1Monday = utcMondayMs(Date.UTC(isoYear, 0, 4));
  const week = 1 + Math.round((monday - week1Monday) / WEEK);
  if (!Number.isInteger(week) || week < 1 || week > 53) {
    throw new RangeError(`ISO week computed out of range for ${new Date(instMs).toISOString()} (${week})`);
  }
  return {
    label: `${isoYear}-W${pad2(week)}`,
    week, isoYear, tzOffsetMinutes,
    start: monday - offset,
    end: monday + WEEK - offset,
    // Echo of the instant the window was asked for, so callers can prove nothing silently drifted to `Date.now()`.
    computedFrom: new Date(instMs).toISOString()
  };
}

/** How many ISO weeks a year has (52 or 53) - used to explain a rejected label. */
const echoWeekCount = (year) => {
  /*
   * Dec 28 is the anchor the ISO standard itself uses: every ISO year's last
   * week contains that year's Dec 28, whereas Dec 31 may already belong to the
   * following ISO year. Asking about Dec 31 returned "2025 ends at week 1" - an
   * answer that was the week number of 2026-W01, and a rejection message that
   * contradicted itself.
   */
  return Number(isoWeekWindow(Date.UTC(Number(year), 11, 28) + HOUR, { tzOffsetMinutes: 0 }).week);
};

/** The real window behind a `YYYY-Www` label. Rejects labels that no calendar has. */
export function windowFromLabel(label, { tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES } = {}) {
  const parts = /^(\d{4})-W(\d{2})$/.exec(String(label ?? '').trim().toUpperCase());
  if (!parts) throw new RangeError('week must look like 2026-W53');
  const isoYear = Number(parts[1]);
  const week = Number(parts[2]);
  if (week < 1 || week > 53) throw new RangeError(`week must be 01..53 (got ${label})`);
  const monday = utcMondayMs(Date.UTC(isoYear, 0, 4)) + (week - 1) * WEEK;
  /*
   * The label is validated by rebuilding it from the Monday it claims to start.
   * Asking for 2026-W54 should be told 2026 ends at week 53, rather than being
   * quietly read as a window in the following year and ranking an empty week.
   */
  const echo = isoWeekWindow(monday + HOUR, { tzOffsetMinutes: 0 });
  if (echo.label !== `${parts[1]}-W${pad2(week)}`) {
    throw new RangeError(`"${label}" is not a real ISO week (${parts[1]} ends at week ${echoWeekCount(parts[1])})`);
  }
  const offset = tzOffsetMinutes * 60000;
  return { label: `${parts[1]}-W${pad2(week)}`, week, isoYear, tzOffsetMinutes, start: monday - offset, end: monday + WEEK - offset };
}


export function addWeeksToLabel(label, weeks, opts = {}) {
  const w = windowFromLabel(label, { tzOffsetMinutes: 0, ...opts });
  return isoWeekWindow(w.start + weeks * WEEK + HOUR, opts).label;
}

export function previousWeekLabel(label, opts = {}) { return addWeeksToLabel(label, -1, opts); }
export function nextWeekLabel(label, opts = {}) { return addWeeksToLabel(label, 1, opts); }

/**
 * Everything one partner did, measured only within `window`, and only events
 * addressed to that partner. Per-partner isolation is asserted in tests: a
 * refusal recorded against partner B must never stain partner A.
 */
export function collectPartnerEvents(rows, partnerId, window) {
  const pid = idOf(partnerId);
  const inWindow = (ms) => ms !== null && ms >= window.start && ms < window.end;
  const e = {
    partnerId: pid, completed: 0, codDeliveries: 0, codChecked: 0, codDiscrepancies: 0,
    codUnrecorded: 0, rejections: 0, expiries: 0, unanswered: 0, cancellationsWhileAssigned: 0,
    completedOrderIds: [], discrepancyOrderIds: [], unrecordedOrderIds: []
  };
  for (const o of rows || []) {
    const assigned = idOf(o.assignedDeliveryPartner);
    const status = String(o.orderStatus || '').toLowerCase();
    const oid = idOf(o._id);
    if (assigned === pid && status === 'delivered' && inWindow(toMs(o.deliveredAt))) {
      e.completed++; if (oid) e.completedOrderIds.push(oid);
      if (String(o.paymentMethod) === 'cod') {
        e.codDeliveries++;
        const collected = Number(o.cashCollected);
        const total = Number(o.totalAmount);
        if (!Number.isFinite(collected) || collected <= 0) {
          // Nothing recorded is not "no discrepancy": it is unmeasurable, so it
          // is kept out of the integrity denominator and named instead of hidden.
          e.codUnrecorded++; if (oid) e.unrecordedOrderIds.push(oid);
        } else {
          e.codChecked++;
          if (Number.isFinite(total) && Math.abs(collected - total) > COD_TOLERANCE_RUPEE) {
            e.codDiscrepancies++; if (oid) e.discrepancyOrderIds.push(oid);
          }
        }
      }
    } else if (assigned === pid && status === 'cancelled'
      && inWindow(toMs(o.partnerCancelledAt ?? o.updatedAt))) {
      e.cancellationsWhileAssigned++;
    }
    for (const q of o.partnerQueue || []) {
      if (idOf(q.partner) !== pid) continue;
      const responded = toMs(q.respondedAt);
      const offered = toMs(q.offeredAt);
      const resp = String(q.response || '').toLowerCase();
      if (resp === 'rejected' && inWindow(responded)) e.rejections++;
      else if (resp === 'expired' && inWindow(responded ?? offered)) e.expiries++;
      else if (resp === 'pending' && inWindow(offered)) e.unanswered++;
    }
  }
  return e;
}

/**
 * Score in [0,100] from the measured rates, or null when there is nothing to
 * measure. Absent components are dropped and the remaining weights renormalised
 * - a partner with no cash runs in the week is not marked down for cash
 * integrity they never had the chance to get right.
 */
export function scoreFromEvents(e, peerMaxCompleted) {
  const denominators = {
    reliability: e.completed + e.rejections + e.expiries + e.cancellationsWhileAssigned + e.unanswered * UNANSWERED_PENALTY,
    throughput: null, cashIntegrity: e.codChecked
  };
  const components = {
    reliability: clampRatio(e.completed, denominators.reliability),
    /*
     * A zero here has to mean "did less than the busiest partner", not "did
     * nothing at all". When nothing was completed the ratio is not a
     * measurement, it is the absence of one, so the component is dropped and
     * the week is labelled `no-activity` instead of scoring 0 and occupying a
     * rank as though it had been assessed.
     */
    throughput: e.completed > 0
      ? (peerMaxCompleted > 0 ? clampRatio(e.completed, peerMaxCompleted) : 1)
      : null,
    cashIntegrity: clampRatio(e.codChecked - e.codDiscrepancies, denominators.cashIntegrity)
  };
  const present = Object.entries(components).filter(([, v]) => v !== null);
  const missing = Object.keys(components).filter((k) => components[k] === null);
  const weightSum = present.reduce((n, [k]) => n + RANK_WEIGHTS[k], 0);
  const score = present.length && weightSum > 0
    ? Math.round((present.reduce((n, [k, v]) => n + RANK_WEIGHTS[k] * v, 0) / weightSum) * 10000) / 100
    : null;
  const dataQuality = !present.length ? 'no-activity' : missing.length ? 'partial' : 'measured';
  const notes = [];
  if (missing.includes('cashIntegrity')) {
    notes.push(e.codUnrecorded
      ? `${e.codUnrecorded} cash collection(s) delivered with no recorded amount, so cash integrity could not be measured`
      : 'no cash collections in this window, so cash integrity is not part of the score');
  }
  if (e.codDiscrepancies) notes.push(`${e.codDiscrepancies} cash order(s) differed from the amount due by more than ₹${COD_TOLERANCE_RUPEE}`);
  if (e.unanswered) notes.push(`${e.unanswered} offer(s) left unanswered in this window`);
  if (!present.length) notes.push('no measured delivery actions this week');
  else if (missing.includes('throughput')) notes.push('no completed runs this week, so volume is not measured');
  return { score, components, weightsApplied: Object.fromEntries(present.map(([k]) => [k, RANK_WEIGHTS[k]])), missingComponents: missing, dataQuality, notes };
}

/**
 * Rank a set of partners for one week. Active partners take ranks 1..n in a
 * deterministic order; partners with nothing to score are labelled and ranked
 * after them, because an empty record must not be able to top a leaderboard.
 */
export function rankWeek({ roster, eventsById, window }) {
  const peerMaxCompleted = Math.max(0, ...roster.map((r) => (eventsById[idOf(r._id)] || {}).completed || 0));
  const scored = roster.map((r) => {
    const pid = idOf(r._id);
    const events = eventsById[pid] || collectPartnerEvents([], pid, window);
    const s = scoreFromEvents(events, peerMaxCompleted);
    return { partnerId: pid, partner: r.name || r.uniqueId || pid, events, ...s };
  });
  const active = scored.filter((s) => s.score !== null);
  active.sort((a, b) =>
    (b.score - a.score)
    || (b.events.completed - a.events.completed)
    || ((a.events.codDiscrepancies + a.events.codUnrecorded) - (b.events.codDiscrepancies + b.events.codUnrecorded))
    || String(a.partnerId).localeCompare(String(b.partnerId)));
  const resting = scored.filter((s) => s.score === null)
    .sort((a, b) => String(a.partnerId).localeCompare(String(b.partnerId)));
  const total = active.length + resting.length;
  const rows = [
    ...active.map((s, i) => ({ ...s, rank: i + 1, position: i + 1, of: total, percentile: Math.round(((total - (i + 1)) / Math.max(1, total - 1)) * 100) })),
    /*
     * A partner with nothing measured is given no rank at all. Numbering them
     * 2nd, 3rd, ... implies they were beaten on the merits, and on a week where
     * nobody delivered anything that counting would hand rank 1 to a partner
     * whose record is empty. So: `rank: null`, a `position` so the desk can
     * still find them on the list, and an explicit label.
     */
    ...resting.map((s, i) => ({
      ...s, rank: null, position: active.length + i + 1, of: total, percentile: null,
      excludedFromLeaderboard: true, rankLabel: 'not ranked - no measured activity'
    }))
  ];
  return rows;
}

/** Week-over-week movement, with a marker instead of a bogus infinite delta. */
export function attachDeltas(rows, previousRows) {
  const prev = new Map((previousRows || []).map((r) => [r.partnerId, r]));
  return rows.map((r) => {
    const before = prev.get(r.partnerId);
    const hasCurrentRank = typeof r.rank === 'number' && r.score !== null;
    const hadRank = before && typeof before.rank === 'number' && before.score !== null;
    if (!hasCurrentRank) return { ...r, previousRank: hadRank ? before.rank : null, rankDelta: null, isNewEntrant: false };
    if (!hadRank) return { ...r, previousRank: null, rankDelta: null, isNewEntrant: true };
    return { ...r, previousRank: before.rank, rankDelta: before.rank - r.rank, isNewEntrant: false };
  });
}

const queryForWindow = (window) => ({
  $or: [
    { assignedDeliveryPartner: { $ne: null }, deliveredAt: { $gte: new Date(window.start), $lt: new Date(window.end) } },
    { assignedDeliveryPartner: { $ne: null }, orderStatus: 'cancelled', updatedAt: { $gte: new Date(window.start), $lt: new Date(window.end) } },
    { 'partnerQueue.offeredAt': { $gte: new Date(window.start), $lt: new Date(window.end) } },
    { 'partnerQueue.respondedAt': { $gte: new Date(window.start), $lt: new Date(window.end) } }
  ]
});

/**
 * Load one week's leaderboard, plus the previous week's rows for the delta.
 * `at` is a parameter, not a hidden clock read, so a caller can ask for a past
 * week or a fixed instant and get a repeatable result.
 */
export async function loadWeeklyRanking({
  at, weekLabel,
  tzOffsetMinutes = Number.isFinite(Number(process.env.PARTNER_RANK_TZ_OFFSET_MINUTES))
    ? Number(process.env.PARTNER_RANK_TZ_OFFSET_MINUTES) : DEFAULT_TZ_OFFSET_MINUTES
} = {}) {
  const opts = { tzOffsetMinutes };
  const window = weekLabel ? windowFromLabel(weekLabel, opts) : isoWeekWindow(at ?? Date.now(), opts);
  // one hour before this week's start is still inside the previous week, so the
  // label resolves unambiguously instead of relying on rounding
  const prevWindow = windowFromLabel(previousWeekLabel(window.label, opts), opts);
  const [orders, roster, prevOrders] = await Promise.all([
    Order.find(queryForWindow(window))
      .select('orderStatus deliveredAt updatedAt paymentMethod totalAmount cashCollected assignedDeliveryPartner partnerQueue').lean(),
    DeliveryPartner.find({ isBanned: { $ne: true } }).select('_id name uniqueId').lean(),
    Order.find(queryForWindow(prevWindow))
      .select('orderStatus deliveredAt updatedAt paymentMethod totalAmount cashCollected assignedDeliveryPartner partnerQueue').lean()
  ]);

  const eventsById = {};
  for (const r of roster) eventsById[idOf(r._id)] = collectPartnerEvents(orders, idOf(r._id), window);
  const rows = rankWeek({ roster, eventsById, window });

  const prevEventsById = {};
  for (const r of roster) prevEventsById[idOf(r._id)] = collectPartnerEvents(prevOrders, idOf(r._id), prevWindow);
  const previousRows = rankWeek({ roster, eventsById: prevEventsById, window: prevWindow });

  return {
    window, previousWindow: prevWindow, rows: attachDeltas(rows, previousRows),
    partnerCount: rows.length, rankedCount: rows.filter((r) => r.score !== null).length,
    weights: RANK_WEIGHTS, toleranceRupe: COD_TOLERANCE_RUPEE,
    unansweredPenalty: UNANSWERED_PENALTY,
    excludesUnreadFields: true
  };
}

export function summariseForPartner(rows, partnerId) {
  const mine = rows.find((r) => r.partnerId === idOf(partnerId));
  if (!mine) return { found: false, message: 'This partner has no record in the ranked roster for the week.' };
  return {
    /*
     * The identity fields belong in the self view. Without `partnerId` a caller
     * cannot line their own row up against the desk's board, and comparing by
     * name instead fails silently when the name is missing - which is how a
     * consistency check turns into a check that compares nothing.
     */
    found: true, partnerId: mine.partnerId, partner: mine.partner,
    rank: mine.rank, position: mine.position, of: mine.of, score: mine.score,
    excludedFromLeaderboard: mine.excludedFromLeaderboard === true,
    rankLabel: mine.rankLabel || null,
    percentile: mine.percentile, dataQuality: mine.dataQuality,
    components: mine.components, notes: mine.notes,
    previousRank: mine.previousRank, rankDelta: mine.rankDelta, isNewEntrant: mine.isNewEntrant,
    measured: {
      completedRuns: mine.events.completed, rejections: mine.events.rejections,
      expiredOffers: mine.events.expiries, unanswered: mine.events.unanswered,
      cancellationsWhileAssigned: mine.events.cancellationsWhileAssigned,
      cashDeliveries: mine.events.codDeliveries, cashDiscrepancies: mine.events.codDiscrepancies,
      cashUnrecorded: mine.events.codUnrecorded
    }
  };
}
