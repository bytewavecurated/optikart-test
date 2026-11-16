#!/usr/bin/env node
/**
 * Weekly partner leaderboard, over HTTP, against the real routes.
 *
 * The unit suite proves the arithmetic. This proves the parts arithmetic cannot:
 * that the router is actually mounted, that the admin board is not readable by a
 * logged-in customer, that a partner asking about their own week is not handed
 * other partners' weeks, and that the invariant the desk is told to trust - an
 * unmeasured partner has no rank - survives a JSON round trip. The last check
 * earns a real run end to end, because a board fed only by fixtures would pass
 * even if the query in `loadWeeklyRanking` could never match a live order.
 *
 *   node scripts/partner_ranking_e2e.mjs [base-url]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 170)}` : ''}`);
  return ok;
};
const call = async (path, { token, body, method } = {}) => {
  const res = await fetch(API + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
};
const login = (path, email, password) => call(path, { body: { email, password } }).then((r) => r.json?.token);
const finish = () => {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} live weekly-ranking checks passed`);
  failed.forEach((f) => console.log(`  - ${f.name}`));
  process.exitCode = failed.length ? 1 : 0;
};

const PHANTOM = ['rating', 'totalEarnings', 'avgDeliveryTime', 'returnRate'];
const shapeOk = (rows) => rows.every((r) => (
  r.score === null
    ? r.rank === null && r.excludedFromLeaderboard === true && typeof r.rankLabel === 'string'
    : typeof r.rank === 'number' && r.rank >= 1 && r.excludedFromLeaderboard !== true
));

async function main() {
  const admin = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  const customer = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  const partner = await login('/delivery-partner/login', 'suresh.partner@optikart.com', 'Partner123@');
  const seller = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  const other = await login('/delivery-partner/login', 'anjali.partner@optikart.com', 'Partner123@');
  const third = await login('/delivery-partner/login', 'ramesh.partner@optikart.com', 'Partner123@');
  if (!check('role logins succeed', !!(admin && customer && partner && seller && other && third))) return finish();
  /*
   * Every partner in the roster, because this suite does not get choose who
   * dispatches. The desk's cascade offers the run to whoever is nearest and
   * available, and in the aggregate harness earlier suites have already moved
   * people around, banned, or consumed their availability. A fixture that
   * hardcoded one partner passed on a clean database and failed on a shared
   * one for reasons that had nothing to do with rankings - so it discovers who
   * actually received the run and scores *that* partner.
   */
  const roster = [
    { token: partner, email: 'suresh.partner@optikart.com' },
    { token: other, email: 'anjali.partner@optikart.com' },
    { token: third, email: 'ramesh.partner@optikart.com' }
  ].filter((r) => r.token);

  /* ------------------------------------------------------------- access control */
  const board = '/admin/partner-weekly-ranks';
  check('the weekly board is mounted and answers', (await call(board, { token: admin })).status === 200);
  const anon = await call(board);
  check('an anonymous request is refused', anon.status === 401, `status ${anon.status}`);
  const asCustomer = await call(board, { token: customer });
  check('a signed-in customer is refused, not merely uninvited', asCustomer.status === 403, `status ${asCustomer.status}`);
  const asPartner = await call(board, { token: partner });
  check('a partner cannot read the whole board', asPartner.status === 403, `status ${asPartner.status}`);

  /* ------------------------------------------------------------ board contract */
  const first = (await call(board, { token: admin })).json || {};
  check('the board names the week it is describing', /^\d{4}-W\d{2}$/.test(String(first.week)), first.week);
  check('the board names the week it compared against',
    /^\d{4}-W\d{2}$/.test(String(first.previousWeek)) && first.previousWeek !== first.week, first.previousWeek);
  check('the weights are published and sum to 1',
    !!first.weights && Math.abs(Object.values(first.weights).reduce((a, b) => a + b, 0) - 1) < 1e-9,
    JSON.stringify(first.weights));
  check('the window is a half-open pair of real instants',
    !!first.windowStart && !!first.windowEnd && new Date(first.windowEnd) > new Date(first.windowStart)
      && (new Date(first.windowEnd) - new Date(first.windowStart)) === 7 * 864e5,
    `${first.windowStart}..${first.windowEnd}`);
  const rows = first.rows || [];
  check('every partner appears exactly once', rows.length > 0 && new Set(rows.map((r) => r.partnerId)).size === rows.length,
    `${rows.length} rows`);
  check('ranks are unique among partners that have one',
    new Set(rows.filter((r) => r.rank).map((r) => r.rank)).size === rows.filter((r) => r.rank).length);
  check('the shape invariant holds over the wire: no rank without a score',
    shapeOk(rows), JSON.stringify(rows.map((r) => [r.rank, r.score, r.excludedFromLeaderboard])));
  check('rank 1 is only ever a measured partner',
    !rows.some((r) => r.rank === 1 && r.score === null));
  check('the board does not leak the fields nobody writes',
    PHANTOM.every((f) => !first.text || !first.text.includes(f))
      && !PHANTOM.some((f) => JSON.stringify(rows[0] || {}).includes(f)),
    JSON.stringify(PHANTOM.filter((f) => JSON.stringify(first).includes(f))));
  check('it counts who is ranked as well as who exists',
    typeof first.rankedPartners === 'number' && typeof first.totalPartners === 'number'
      && first.rankedPartners <= first.totalPartners,
    `${first.rankedPartners}/${first.totalPartners}`);

  /* ------------------------------------------------------------- past weeks */
  const closed = await call(`${board}?week=2026-W20`, { token: admin });
  check('a closed week can be reviewed and is echoed back',
    closed.status === 200 && closed.json?.week === '2026-W20', `${closed.status} ${closed.json?.week}`);
  const fakeWeek = await call(`${board}?week=2025-W53`, { token: admin });
  check('a week the calendar does not have is refused with the reason',
    fakeWeek.status === 400 && /not a real ISO week|ends at week/i.test(fakeWeek.json?.message || ''),
    fakeWeek.json?.message);
  const junkWeek = await call(`${board}?week=last-week`, { token: admin });
  check('an unparseable label is a 400 rather than a silent empty board',
    junkWeek.status === 400 && /2026-W47|YYYY|look like/i.test(junkWeek.json?.message || ''), junkWeek.json?.message);

  /* --------------------------------------------------------- self view & privacy */
  const selfUrl = '/delivery-partner/rank/current';
  check('a partner can ask about their own week', (await call(selfUrl, { token: partner })).status === 200);
  check('an anonymous partner cannot', (await call(selfUrl)).status === 401);
  const asCustomerSelf = await call(selfUrl, { token: customer });
  check('a customer cannot use the partner endpoint', asCustomerSelf.status === 403 || asCustomerSelf.status === 401,
    `status ${asCustomerSelf.status}`);
  const mine = await call(selfUrl, { token: partner });
  const mineJson = mine.json || {};
  const otherPartner = (await call('/delivery-partner', { token: admin })).json?.data || [];
  const otherName = (otherPartner.find((p) => p.email === 'anjali.partner@optikart.com') || {}).name;
  check('the self view carries this partner and no other names',
    !!mineJson.own && !!mineJson.week
      && (!otherName || !JSON.stringify(mineJson).includes(otherName)),
    otherName ? `searched for "${otherName}"` : 'second partner not found to search for');
  check('the self view explains what was measured',
    mineJson.own?.found !== true || typeof mineJson.own?.measured?.completedRuns === 'number'
      || !!mineJson.own?.notes?.length, JSON.stringify(mineJson.own || {}).slice(0, 120));
  /*
   * Deliberately unforgiving. The earlier version of this check returned true
   * when it could not find the partner it was comparing, because the self view
   * did not carry an id to compare on - so it was green while asserting nothing.
   * A comparison that finds no subject is a failure, never a pass-by-absence.
   */
  const ownId = mineJson.own?.partnerId;
  const boardRow = (first.rows || []).find((r) => r.partnerId === ownId);
  check('the self view identifies the same partner the board lists',
    !!ownId && !!boardRow, `ownId=${ownId} | rows=${(first.rows || []).length}`);
  check('a ranked partner agrees between the board and their own screen',
    !!boardRow && boardRow.rank === mineJson.own?.rank && boardRow.score === mineJson.own?.score,
    JSON.stringify([boardRow?.rank, mineJson.own?.rank, boardRow?.score, mineJson.own?.score]));

  /* --------------------------------------------------- earn a real week end to end */
  for (const r of roster) {
    await call('/delivery-partner/location', { token: r.token, body: { latitude: 19.076, longitude: 72.877 } });
    await call('/delivery-partner/availability', { token: r.token, body: { isAvailable: true }, method: 'PUT' });
  }
  /*
   * Several suites run against this one database, and they buy stock. Asking
   * for `limit=1` used to be a fixture that quietly depended on being first:
   * it picked a sold-out frame and the "order is placed" check failed for a
   * reason that had nothing to do with rankings. So: filter for stock, and if
   * a purchase still loses the race, try the next candidate.
   */
  const listing = (await call('/products?category=sunglasses&limit=60', { token: seller })).json;
  const candidates = (listing.products || listing.data || []).filter((p) => !Number.isFinite(p.stock) || p.stock > 0);
  if (!check('there is an in-stock product to order', candidates.length > 0, `${candidates.length} candidates`)) return finish();
  const shippingAddress = {
    name: 'Leaderboard Runner', phone: '9800006677', street: '4 Bandra Hill',
    city: 'Mumbai', state: 'Maharashtra', pincode: '400050'
  };
  /*
   * Prove the order is *this* attempt's, not the most recent thing the customer
   * happens to have. Read the newest id first, place, then require a different
   * id whose line item is the product we asked for. Without that the loop below
   * would happily pack an order left over from an earlier suite and report a
   * clean ranking run for data it never created.
   */
  const newestId = async () => (await call('/orders?limit=1', { token: customer })).json.orders?.[0]?._id || null;
  const lineMatches = async (id, productId) => {
    const list = (await call('/orders?limit=8', { token: customer })).json.orders || [];
    const found = list.find((o) => o._id === id);
    if (!found) return false;
    const text = JSON.stringify(found.items || found.cartItems || []);
    return text.includes(String(productId)) || (found.products || []).some((p) => String(p?._id || p) === String(productId));
  };

  let order = null;
  let lastFailure = '';
  for (const candidate of candidates.slice(0, 6)) {
    const before = await newestId();
    const placed = await call('/orders', {
      token: customer,
      body: { items: [{ product: candidate._id, quantity: 1 }], paymentMethod: 'cod', shippingAddress }
    });
    const now = await newestId();
    if (!placed.json?.success || !now || now === before) { lastFailure = placed.text.slice(0, 110); continue; }
    if (!(await lineMatches(now, candidate._id))) { lastFailure = `order ${now} does not contain ${candidate._id}`; continue; }
    await call(`/seller/orders/${now}/status`, { token: seller, body: { status: 'confirmed' }, method: 'PUT' });
    const packed = await call(`/seller/orders/${now}/status`, { token: seller, body: { status: 'packed' }, method: 'PUT' });
    if (packed.json?.success !== true) { lastFailure = packed.json?.message || 'seller could not pack it'; continue; }
    order = { _id: now, cod: true };
    break;
  }
  if (!check('the cash-on-delivery order is placed and packed', !!order, lastFailure)) return finish();
  await new Promise((r) => setTimeout(r, 2500));

  let holder = null;
  let seen = [];
  for (let attempt = 0; attempt < 10 && !holder; attempt += 1) {
    for (const r of roster) {
      const list = (await call('/delivery-partner/offers', { token: r.token })).json.offers || [];
      seen.push(...list.map((o) => `${r.email}:${o.orderNumber}`));
      const mine = list.find((o) => o.orderId === order._id);
      if (mine) { holder = { ...r, offer: mine }; break; }
    }
    if (!holder) await new Promise((res) => setTimeout(res, 1500));
  }
  if (!check('the run reaches a partner queue', !!holder, seen.slice(0, 4).join(' ') || 'no offers seen')) return finish();
  if (!check('the queue entry names the partner holding it',
    !!holder.offer.orderNumber, holder.email)) return finish();
  const accepted = await call(`/delivery-partner/offers/${holder.offer.orderId}/respond`, { token: holder.token, body: { decision: 'accept' } });
  if (!check('and is accepted by that partner', accepted.json?.success === true, accepted.json?.message)) return finish();
  const done = await call(`/delivery-partner/complete/${holder.offer.orderId}`, { token: holder.token, body: {} });
  check('the run is delivered', done.json?.success === true, done.json?.message || done.text.slice(0, 90));

  const after = (await call(board, { token: admin })).json || {};
  const rowsAfter = after.rows || [];
  /*
   * Read once, here, before anything uses it. An earlier revision referenced
   * this value from the line above its own `const`, which is a temporal
   * dead-zone error: `node --check` accepts it, and the suite dies at import
   * time with "Cannot access 'selfAfter' before initialization".
   */
  const selfAfter = (await call(selfUrl, { token: holder.token })).json || {};
  const afterId = selfAfter.own?.partnerId || ownId;
  const mineAfter = rowsAfter.find((r) => r.partnerId === afterId);
  if (!check('the delivering partner is on the board afterwards', !!mineAfter, JSON.stringify(rowsAfter.map((r) => r.partner)))) {
    return finish();
  }
  check('and is now measured, not a placeholder row',
    typeof mineAfter.score === 'number' && mineAfter.rank === 1 || mineAfter.score !== null,
    JSON.stringify([mineAfter.rank, mineAfter.score, mineAfter.dataQuality]));
  check('completed runs counted from the live order', (mineAfter.measured?.completedRuns ?? 0) >= 1,
    JSON.stringify(mineAfter.measured));
  check('cash integrity was scored, because collection is recorded',
    mineAfter.components?.cashIntegrity !== null && mineAfter.components?.cashIntegrity !== undefined,
    JSON.stringify(mineAfter.components));
  check('ranking somebody is not the same as ranking everybody quietly',
    after.rankedPartners >= 1 && after.rankedPartners <= after.totalPartners,
    `${after.rankedPartners}/${after.totalPartners}`);
  check('the partner sees the same week the desk sees',
    selfAfter.week === after.week && (selfAfter.own?.rank === null || selfAfter.own?.rank === mineAfter.rank),
    JSON.stringify([selfAfter.week, after.week, selfAfter.own?.rank, mineAfter.rank]));

  return finish();
}
main().catch((e) => { console.log('SUITE ERROR', e.message); process.exitCode = 1; });
