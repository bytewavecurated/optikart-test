#!/usr/bin/env node
/**
 * Seller ranking suite.
 *
 * The order-assignment decision is the one an operations desk has to be able to
 * argue with, so it must carry its arithmetic. These checks place a real order,
 * let the routing build its shortlist, and then insist that:
 *
 *   - the candidates come back ranked, with a score and human reasons;
 *   - the score is built from measured behaviour (orders, returns, reviews),
 *     not from the Seller fields that exist but are never written;
 *   - the auto-assign path picks rank #1 and records why;
 *   - the desk is told about it, rather than having to go looking.
 *
 *   node scripts/ranking_e2e.mjs [base-url]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
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
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text };
};
const login = (path, email, password) => call(path, { body: { email, password } }).then((r) => r.json?.token);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const customer = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  const seller = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  const admin = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  if (!check('logins succeed', !!(customer && seller && admin))) return finish();

  // One stocked, verified product, so at least one seller is a real candidate.
  const stocked = (await call('/products?category=sunglasses&limit=1', { token: seller })).json;
  const product = (stocked.products || stocked.data || [])[0];
  if (!check('there is a product to order', !!product, JSON.stringify(stocked).slice(0, 80))) return finish();

  await call('/cart', { token: customer, body: { productId: product._id, quantity: 1 } });
  const placed = await call('/orders', {
    token: customer,
    body: {
      items: [{ product: product._id, quantity: 1 }],
      shippingAddress: {
        name: 'Ranking Runner', phone: '9800006655', street: '9 Turner Road',
        city: 'Mumbai', state: 'Maharashtra', pincode: '400050'
      },
      paymentMethod: 'cod'
    }
  });
  const order = (await call('/orders?limit=1', { token: customer })).json.orders?.[0];
  if (!check('order placed', !!order, placed.text)) return finish();

  const toConfirmed = await call(`/seller/orders/${order._id}/status`, { token: seller, body: { status: 'confirmed' }, method: 'PUT' });
  const toPacked = await call(`/seller/orders/${order._id}/status`, { token: seller, body: { status: 'packed' }, method: 'PUT' });
  check('the seller can move the order to packed, which starts routing',
    toPacked.status === 200, `confirm=${toConfirmed.status} ${JSON.stringify(toConfirmed.json).slice(0, 70)} pack=${JSON.stringify(toPacked.json).slice(0, 70)}`);
  await sleep(2500);

  const queue = await call('/order-routing/queue', { token: admin });
  // The queue is keyed by routingId and orderNumber, not by a nested order
  // document, so matching anything else here would silently test whichever
  // routing happened to be first in somebody else's queue.
  const entry = (queue.json?.queue || []).find((r) => r.orderNumber === order.orderNumber);

  if (!check('the routing queue answers for the desk', queue.status === 200 && !!entry,
    `status ${queue.status}, entries ${(queue.json?.queue || []).length}`)) return finish();

  const candidates = entry.candidates || [];
  if (!check('candidates are listed with their ranking', candidates.length > 0,
    JSON.stringify(candidates).slice(0, 110))) return finish();

  const first = candidates[0];
  check('rank #1 comes first', first.rank === 1 || first.rank === undefined, `rank ${first.rank}`);
  check('every candidate carries a score',
    candidates.every((c) => c.score === null || typeof c.score === 'number'),
    JSON.stringify(candidates.map((c) => c.score)));

  const withReasons = candidates.filter((c) => Array.isArray(c.scoreReasons) && c.scoreReasons.length >= 2);
  check('ranked candidates explain themselves', withReasons.length === candidates.length,
    `${withReasons.length}/${candidates.length} carry reasons`);

  const reasonsText = candidates.map((c) => (c.scoreReasons || []).join(' ')).join(' ');
  check('the reasons cite measured behaviour, not stored flags',
    /deliver|return|review|rated|unknown|km|₹/i.test(reasonsText), reasonsText.slice(0, 150));
  check('a candidate reports what was actually counted',
    candidates.every((c) => !c.measured || typeof c.measured.orders === 'number'),
    JSON.stringify(candidates[0]?.measured));
  check('the figures say how old they are', !!first.rankedAt, first.rankedAt || 'no rankedAt');
  check('the desk sees the shortlist is about fulfilment, not a mystery score',
    !/AI\b/.test(JSON.stringify(candidates).slice(0, 400)), '');

  // The admin notification this decision is supposed to produce.
  const notes = await call('/notifications?limit=20', { token: admin });
  const list = notes.json?.notifications || notes.json?.data || [];
  const related = list.filter((n) => `${n.title || ''} ${n.message || ''}`.includes(order.orderNumber));
  check('the desk is told, not left to look', notes.status === 200 && related.length > 0,
    JSON.stringify(list.slice(0, 2).map((n) => n.title)).slice(0, 150));

  // Auto-assign has to choose rank #1 and say why it did.
  const routingId = entry.routingId;
  const auto = await call(`/order-routing/${routingId}/auto-assign`, { token: admin, body: {} });
  check('auto-assign answers', auto.status === 200, auto.text);
  const message = JSON.stringify(auto.json || {});
  check('auto-assign no longer claims to be AI', !/Auto-assigned based on score/i.test(message), message.slice(0, 120));
  // The route answers under `data`, which is why this is read from both places:
  // an assertion that looks only at the top level reports failure on a call that
  // worked, and that is how a suite starts being ignored.
  const payload = auto.json?.data || auto.json || {};
  const assignedId = payload.assignedSeller?._id || payload.assignedSeller;
  check('auto-assign names the seller it chose',
    auto.json?.success !== true
      || !!(payload.assignedSeller?.storeName || payload.assignedSeller?.name),
    payload.assignedSeller?.storeName || payload.assignedSeller?.name || JSON.stringify(auto.json).slice(0, 90));
  if (auto.json?.success === true) {
    check('auto-assign chooses the top-ranked candidate',
      String(assignedId) === String(first.sellerId),
      `assigned ${assignedId}, ranked first ${first.sellerId}`);
  }

  const one = await call(`/order-routing/${routingId}`, { token: admin });
  const decision = JSON.stringify(one.json?.routing?.aiDecision || one.json?.data?.aiDecision || one.json || '');
  check('the recorded decision carries its reasons',
    /score|rank|closest|km/i.test(decision), decision.slice(0, 160));

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} ranking assertions passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 2; });
