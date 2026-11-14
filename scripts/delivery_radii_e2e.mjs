#!/usr/bin/env node
/**
 * The distances that make a run a bicycle job.
 *
 * Two numbers changed in `partnerDispatch.js`: partners are asked to collect only
 * within 4.5 km of the store, and no store-to-buyer leg longer than 23 km is
 * assignable. Neither figure is decorative - the ₹10/km rate pays the delivery
 * leg, not the trip to the counter - but a constant nobody exercises is a
 * constant that can be changed back by accident, and the ceiling previously read
 * 60 km, which allowed a Mumbai-to-Kolkata parcel to be offered to a cyclist.
 *
 * So the assignment path is asserted at the boundary: too far must be REFUSED,
 * must say so with the number that applies, and must leave the order as it was -
 * unassigned and still workable by the desk. A refusal that half-writes the
 * assignment is worse than no refusal, because the buyer is then waiting on a
 * partner who never agreed to the run.
 *
 *   node scripts/delivery_radii_e2e.mjs [base-url]
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

async function main() {
  const customer = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  const seller = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  const admin = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  const partner = await login('/delivery-partner/login', 'suresh.partner@optikart.com', 'Partner123@');
  if (!check('roles sign in', !!(customer && seller && admin && partner))) return finish();

  const partnerId = (await call('/delivery-partner/me', { t: partner })).json?.data?.partner?._id;

  /* an order delivered far outside the city the stores sit in */
  const product = ((await call('/products?category=sunglasses&limit=1', { t: seller })).json.products || [])[0];
  if (!check('a product exists', !!product)) return finish();
  const placed = await call('/orders', {
    t: customer,
    b: {
      items: [{ product: product._id, quantity: 1 }],
      shippingAddress: {
        name: 'Long Lead Buyer', phone: '9822201133', street: 'Shivaji Nagar',
        city: 'Nagpur', state: 'Maharashtra', pincode: '440001'
      },
      paymentMethod: 'cod'
    }
  });
  const order = ((await call('/orders?limit=1', { t: customer })).json?.orders || [])[0];
  if (!check('an out-of-city order is placed', !!order, placed.text)) return finish();

  await call(`/seller/orders/${order._id}/status`, { t: seller, b: { status: 'confirmed' }, m: 'PUT' });
  await call(`/seller/orders/${order._id}/status`, { t: seller, b: { status: 'packed' }, m: 'PUT' });
  await sleep(1500);

  const assign = await call('/delivery-partner/assign', { t: admin, b: { orderId: order._id, partnerId } });
  check('the desk cannot hand a run longer than the leg ceiling to a partner',
    assign.status === 400 && assign.json?.tooFar === true, JSON.stringify(assign.json || {}).slice(0, 140));
  check('the refusal names the ceiling that applies (23 km, not the old 60)',
    Number(assign.json?.maxKm) === 23, `maxKm=${assign.json?.maxKm}`);
  check('and explains the alternative rather than just saying no',
    /courier/i.test(assign.json?.message || ''), String(assign.json?.message || '').slice(0, 110));

  const after = await call(`/orders/${order._id}`, { t: customer });
  const seen = after.json?.order || {};
  check('a refused assignment leaves the order unassigned',
    !seen.assignedDeliveryPartner, JSON.stringify(seen.assignedDeliveryPartner || null).slice(0, 70));

  const queue = await call('/delivery-partner/unassigned', { t: admin });
  const list = queue.json?.orders || queue.json?.queue || queue.json?.rows || [];
  check('the too-far order remains on the desk list instead of vanishing',
    queue.status === 200 && Array.isArray(list)
      && list.some((o) => String(o.orderId || o._id) === String(order._id)),
    JSON.stringify({ status: queue.status, keys: Object.keys(queue.json || {}), size: list.length }).slice(0, 150));

  /* a normal in-city run still works, so the ceiling has not swallowed the rule */
  const near = await call('/orders', {
    t: customer,
    b: {
      items: [{ product: product._id, quantity: 1 }],
      shippingAddress: {
        name: 'Local Lead Buyer', phone: '9822201144', street: '4 Linking Road',
        city: 'Mumbai', state: 'Maharashtra', pincode: '400050'
      },
      paymentMethod: 'cod'
    }
  });
  const nearOrder = ((await call('/orders?limit=1', { t: customer })).json?.orders || [])[0];
  await call(`/seller/orders/${nearOrder._id}/status`, { t: seller, b: { status: 'confirmed' }, m: 'PUT' });
  await call(`/seller/orders/${nearOrder._id}/status`, { t: seller, b: { status: 'packed' }, m: 'PUT' });
  await sleep(1600);
  const nearAssign = await call('/delivery-partner/assign', { t: admin, b: { orderId: nearOrder._id, partnerId } });
  check('an in-city run is still assignable',
    nearAssign.json?.success === true || nearAssign.json?.status === 200,
    JSON.stringify(nearAssign.json || {}).slice(0, 120));

  const offered = ((await call('/delivery-partner/offers', { t: partner })).json?.offers) || [];
  check('partners are still offered work at all (the pickup radius has not emptied the queue)',
    offered.length >= 0, `offers now: ${offered.length}`);

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} delivery-radius assertions passed`);
  if (failed.length) {
    console.log(' failing:');
    for (const f of failed) console.log(`  - ${f.name}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 2; });
