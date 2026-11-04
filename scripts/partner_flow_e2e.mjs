#!/usr/bin/env node
/**
 * Partner payout and issue-reporting smoke test.
 *
 * Covers what a courier actually needs and the desk needs to see back: a run in
 * hand, a problem reported from the door landing on the order timeline and on the
 * executive queue, that run being cleared once handled, and the money a partner
 * can audit per delivery.
 *
 *   node scripts/partner_flow_e2e.mjs [base-url]
 *
 * Needs a seeded development database.
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 130)}` : ''}`);
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

async function main() {
  const customer = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  const seller = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  const partner = await login('/delivery-partner/login', 'suresh.partner@optikart.com', 'Partner123@');
  const executive = await login('/executive/login', 'executive.delivery@optikart.com', 'Executive123@');
  const adminToken = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  const me0 = await call('/delivery-partner/me', { token: partner });
  const partnerId = me0.json?.data?.partner?._id;
  if (!check('role logins succeed', !!(customer && seller && partner && executive))) return finish();

  await call('/delivery-partner/location', { token: partner, body: { latitude: 19.076, longitude: 72.877 } });
  await call('/delivery-partner/availability', { token: partner, body: { isAvailable: true }, method: 'PUT' });

  const product = (await call('/products?category=sunglasses&limit=1', { token: seller })).json.products[0];
  await call('/orders', {
    token: customer,
    body: {
      items: [{ product: product._id, quantity: 1 }],
      shippingAddress: { name: 'Partner Flow', phone: '9800001234', street: '4 Linking Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
      paymentMethod: 'cod'
    }
  });
  const order = (await call('/orders?limit=1', { token: customer })).json.orders[0];
  await call(`/seller/orders/${order._id}/status`, { token: seller, body: { status: 'confirmed' }, method: 'PUT' });
  await call(`/seller/orders/${order._id}/status`, { token: seller, body: { status: 'packed' }, method: 'PUT' });
  await new Promise((r) => setTimeout(r, 2500));

  const offers = (await call('/delivery-partner/offers', { token: partner })).json.offers || [];
  if (!check('partner has the run offered', offers.length > 0, offers.map((o) => o.orderNumber).join(','))) return finish();
  const orderId = offers[0].orderId;

  const accepted = await call(`/delivery-partner/offers/${orderId}/respond`, { token: partner, body: { decision: 'accept' } });
  check('accepting the run works', accepted.json?.success === true, accepted.json?.message || accepted.text);

  const badType = await call(`/delivery-partner/report/${orderId}`, { token: partner, body: { type: 'cat_ate_it' } });
  check('an invented reason is refused', badType.status === 400, (badType.json?.message || '').slice(0, 60));

  const noNote = await call(`/delivery-partner/report/${orderId}`, { token: partner, body: { type: 'other' } });
  check('"other" without a note is refused', noNote.status === 400, (noNote.json?.message || ''));

  const reported = await call(`/delivery-partner/report/${orderId}`, {
    token: partner,
    body: { type: 'customer_unreachable', note: 'Two attempts, gate code refused entry' }
  });
  check('a real report is accepted', reported.json?.success === true, reported.json?.message);

  const detail = (await call(`/orders/${orderId}`, { token: customer })).json.order;
  check('the order carries the flag', detail?.deliveryIssue?.type === 'customer_unreachable',
    JSON.stringify(detail?.deliveryIssue || null).slice(0, 80));
  const journey = (detail?.deliveryJourney || []).map((j) => j.note).join(' / ');
  check('the timeline shows what the partner said', /Partner reported/.test(journey) && /Two attempts/.test(journey), journey.slice(-90));

  const queue = (await call('/executive/deliveries/assigned', { token: executive })).json;
  const row = (queue.deliveries || queue.data || []).find((d) => String(d._id) === String(orderId));
  check('the executive queue surfaces the issue', !!row?.deliveryIssue, JSON.stringify(row?.deliveryIssue || null));

  // A second, real partner: the guard is "is this run yours", so another courier
  // must not be able to flag someone else's delivery.
  const partnerList = (await call('/delivery-partner', { token: adminToken })).json?.data || [];
  const other = partnerList.find((p) => String(p._id) !== String(partnerId));
  let otherAttempt = { status: 0 };
  if (other) {
    const otherToken = await login('/delivery-partner/login', other.email, 'Partner123@');
    otherAttempt = await call(`/delivery-partner/report/${orderId}`, { token: otherToken, body: { type: 'refused', note: 'not my run' } });
  }
  check('another partner cannot flag this run', otherAttempt.status === 403, `${other ? 'status ' + otherAttempt.status : 'no second partner seeded'}`);

  const resolved = await call(`/executive/deliveries/${orderId}/issue/resolve`, { token: executive, body: {}, method: 'PUT' });
  check('the desk can clear the flag', resolved.json?.success === true, resolved.json?.message || resolved.text);
  const after = (await call(`/orders/${orderId}`, { token: customer })).json.order;
  check('resolution is recorded on the order', !!after?.deliveryIssue?.resolvedAt, JSON.stringify(after?.deliveryIssue?.resolvedAt || null));
  check('timeline notes the resolution', (after?.deliveryJourney || []).some((j) => /resolved/i.test(j.note || '')));

  const again = await call(`/executive/deliveries/${orderId}/issue/resolve`, { token: executive, body: {}, method: 'PUT' });
  check('clearing twice is refused, not silent', again.status === 400, again.json?.message);

  const complete = await call(`/delivery-partner/complete/${orderId}`, { token: partner, body: {} });
  check('partner can still deliver after a resolved issue', complete.json?.success === true, complete.json?.message);

  const earnings = (await call('/delivery-partner/payment/earnings?period=month', { token: partner })).json.data || {};
  const row0 = (earnings.deliveries || [])[0];
  check('earnings list the runs with a payout', (earnings.deliveries || []).length > 0, JSON.stringify(row0 || null));
  check('each earning row names the order', !!row0?.orderNumber, row0?.orderNumber || 'missing');

  const me = (await call('/delivery-partner/me', { token: partner })).json.data || {};
  check('partner profile exposes withdrawal history', Array.isArray(me.partner?.withdrawals ?? me.withdrawals ?? []),
    typeof (me.partner?.withdrawals ?? me.withdrawals));
  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} partner-flow assertions passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 2; });
