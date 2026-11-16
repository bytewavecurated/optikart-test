#!/usr/bin/env node
/**
 * Weekly partner ranking, checked against a frozen clock.
 *
 * The engine turns real events into an ordered leaderboard, and most of what
 * can go wrong in it is invisible at a glance: a window that includes both of
 * its boundaries double-counts one run; an offer rejection assigned to partner
 * B lands on partner A's score; a partner whose entire week is "we never noted
 * the cash" gets full marks for cash integrity they never demonstrated; an
 * empty leaderboard puts a partner who did nothing above someone who drove all
 * week. Every one of those is asserted here without a database, because the
 * scoring is arithmetic over plain rows and the clock is an argument, not a
 * hidden `Date.now()`.
 *
 * The source scan at the end is the part that keeps this honest as the schema
 * grows: `rating`, `totalEarnings`, `avgDeliveryTime` and `returnRate` exist on
 * the partner document and nothing writes them, so a scorer that reads one
 * today has just started ranking partners on a constant. That is exactly how the
 * seller ranking broke, and we would not have noticed from a green test run.
 *
 *   node scripts/partner_ranking_unit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isoWeekWindow, windowFromLabel, previousWeekLabel, nextWeekLabel,
  collectPartnerEvents, scoreFromEvents, rankWeek, attachDeltas,
  RANK_WEIGHTS, COD_TOLERANCE_RUPEE, UNANSWERED_PENALTY,
  summariseForPartner
} from '../server/services/partnerWeeklyRank.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
  return ok;
};

/* One fixed instant for every window assertion: 10 Nov 2026, a Tuesday.       */
const CLOCK = Date.UTC(2026, 10, 10, 9, 0, 0);
const TZ = { tzOffsetMinutes: 0 };
const MON = Date.UTC(2026, 10, 9);
const NEXT_MON = Date.UTC(2026, 10, 16);

/* ------------------------------------------------------------- clock & weeks */
const win = isoWeekWindow(CLOCK, TZ);
check('week window starts on Monday 00:00 and ends on the next Monday (exclusive)',
  win.start === MON && win.end === NEXT_MON && win.label === '2026-W46',
  `${win.label} ${new Date(win.start).toISOString().slice(0, 10)}..${new Date(win.end).toISOString().slice(0, 10)}`);
check('the last Sunday of the week is inside it',
  isoWeekWindow(Date.UTC(2026, 10, 15, 23, 59, 59), TZ).label === '2026-W46');
check('midnight on the following Monday is already the next week',
  isoWeekWindow(NEXT_MON, TZ).label === '2026-W47');
check('a label is resolved back to the same window it came from',
  windowFromLabel('2026-W46', TZ).start === MON && windowFromLabel('2026-W46', TZ).end === NEXT_MON);
check('week numbers step by one in each direction',
  nextWeekLabel('2026-W46', TZ) === '2026-W47' && previousWeekLabel('2026-W47', TZ) === '2026-W46');

/* 2026-12-28..2027-01-03 belongs to ISO year 2026 (week 53), 2027-01-04 starts  */
check('the year boundary keeps January days in the previous ISO year when they must be',
  isoWeekWindow(Date.UTC(2026, 11, 28), TZ).label === '2026-W53'
    && isoWeekWindow(Date.UTC(2027, 0, 1), TZ).label === '2026-W53'
    && isoWeekWindow(Date.UTC(2027, 0, 4), TZ).label === '2027-W01',
  `${isoWeekWindow(Date.UTC(2026, 11, 28), TZ).label}/${isoWeekWindow(Date.UTC(2027, 0, 1), TZ).label}/${isoWeekWindow(Date.UTC(2027, 0, 4), TZ).label}`);
check('stepping back one week from W01 crosses into the previous ISO year',
  previousWeekLabel('2027-W01', TZ) === '2026-W53');
/*
 * 2025 has 52 ISO weeks, so 2025-W53 computes to a Monday whose Thursday is
 * already 2026 - the naive reading would rank "the week that is not there"
 * (silently as 2026-W01) instead of saying so. 2026-W54 is the other failure
 * shape: out of range for any year at all.
 */
