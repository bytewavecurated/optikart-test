#!/usr/bin/env node
/**
 * Partner payout settlement queue - the contract the admin console is built on.
 *
 * The console at /admin/partner-payouts is a thin front for two endpoints, so
 * what has to be guaranteed is the contract between them: an incomplete
 * settlement is refused rather than half-written, a settled row carries the
 * reference a person actually typed, and settling cannot happen twice. Those are
 * the properties that keep a partner's earnings history honest; the React
 * component around them is presentation.
 *
 * Setting up a queue row means real deliveries (earnings accrue per run) and a
 * withdrawal, so this drives the same path a partner uses.
 *
 *   node scripts/payout_console_e2e.mjs [base-url]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 140)}` : ''}`);
  return ok;
};
const call = async (p, { t, b, m } = {}) => {
  const res = await fetch(API + p, {
    method: m || (b ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
};
const login = async (p, email, password) => (await call(p, { b: { email, password } })).json?.token;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const partner = await login('/delivery-partner/login', 'suresh.partner@optikart.com', 'Partner123@');
  const customer = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  const seller = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  const admin = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  if (!check('roles sign in', !!(partner && customer && seller && admin))) return finish();

  const me0 = (await call('/delivery-partner/me', { t: partner })).json?.data || {};
  const partnerId = me0.partner?._id;
  const products = (await call('/products?category=sunglasses&limit=8')).json?.products || [];

  // Earnings accrue per completed run, so deliveries - not a write - fund the queue.
  let available = Number(me0.availableBalance || 0);
  for (const product of products) {
    if (available >= 110) break;
    await call('/orders', {
      t: customer,
      b: {
        items: [{ product: product._id, quantity: 1 }],
        shippingAddress: { name: 'Payout Console', phone: '9812300220', street: '9 Linking Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
        paymentMethod: 'cod'
      }
    });
    const order = ((await call('/orders?limit=1', { t: customer })).json?.orders || [])[0];
    if (!order) continue;
    await call(`/seller/orders/${order._id}/status`, { t: seller, b: { status: 'confirmed' }, m: 'PUT' });
    await call(`/seller/orders/${order._id}/status`, { t: seller, b: { status: 'packed' }, m: 'PUT' });
    await sleep(1500);
    // Assigned by hand so the earning is deterministic; dispatch has its own suite.
    await call('/delivery-partner/assign', { t: admin, b: { orderId: order._id, partnerId } });
    await call(`/delivery-partner/offers/${order._id}/respond`, { t: partner, b: { decision: 'accept' } });
    await call(`/delivery-partner/complete/${order._id}`, { t: partner, b: {} });
    available = Number(((await call('/delivery-partner/me', { t: partner })).json?.data || {}).availableBalance || 0);
  }
  if (!check('a withdrawal is possible (₹50 minimum)', available >= 50, `available ${available}`)) return finish();

  const wd = await call('/delivery-partner/withdraw', { t: partner, b: { amount: 50 } });
  const queued = wd.json?.data?.status === 'awaiting_settlement';
  check('withdrawal is queued for settlement rather than marked paid',
    queued, JSON.stringify(wd.json?.data || wd.json).slice(0, 120));
  check('and the reservation is visible to the console',
    Number(((await call('/delivery-partner/me', { t: partner })).json?.data || {}).awaitingSettlement) >= 50);

  const pend = await call('/delivery-partner/payouts/pending', { t: admin });
  const row = (pend.json?.withdrawals || [])[0];
  check('the queue answers with what a person needs to pay out',
    pend.status === 200 && !!row?.withdrawalId && !!row?.partner?.id
      && Number(row.amount) === 50 && row.requestedAt !== undefined,
    JSON.stringify(row || {}).slice(0, 140));
  check('bank details travel with the row (otherwise the transfer cannot be made)',
    !!row?.bank, JSON.stringify(row?.bank || {}).slice(0, 100));

  const noRef = await call(`/delivery-partner/payouts/${row.withdrawalId}/settle`, {
    t: admin, b: { partnerId: row.partner.id }
  });
  check('settling without a transfer reference is refused',
    noRef.status === 400 && noRef.json?.needsReference === true, noRef.text.slice(0, 120));

  const stillPending = await call('/delivery-partner/payouts/pending', { t: admin });
  check('a refused settle leaves the row in the queue',
    (stillPending.json?.withdrawals || []).some((w) => w.withdrawalId === row.withdrawalId));

  const REF = 'UTR4471928374655';
  const ok = await call(`/delivery-partner/payouts/${row.withdrawalId}/settle`, {
    t: admin, b: { partnerId: row.partner.id, reference: REF, note: 'NEFT at 18:20' }
  });
  check('settling with a reference succeeds', ok.status === 200 && ok.json?.success === true, ok.text.slice(0, 120));

  const stored = ((await call('/delivery-partner/me', { t: partner })).json?.data?.partner?.withdrawals || []).slice(-1)[0] || {};
  check('the reference the person typed is what the ledger shows',
    stored.payoutId === REF && stored.status === 'processed' && !!stored.settledAt,
    JSON.stringify({ payoutId: stored.payoutId, status: stored.status, settled: !!stored.settledAt }));
  check('and the note says who settled it', /by /.test(stored.settlementNote || ''), stored.settlementNote);

  const meAfter = (await call('/delivery-partner/me', { t: partner })).json?.data || {};
  check('settling moves reserved money into paid out',
    Number(meAfter.totalWithdrawn) >= 50 && Number(meAfter.awaitingSettlement) === 0,
    `totalWithdrawn=${meAfter.totalWithdrawn} awaiting=${meAfter.awaitingSettlement}`);

  const twice = await call(`/delivery-partner/payouts/${row.withdrawalId}/settle`, {
    t: admin, b: { partnerId: row.partner.id, reference: 'UTR0000000000000' }
  });
  check('settling twice is refused rather than counted again',
    twice.json?.alreadySettled === true, JSON.stringify(twice.json || {}).slice(0, 110));

  const after = await call('/delivery-partner/payouts/pending', { t: admin });
  check('the settled row leaves the queue',
    !(after.json?.withdrawals || []).some((w) => w.withdrawalId === row.withdrawalId));

  const stranger = await call('/delivery-partner/payouts/pending', { t: partner });
  check('a partner cannot read the desk queue', stranger.status === 403, `status ${stranger.status}`);

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} payout-console assertions passed`);
  if (failed.length) {
    console.log(' failing:');
    for (const f of failed) console.log(`  - ${f.name}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 2; });
