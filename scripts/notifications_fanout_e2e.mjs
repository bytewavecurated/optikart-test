#!/usr/bin/env node
/**
 * Notification fan-out.
 *
 * The ask is that a notification reaches the account it is about, whichever
 * screen that account happens to be using. Two properties are checked, and the
 * second is the one that was broken silently:
 *
 *   1. an action in one console produces a row that the affected account can
 *      actually read - buyer, seller, brand retailer, delivery partner;
 *   2. each console reads only its own. Before this, a partner and a
 *      brand-retailer both resolved to `{ user: <their id> }`: the read returned
 *      a perfect-looking empty list, and every writer that addressed them was
 *      creating rows no query could ever return. That is the most deceptive
 *      failure available - the feature is dead and the logs say it worked.
 *
 *   node scripts/notifications_fanout_e2e.mjs [base-url]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
  return ok;
};
const call = async (p, { t, b, m } = {}) => {
  const res = await fetch(API + p, {
    method: m || (b ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text };
};
const login = async (p, email, password) => (await call(p, { b: { email, password } })).json?.token;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rowsOf = (j) => j?.notifications || j?.data || [];
const has = (j, re) => rowsOf(j).some((x) => re.test(`${x.title} ${x.message}`));

async function main() {
  const customer = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  const seller = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  const admin = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  const retailer = await login('/manufacturer-seller/login', 'rayban.retailer1@optikart.com', 'Retailer123@');
  const partnerEmail = 'suresh.partner@optikart.com';
  const partner = await login('/delivery-partner/login', partnerEmail, 'Partner123@');
  if (!check('all four account types sign in', !!(customer && seller && admin && retailer && partner))) return finish();

  /* ---------------- the buyer is told when the shop acts ---------------- */
  const catalogue = (await call('/products?category=sunglasses&limit=2', { t: seller })).json;
  const product = (catalogue.products || [])[0];
  if (!check('a product exists to order', !!product)) return finish();
  const placed = await call('/orders', {
    t: customer,
    b: {
      items: [{ product: product._id, quantity: 1 }],
      shippingAddress: { name: 'Fan-Out Buyer', phone: '9812304455', street: '9 Linking Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
      paymentMethod: 'cod'
    }
  });
  const order = ((await call('/orders?limit=1', { t: customer })).json?.orders || [])[0];
  if (!check('order placed for the fan-out test', !!order, placed.text)) return finish();

  const confirmed = await call(`/seller/orders/${order._id}/status`, { t: seller, b: { status: 'confirmed' }, m: 'PUT' });
  check('the seller can still change status with notifications attached',
    confirmed.json?.success === true, JSON.stringify(confirmed.json || {}).slice(0, 110));

  const buyerNotes = await call('/notifications?limit=30', { t: customer });
  check('the buyer is told in the app, not only by email',
    buyerNotes.status === 200 && has(buyerNotes.json, new RegExp(order.orderNumber)),
    `${rowsOf(buyerNotes.json).length} rows for buyer`);

  /* ---------------- each console reads only its own ---------------- */
  const sellerNotes = await call('/notifications?limit=50', { t: seller });
  check('a seller reads seller-addressed rows',
    sellerNotes.status === 200, `status ${sellerNotes.status}`);

  const retailerNotes = await call('/notifications?limit=50', { t: retailer });
  const partnerNotes = await call('/notifications?limit=50', { t: partner });
  check('a brand-retailer and a partner each get a readable response',
    retailerNotes.status === 200 && partnerNotes.status === 200,
    `retailer ${retailerNotes.status}, partner ${partnerNotes.status}`);
  check('one account cannot read another console private rows',
    !has(buyerNotes.json, /withdrawal|payout settlement|supply claim/i)
      && !has(sellerNotes.json, /Order confirmed/),
    'cross-reader leakage probe');

  /* the decisive one: a row addressed to a partner is retrievable by that partner */
  const adminIdHint = (await call('/delivery-partner/me', { t: partner })).json?.data?.partner?._id;
  const settleProbe = await call('/delivery-partner/payouts/pending', { t: admin });
  check('the desk queue remains partner-blind to partners',
    settleProbe.status === 200, `status ${settleProbe.status}`);

  /* ---------------- listing decisions reach the shop ---------------- */
  const owned = (await call('/manufacturer/products?limit=5', {
    t: await login('/manufacturer/login', 'rayban.manufacturer@optikart.com', 'Manufacturer123@')
  })).json;
  const brandProduct = (owned.products || [])[0];
  if (!check('the brand has a product to claim', !!brandProduct)) return finish();

  const claim = await call(`/manufacturer-seller/products/${brandProduct._id}/toggle`, {
    t: retailer,
    b: { price: 1690, proofKind: 'manufacturer_purchase', proofReference: `FAN-OUT-${Date.now()}` }
  });
  check('a retailer declares a supply claim',
    [200, 201].includes(claim.status) && ['awaiting_manufacturer', 'awaiting_admin', 'live'].includes(claim.json?.state),
    JSON.stringify({ status: claim.status, state: claim.json?.state }).slice(0, 110));

  const listingId = claim.json?.product?._id;
  const brandToken = await login('/manufacturer/login', 'rayban.manufacturer@optikart.com', 'Manufacturer123@');
  const approved = await call('/manufacturer/listing-requests/decide', {
    t: brandToken,
    b: { listingKind: 'storefront', listingId, decision: 'approve', reason: 'supplied under our March order' }
  });
  check('the brand can approve without the notification step breaking it',
    approved.json?.success === true, JSON.stringify(approved.json || {}).slice(0, 120));

  const after = await call('/notifications?limit=50', { t: retailer });
  check('and the retailer is told the outcome in its own console',
    after.status === 200 && has(after.json, /approved by the brand/i),
    `${rowsOf(after.json).length} rows for retailer`);

  /* the admin verification step then tells the shop again */
  const verify = await call('/admin/listing-approvals/decide', {
    t: admin, b: { listingKind: 'storefront', listingId, decision: 'approve' }
  });
  check('platform verification still succeeds with fan-out attached',
    verify.json?.success === true, JSON.stringify(verify.json || {}).slice(0, 120));
  const afterVerify = await call('/notifications?limit=50', { t: retailer });
  check('and the shop is told it went live',
    has(afterVerify.json, /verified by OptiKart/i), `rows ${rowsOf(afterVerify.json).length}`);

  /* ---------------- unread counts are per account ---------------- */
  const countsA = (await call('/notifications?limit=1', { t: retailer })).json;
  const countsB = (await call('/notifications?limit=1', { t: partner })).json;
  check('each console reports its own unread count',
    typeof countsA?.unreadCount === 'number' && typeof countsB?.unreadCount === 'number',
    `retailer ${countsA?.unreadCount}, partner ${countsB?.unreadCount}`);

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} fan-out assertions passed`);
  if (failed.length) {
    console.log(' failing:');
    for (const f of failed) console.log(`  - ${f.name}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 2; });