check('a week that the year does not have is refused, and says which week it ends at',
  (() => { try { windowFromLabel('2025-W53', TZ); return 'no throw'; } catch (e) { return e instanceof RangeError && /not a real ISO week/.test(e.message) && /ends at week 52/.test(e.message); } })(),
  (() => { try { windowFromLabel('2025-W53', TZ); return ''; } catch (e) { return e.message; } })());
check('a week number no ISO year can have is refused outright',
  (() => { try { windowFromLabel('2026-W54', TZ); return false; } catch (e) { return e instanceof RangeError && /01..53/.test(e.message); } })(),
  (() => { try { windowFromLabel('2026-W54', TZ); return ''; } catch (e) { return e.message; } })());
for (const junk of ['', 'W46', '2026-46', '2026-W', 'abcdefgh']) {
  check(`label "${junk || '(empty)'}" cannot be parsed into a window`,
    (() => { try { windowFromLabel(junk, TZ); return false; } catch (e) { return e instanceof RangeError; } })());
}
check('no explicit clock is never guessed at for a window from an instant',
  (() => { try { isoWeekWindow(null, TZ); return false; } catch (e) { return e instanceof RangeError; } })());

/* ------------------------------------------------------------------ events */
const P_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const P_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const winOf = (when) => isoWeekWindow(when, TZ);
const W = winOf(CLOCK);
const rowOf = (over) => ({
  _id: 'o1', orderStatus: 'delivered', deliveredAt: new Date(Date.UTC(2026, 10, 11)),
  updatedAt: new Date(Date.UTC(2026, 10, 11)), assignedDeliveryPartner: P_A,
  paymentMethod: 'cod', totalAmount: 1000, cashCollected: 1000, partnerQueue: [], ...over
});

const eventsA = collectPartnerEvents([rowOf({})], P_A, W);
check('a completed run lands in the window', eventsA.completed === 1, JSON.stringify(eventsA));
check('an event after the window end is not counted',
  collectPartnerEvents([rowOf({ deliveredAt: new Date(NEXT_MON) })], P_A, W).completed === 0);
check('an event exactly on the start instant is counted (half-open window)',
  collectPartnerEvents([rowOf({ deliveredAt: new Date(MON) })], P_A, W).completed === 1);
check('a run assigned to another partner is not credited here',
  collectPartnerEvents([rowOf({ assignedDeliveryPartner: P_B })], P_A, W).completed === 0);

const sharedQueue = [rowOf({
  orderStatus: 'pending', deliveredAt: null,
  partnerQueue: [
    { partner: P_A, response: 'rejected', offeredAt: new Date(Date.UTC(2026, 10, 10)), respondedAt: new Date(Date.UTC(2026, 10, 10, 5)) },
    { partner: P_B, response: 'accepted', offeredAt: new Date(Date.UTC(2026, 10, 10)), respondedAt: new Date(Date.UTC(2026, 10, 10, 6)) }
  ]
})];
const aReject = collectPartnerEvents(sharedQueue, P_A, W);
const bReject = collectPartnerEvents(sharedQueue, P_B, W);
check('one partner refusing an offer does not mark down the other',
  aReject.rejections === 1 && bReject.rejections === 0 && aReject.completed === 0);
check('an expired offer counts as a refusal of the queue, not a completed run',
  collectPartnerEvents([rowOf({
    orderStatus: 'packed', deliveredAt: null, assignedDeliveryPartner: null,
    partnerQueue: [{ partner: P_A, response: 'expired', offeredAt: new Date(Date.UTC(2026, 10, 10)), respondedAt: new Date(Date.UTC(2026, 10, 11)) }]
  })], P_A, W).expiries === 1);
check('an unanswered offer in the window is counted separately, not as a rejection',
  collectPartnerEvents([rowOf({
    orderStatus: 'packed', deliveredAt: null, assignedDeliveryPartner: null,
    partnerQueue: [{ partner: P_A, response: 'pending', offeredAt: new Date(Date.UTC(2026, 10, 12)) }]
  })], P_A, W).unanswered === 1);

