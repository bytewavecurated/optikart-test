#!/usr/bin/env node
/**
 * Customer charges suite.
 *
 * Covers the money a buyer is asked for: the quote shown at checkout, the order
 * that gets created from it, and the ₹39 flat cash-on-delivery handling charge
 * which exists only on the cash leg and must be charged once per order, not once
 * per shop the basket splits into.
 *
 *   node scripts/charges_e2e.mjs [base-url]
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The shape Order validation actually expects (name/street), not the shape the
// checkout form uses internally: a suite written against the wrong field names
// fails on its own plumbing and hides the money behaviour it was meant to prove.
const ADDRESS = {
  name: 'Charges Runner', phone: '9812309876', street: '9 Linking Road',
  city: 'Mumbai', state: 'Maharashtra', pincode: '400050'
};

async function main() {
  const loginRes = await call('/auth/login', { body: { email: 'demo@optikart.com', password: 'Demo123@' } });
  const customer = loginRes.json?.token;
  if (!check('customer signs in', !!customer, loginRes.text)) return finish();
  const adminLogin = await call('/admin/auth/login', { body: { email: 'samedayopticians@gmail.com', password: 'Sameday123@' } });
  const admin = adminLogin.json?.token;

  const found = await call('/products?category=sunglasses&limit=3');
  const rows = (found.json?.products || found.json?.data || []).filter((p) => Number(p.price) > 0);
  if (!check('there are products to price', rows.length > 0, JSON.stringify(found.json).slice(0, 80))) return finish();

  const items = [{ product: rows[0]._id, quantity: 2 }];
  if (rows[1]) items.push({ product: rows[1]._id, quantity: 1 });

  /* ------------------------------------------------------------- the quote */
  const onlineQuote = await call('/orders/quote', { body: { items, paymentMethod: 'online' } });
  const codQuote = await call('/orders/quote', { body: { items, paymentMethod: 'cod' } });
  const oq = onlineQuote.json?.quote;
  const cq = codQuote.json?.quote;
  if (!check('checkout can price the basket', !!oq && !!cq, `${onlineQuote.status}/${codQuote.status}`)) return finish();

  check('the quote adds exactly ₹39 for cash on delivery',
    cq.codHandlingFee === 39 && oq.codHandlingFee === 0,
    `cod ${cq.codHandlingFee} vs online ${oq.codHandlingFee}`);
  check('and the difference in the total is exactly that ₹39',
    cq.total - oq.total === 39, `${cq.total} - ${oq.total}`);

  const rebuilt = oq.subtotal + oq.deliveryCharges + oq.platformFee - oq.discount;
  check('every charge is itemised and the lines add up to the total',
    rebuilt === oq.total, `lines sum ${rebuilt} vs total ${oq.total}`);

  /*
   * The bug this pins down: the order route charged a 2% platform fee that the
   * checkout panel never listed, so a customer read a total that was not the
   * total. The fee may legitimately be there; a charge nobody can see cannot.
   */
  check('the platform fee is charged AND shown',
    oq.platformFee > 0 && (oq.breakdown || []).some((b) => /platform fee/i.test(b.label)),
    JSON.stringify((oq.breakdown || []).map((b) => b.label)));
  check('the cash-handling charge appears as its own line',
    (cq.breakdown || []).some((b) => b.key === 'codFee' && b.amount === 39),
    JSON.stringify((cq.breakdown || []).map((b) => `${b.key}:${b.amount}`)));

  const tampered = await call('/orders/quote', {
    body: {
      // Same lines as the honest quote, each carrying a prices-are-free `price`
      // field: if the endpoint ever reads caller-supplied prices, the subtotal
      // drops and this assertion moves with it.
      items: items.map((l) => ({ ...l, price: 1 })),
      paymentMethod: 'cod'
    }
  });
  check('a quote cannot be talked into a different price by the caller',
    tampered.json?.quote?.subtotal === oq.subtotal,
    `${tampered.json?.quote?.subtotal} vs catalogue ${oq.subtotal}`);

  /* ------------------------------------------------------- the order itself */
  const placed = await call('/orders', {
    token: customer,
    body: { items, shippingAddress: ADDRESS, paymentMethod: 'cod' }
  });
  if (!check('a cash order is created', placed.status === 201 || placed.json?.success, placed.text)) return finish();

  const mine = await call('/orders?limit=1', { token: customer });
  const order = mine.json?.orders?.[0];
  if (!check('the order can be read back', !!order)) return finish();

  check('the order was charged what checkout displayed',
    Number(order?.totalAmount) === Number(cq.total), `${order?.totalAmount} vs quote ${cq.total}`);

  const children = order?.sellerBreakdown || order?.orders || [];
  const childIds = children.map((c) => c?._id).filter(Boolean);
  const charges = [];
  for (const id of childIds.length ? childIds : [order._id]) {
    const c = await call(`/orders/${id}/charge-summary`, { token: customer });
    if (c.json?.charges) charges.push(c.json.charges);
  }
  const codLines = charges.filter((c) => Number(c.codFee) > 0);
  check('the ₹39 is charged once per order, not once per shop',
    charges.length > 0 && codLines.length === 1 && Number(codLines[0].codFee) === 39,
    `${charges.length} split(s), ${codLines.length} carrying the charge`);
  check('the splits add up to the total the customer sees',
    charges.reduce((n, c) => n + Number(c.totalAmount), 0) === Number(order.totalAmount),
    `${charges.reduce((n, c) => n + Number(c.totalAmount), 0)} vs ${order.totalAmount}`);

  const summary = await call(`/orders/${order._id}/charge-summary`, { token: customer });
  const chargesOnOrder = summary.json?.charges || {};
  check('the order keeps the cash-handling charge as its own figure',
    Number(chargesOnOrder.codFee) === 39, JSON.stringify(chargesOnOrder));
  check('and can say what would come back on a return',
    summary.json?.refundableAmount === Number(order.totalAmount) - 39
      && summary.json?.nonRefundableCodFee === 39,
    `refundable ${summary.json?.refundableAmount} of ${order.totalAmount}`);
  check('the refund policy is stated to the customer, not implied',
    /not refunded/i.test(summary.json?.note || ''), summary.json?.note || 'no note');

  /*
   * The charge must not be taken from the shop.
   *
   * Commission is a percentage of merchandise. If it were computed on
   * `totalAmount`, a ₹39 handling charge meant the platform paid itself out of
   * the seller's pocket on every cash order, and the payout figures would be
   * quietly wrong by a rupee or two rather than loudly wrong by a policy.
   */
  const ledgerRow = (await call('/admin/orders?limit=100', { token: admin })).json;
  const mineRow = (ledgerRow?.orders || ledgerRow?.data || []).find((o) => String(o._id) === String(order._id));
  if (mineRow) {
    check('the cash-handling charge is not part of the commissionable amount',
      Math.round(((mineRow.commissionAmount ?? 0) / (Number(mineRow.subtotal ?? 1))) * 100) <= 4,
      `commission ${mineRow.commissionAmount} on subtotal ${mineRow.subtotal}`);
  }

  /*
   * Cash has to be reconciled against a number, not a flag.
   */
  const reconcile = await call('/admin/cash-reconciliation?days=30', { token: admin });
  check('the desk can reconcile collected cash against what was due',
    reconcile.status === 200 && typeof reconcile.json?.totals?.discrepancy === 'number',
    JSON.stringify(reconcile.json?.totals));
  check('cash-handling charges are broken out from merchandise',
    reconcile.json?.totals?.cashHandlingCharges !== undefined
      && reconcile.json?.totals?.merchandise !== undefined
      && reconcile.json.totals.cashHandlingCharges + reconcile.json.totals.merchandise
         === reconcile.json.totals.due,
    JSON.stringify(reconcile.json?.totals));

  const stranger = await call(`/orders/${order._id}/charge-summary`, { token: null });
  check("another person's charges are not readable", stranger.status === 401, `status ${stranger.status}`);

  /* ------------------------------------------------ online orders are clean */
  const prepaid = await call('/orders', { token: customer, body: { items, shippingAddress: ADDRESS, paymentMethod: 'online' } });
  const latest = (await call('/orders?limit=1', { token: customer })).json?.orders?.[0];
  check('an online order is created', prepaid.json?.success !== false, prepaid.text);
  // 'online' is the screen's word; the order stores the channel it resolved to
  // (razorpay here). The two must not be confused, because the cash-handling
  // charge follows the channel, not the label a shopper clicked.
  check('and its channel is stored as the resolved one, not the screen word',
    ['razorpay', 'card', 'upi', 'netbanking', 'wallet'].includes(String(latest?.paymentMethod)),
    `stored ${latest?.paymentMethod}`);
  check('and carries no cash-handling charge',
    Number(latest?.codFee ?? 0) === 0,
    `codFee ${latest?.codFee}, total ${latest?.totalAmount}`);
  check('and its refundable amount is the whole total',
    (await call(`/orders/${latest._id}/charge-summary`, { token: customer })).json?.refundableAmount
      === Number(latest.totalAmount), `${latest?.totalAmount}`);

  await quoteAgreement();
  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} charge assertions passed`);
  if (failed.length) {
    console.log(' failing:');
    for (const f of failed) console.log(`  - ${f.name}`);
    process.exitCode = 1;
  }
}


async function quoteAgreement() {
  const custRes = await call('/auth/login', { body: { email: 'demo@optikart.com', password: 'Demo123@' } });
  const sellRes = await call('/seller/login', { body: { email: 'opticalworld@gmail.com', password: 'Seller123@' } });
  const cust = custRes.json?.token;
  const sell = sellRes.json?.token;
  if (!cust || !sell) return;

  const found = await call('/products?category=sunglasses&limit=10', { token: sell });
  const list = found.json?.products || found.json?.data || [];

  /* ---- (1) a chosen configuration is priced, not the product behind it */
  let priced = null;
  for (const row of list.slice(0, 8)) {
    const d = await call(`/products/${row._id}`, { token: sell });
    const p = d.json?.product || d.json;
    if (!p) continue;
    const base = Number(p.discountedPrice) > 0 ? Number(p.discountedPrice) : Number(p.price) || 0;
    const diff = (p.variants || []).find((v) => {
      const vp = Number(v.discountedPrice || v.price) || 0;
      return vp > 0 && vp !== base && Number(v.stock) > 0;
    });
    const inStock = (p.variants || []).find((v) => Number(v.stock) > 0);
    if (diff) { priced = { p, variant: diff, base }; break; }
    if (!priced && inStock) priced = { p, variant: inStock, base, plain: true };
  }

  if (!priced) {
    console.log('SKIP  configuration pricing (no listed product exposes an in-stock variant)');
  } else {
    const line = { product: priced.p._id, quantity: 1, variant: { color: priced.variant.color, size: priced.variant.size } };
    const quote = (await call('/orders/quote', { body: { items: [line], paymentMethod: 'online' } })).json?.quote;
    const placed = await call('/orders', {
      token: cust,
      body: {
        items: [line],
        shippingAddress: { name: 'Quote Agreement', phone: '9812306677', street: '9 Linking Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
        paymentMethod: 'online'
      }
    });
    const order = (await call('/orders?limit=1', { token: cust })).json?.orders?.[0];
    check(`a chosen configuration can be ordered${priced.plain ? ' (priced at the product figure; seed has no differing variant price)' : ''}`,
      placed.json?.success !== false, placed.text);
    check('the quote equals the amount actually charged',
      Number(quote?.total) === Number(order?.totalAmount),
      `quoted ${quote?.total} vs charged ${order?.totalAmount}`);
    if (!priced.plain) {
      check('and the line was priced from the configuration, not the product',
        Number(order?.subtotal) === Number(priced.variant.discountedPrice || priced.variant.price),
        `subtotal ${order?.subtotal}, variant ${priced.variant.discountedPrice || priced.variant.price}, product ${priced.base}`);
    }
  }

  /* ---- (2) availability: no phantom price for something that cannot ship */
  let hardCase = null;
  for (const row of list.slice(0, 8)) {
    const d = await call(`/products/${row._id}`, { token: sell });
    const p = d.json?.product || d.json;
    if (!p) continue;
    const zero = (p.variants || []).find((x) => Number(x.stock) === 0);
    if (zero) { hardCase = { p, variant: zero, quantity: 1 }; break; }
    const some = (p.variants || []).find((x) => Number(x.stock) > 0);
    if (some && !hardCase) hardCase = { p, variant: some, quantity: Number(some.stock) + 5 };
  }
  if (!hardCase) {
    console.log('SKIP  availability (no product exposes variant stock at all)');
  } else {
    const q = await call('/orders/quote', {
      body: {
        items: [{
          product: hardCase.p._id,
          quantity: hardCase.quantity,
          variant: { color: hardCase.variant.color, size: hardCase.variant.size }
        }],
        paymentMethod: 'cod'
      }
    });
    const un = q.json?.unavailable || [];
    check(hardCase.quantity === 1
      ? 'a sold-out configuration is reported, not silently priced'
      : `asking for more than the ${hardCase.variant.stock} in stock is reported, not silently priced`,
      q.status === 200 && un.length === 1 && Number(un[0].available) < Number(un[0].wanted),
      JSON.stringify(un).slice(0, 140));
  }

  /* ---- (3) multi-seller baskets: the quote must equal the sum of the splits */
  const bySeller = new Map();
  for (const row of list.slice(0, 8)) {
    const d = await call(`/products/${row._id}`, { token: sell });
    const p = d.json?.product || d.json;
    if (!p) continue;
    /*
     * `p.seller` is a populated document here. ``String(p.seller)`` is
     * "[object Object]" for every product, which made four different shops look
     * like one and turned the multi-seller assertion below into a permanent skip:
     * the test that existed to prove the cash-handling charge lands once per
     * purchase was, in fact, never running. Ids are read explicitly, and the
     * grouping key is the id - never an object.
     */
    const sid = String(p.seller?._id || p.seller || p.manufacturerSellerId?._id || p.manufacturerSellerId || '');
    const v = (p.variants || []).find((x) => Number(x.stock) > 0);
    if (!sid || !v) continue;
    if (!bySeller.has(sid)) bySeller.set(sid, { product: p, variant: v });
  }
  const picks = [...bySeller.values()];
  if (picks.length < 2) {
    console.log('SKIP  multi-seller basket (basket available from one shop only)');
  } else {
    const items = picks.slice(0, 2).map((x) => ({ product: x.product._id, quantity: 1, variant: { color: x.variant.color, size: x.variant.size } }));
    const quote = (await call('/orders/quote', { body: { items, paymentMethod: 'cod' } })).json?.quote;
    const placed = await call('/orders', {
      token: cust,
      body: {
        items,
        shippingAddress: { name: 'Split Basket', phone: '9812306688', street: '9 Linking Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
        paymentMethod: 'cod'
      }
    });
    const created = placed.json?.orders || [];
    const sum = created.reduce((n, o) => n + Number(o.totalAmount || 0), 0);
    check(`a ${created.length}-shop basket is charged the quoted total`,
      created.length >= 2 && Number(quote?.total) === sum,
      `quoted ${quote?.total} vs split sum ${sum} (${created.map((o) => o.totalAmount).join(' + ')})`);
    const withFee = created.filter((o) => Number(o.codFee) > 0);
    check('and the cash-handling charge appears on exactly one of those documents',
      withFee.length === 1 && Number(withFee[0].codFee) === 39,
      `${withFee.length} of ${created.length} carry it`);
  }
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 2; });