const cancelled = collectPartnerEvents([rowOf({
  orderStatus: 'cancelled', deliveredAt: null, updatedAt: new Date(Date.UTC(2026, 10, 12)),
  assignedDeliveryPartner: P_A, cancelledBy: 'partner'
})], P_A, W);
check('a cancellation while assigned is measured', cancelled.cancellationsWhileAssigned === 1);
check('a cancellation outside the window is not',
  collectPartnerEvents([rowOf({ orderStatus: 'cancelled', deliveredAt: null, updatedAt: new Date(NEXT_MON + 1000), assignedDeliveryPartner: P_A })], P_A, W).cancellationsWhileAssigned === 0);

/* --------------------------------------------------------- cash integrity */
const diff = (collected) => collectPartnerEvents([rowOf({ totalAmount: 1000, cashCollected: collected })], P_A, W);
check(`exactly the ${COD_TOLERANCE_RUPEE} rupee tolerance is not a discrepancy`,
  diff(1000 - COD_TOLERANCE_RUPEE).codDiscrepancies === 0);
check('one paisa over the tolerance is a discrepancy',
  diff(1000 - COD_TOLERANCE_RUPEE - 0.01).codDiscrepancies === 1);
check('a delivery with no recorded collection is excluded, not "clean"',
  diff(0).codUnrecorded === 1 && diff(0).codChecked === 0);
const onlyUnrecorded = scoreFromEvents(diff(0), 1);
check('and that exclusion is labelled instead of silently removed',
  onlyUnrecorded.components.cashIntegrity === null
    && onlyUnrecorded.missingComponents.includes('cashIntegrity')
    && onlyUnrecorded.notes.some((n) => /no recorded amount|could not be measured/i.test(n)),
  JSON.stringify(onlyUnrecorded.notes));

/* ------------------------------------------------------------- scoring */
check('the declared weights sum to 1',
  Math.abs(Object.values(RANK_WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
const perfect = scoreFromEvents({
  completed: 4, rejections: 0, expiries: 0, unanswered: 0, cancellationsWhileAssigned: 0,
  codDeliveries: 4, codChecked: 4, codDiscrepancies: 0, codUnrecorded: 0
}, 4);
check('all three components measured scores full marks',
  perfect.score === 100 && perfect.dataQuality === 'measured', JSON.stringify(perfect.components));
const noCash = scoreFromEvents({
  completed: 2, rejections: 0, expiries: 0, unanswered: 0, cancellationsWhileAssigned: 0,
  codDeliveries: 0, codChecked: 0, codDiscrepancies: 0, codUnrecorded: 0
}, 2);
const manual = (RANK_WEIGHTS.reliability * 1 + RANK_WEIGHTS.throughput * 1)
  / (RANK_WEIGHTS.reliability + RANK_WEIGHTS.throughput) * 100;
check('a missing component is dropped and the rest renormalised (half weight -> no penalty)',
  noCash.components.cashIntegrity === null && Math.abs(noCash.score - manual) < 0.01 && noCash.dataQuality === 'partial',
  `${noCash.score} vs ${manual.toFixed(2)}`);
const inactive = scoreFromEvents({
  completed: 0, rejections: 0, expiries: 0, unanswered: 0, cancellationsWhileAssigned: 0,
  codDeliveries: 0, codChecked: 0, codDiscrepancies: 0, codUnrecorded: 0
}, 5);
check('nothing measured produces no score rather than zero',
  inactive.score === null && inactive.dataQuality === 'no-activity', JSON.stringify(inactive));
const halfPenalty = scoreFromEvents({
  completed: 1, rejections: 0, expiries: 0, unanswered: 2, cancellationsWhileAssigned: 0,
  codDeliveries: 1, codChecked: 1, codDiscrepancies: 0, codUnrecorded: 0
}, 1);
check('unanswered offers weigh as half a miss each',
  Math.abs(halfPenalty.components.reliability - (1 / (1 + 2 * UNANSWERED_PENALTY))) < 1e-9);

/* ------------------------------------------------------------- ranking */
const mkEvents = (over = {}) => ({
  completed: 0, rejections: 0, expiries: 0, unanswered: 0, cancellationsWhileAssigned: 0,
  codDeliveries: 0, codChecked: 0, codDiscrepancies: 0, codUnrecorded: 0, ...over
});
const rankOf = (specs, previousRows) => {
  const roster = specs.map((s) => ({ _id: s.id, name: s.name }));
  const events = Object.fromEntries(specs.map((s) => [s.id, { ...mkEvents(s.events), partnerId: s.id }]));
  const rows = rankWeek({ roster, eventsById: events, window: W });
  return previousRows ? attachDeltas(rows, previousRows) : rows;
};
const ordered = rankOf([
  { id: P_B, name: 'Bee', events: { completed: 5, codChecked: 5, codDeliveries: 5 } },
  { id: P_A, name: 'Aay', events: { completed: 1, codChecked: 1, codDeliveries: 1 } }
]);
check('the busier clean partner ranks above the quieter one',
  ordered[0].partnerId === P_B && ordered[0].rank === 1 && ordered[1].rank === 2);
const tied = rankOf([
  { id: P_B, name: 'Bee', events: { completed: 2, codChecked: 2, codDeliveries: 2 } },
  { id: P_A, name: 'Aay', events: { completed: 2, codChecked: 2, codDeliveries: 2 } }
]);
check('identical records break by partner id so ranking is stable week to week',
  tied[0].partnerId < tied[1].partnerId && tied[0].rank === 1 && tied[1].rank === 2,
  tied.map((r) => r.partnerId.slice(0, 4)).join(','));
const idleLast = rankOf([
  { id: P_A, name: 'Aay', events: {} },
  { id: P_B, name: 'Bee', events: { completed: 1, codChecked: 1, codDeliveries: 1 } }
]);
check('a partner with no activity at all is placed after the measured ones and labelled',
  idleLast[0].partnerId === P_B && idleLast[0].rank === 1
    && idleLast[1].score === null && idleLast[1].excludedFromLeaderboard === true
    && idleLast[1].rank === null && idleLast[1].position === 2,
  JSON.stringify(idleLast.map((r) => [r.rank, r.position, r.score, r.excludedFromLeaderboard])));
check('nobody ranks a silent week first',
  idleLast.find((r) => r.rank === 1)?.score !== null);
/*
 * The case the fixtures above still cannot reach: a week in which no partner
 * did anything. This is what a freshly seeded CI database looks like, and a
 * board that called one of those partners "number 1" would be ranking people on
 * the absence of data - the exact bug we found in the seller leaderboard.
 */
const nobodyActive = rankOf([
  { id: P_A, name: 'Aay', events: {} },
  { id: P_B, name: 'Bee', events: {} }
]);
check('a week with no activity anywhere has no rank 1 at all',
  nobodyActive.every((r) => r.rank === null && r.score === null && r.excludedFromLeaderboard === true)
    && nobodyActive.map((r) => r.position).join() === '1,2'
    && nobodyActive.every((r) => /not ranked/i.test(r.rankLabel)),
  JSON.stringify(nobodyActive.map((r) => [r.rank, r.position, r.dataQuality])));
check('the same inputs rank the same way twice (shuffle-free and clock-free)',
  JSON.stringify(rankOf([{ id: P_A, name: 'A', events: { completed: 3, codChecked: 3, codDeliveries: 3 } }, { id: P_B, name: 'B', events: { completed: 1, codChecked: 1, codDeliveries: 1 } }]).map((r) => r.rank + r.partnerId))
    === JSON.stringify(rankOf([{ id: P_B, name: 'B', events: { completed: 1, codChecked: 1, codDeliveries: 1 } }, { id: P_A, name: 'A', events: { completed: 3, codChecked: 3, codDeliveries: 3 } }]).map((r) => r.rank + r.partnerId)));

/* --------------------------------------------------------- week-over-week */
const thisWeek = rankOf([
  { id: P_A, name: 'Aay', events: { completed: 3, codChecked: 3, codDeliveries: 3 } },
  { id: P_B, name: 'Bee', events: { completed: 1, codChecked: 1, codDeliveries: 1 } }
]);
const lastWeek = rankOf([
  { id: P_A, name: 'Aay', events: { completed: 1, codChecked: 1, codDeliveries: 1 } },
  { id: P_B, name: 'Bee', events: { completed: 3, codChecked: 3, codDeliveries: 3 } }
]);
const withDelta = rankOf([
  { id: P_A, name: 'Aay', events: { completed: 3, codChecked: 3, codDeliveries: 3 } }
], lastWeek);
check('a partner climbing from 2nd to 1st shows +1',
  withDelta[0].previousRank === 2 && withDelta[0].rankDelta === 1,
  JSON.stringify([withDelta[0].rank, withDelta[0].previousRank, withDelta[0].rankDelta]));
/*
 * The previous week contained only partner B. Partner A therefore has no
 * history: the honest statement is "new entrant", never a delta computed
 * against rank 0 or an empty string - a number that moves by nothing looks
 * like a fall through the table.
 */
const previousHadOnlyB = lastWeek.filter((r) => r.partnerId === P_B);
const newcomer = attachDeltas(thisWeek, previousHadOnlyB);
const newA = newcomer.find((r) => r.partnerId === P_A);
const moveB = newcomer.find((r) => r.partnerId === P_B);
check('a partner who was not ranked last week is marked new, not given a fake delta',
  newA.isNewEntrant === true && newA.rankDelta === null && newA.previousRank === null,
  JSON.stringify([newA.rankDelta, newA.isNewEntrant, newA.previousRank]));
check('and the partner who was ranked keeps a real signed delta',
  moveB.isNewEntrant === false && moveB.previousRank === 1 && moveB.rankDelta === -1,
  JSON.stringify([moveB.previousRank, moveB.rankDelta]));

/* ------------------------------------------------------- self-view contract */
const selfRows = rankOf([
  { id: P_A, name: 'Aay', events: { completed: 2, codChecked: 2, codDeliveries: 2 } },
  { id: P_B, name: 'Bee', events: {} }
]);
const viewA = summariseForPartner(selfRows, P_A);
const viewB = summariseForPartner(selfRows, P_B);
check('a partner can identify their own row in the summary',
  viewA.partnerId === P_A && typeof viewA.partner === 'string' && viewA.rank === 1 && viewA.score !== null,
  JSON.stringify([viewA.partnerId, viewA.rank]));
check('the summary exposes position as well as rank',
  viewA.position === 1 && viewB.position === 2 && viewB.rank === null
    && viewB.excludedFromLeaderboard === true && /not ranked/i.test(viewB.rankLabel),
  JSON.stringify([viewA.position, viewB.position, viewB.rank, viewB.rankLabel]));
check('an unknown partner is answered honestly, not with a zero row',
  summariseForPartner(selfRows, 'ffffffffffffffffffffffff').found === false);

/* --------------------------------------------------- no phantom-field reads */
const scanSources = [
  ['services/partnerWeeklyRank.js', 'server/services/partnerWeeklyRank.js'],
  ['routes/partnerRanking.js', 'server/routes/partnerRanking.js']
];
const FORBIDDEN = ['rating', 'totalEarnings', 'avgDeliveryTime', 'returnRate'];
for (const [label, rel] of scanSources) {
  const full = path.resolve(HERE, '..', rel);
  let code = '';
  try {
    code = fs.readFileSync(full, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  } catch { code = null; }
  if (code === null) { check(`${label} readable for the phantom-field scan`, false, 'file missing'); continue; }
  const found = FORBIDDEN.filter((f) => new RegExp(`\\b${f}\\b`).test(code));
  check(`${label} reads none of the fields nobody writes`, found.length === 0, found.join(','));
}
check('the leaderboard never exposes a phantom field either',
  !/rating|earnings|avgDelivery|returnRate/i.test(
    fs.readFileSync(path.resolve(HERE, '../server/routes/partnerRanking.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} weekly-ranking checks passed`);
if (failed.length) { console.log(' failing:'); failed.forEach((f) => console.log(`  - ${f.name}`)); }
process.exitCode = failed.length ? 1 : 0;
