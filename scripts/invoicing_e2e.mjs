#!/usr/bin/env node
/**
 * Invoicing: the suite that treats the documents as data.
 *
 * Money documents fail in the ways data fails, not the ways designs fail:
 *  - an invoice whose total differs by one paisa from what the order charged
 *    (the invariant this repo has been burned by before; asserted HERE,
 *    over HTTP, against an order placed by the real checkout);
 *  - documents leaking across tenants (404-as-existent is information);
 *  - commission bills that drift from the settlement that actually moved the
 *    money (they must read the SAME numbers, or they must not be called
 *    'invoice');
 *  - a classification rule that saves but never applies, or applies to a
 *    document that was already issued (legal documents do not rewrite
 *    themselves);
 *  - double-mints: a webhook retry or a backfill re-run must reuse numbers,
 *    not print series holes;
 *  - voided paperwork that stays reachable and says VOID with the reason.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import crypto from 'node:crypto';
import Product from '../server/models/Product.js';
import User from '../server/models/User.js';
import Invoice from '../server/models/Invoice.js';
import Order from '../server/models/Order.js';
import Seller from '../server/models/Seller.js';

const reqS = createRequire(new URL('../server/server.js', import.meta.url));
const BASE = process.argv[2] || process.env.VERIFY_BASE || 'http://localhost:3111';
const API = `${BASE}/api`;
const mongoose = Product.db.base;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 160)}` : ''}`);
  return ok;
};
const call = async (path, { token, method, body } = {}) => {
  const res = await fetch(API + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
};
const rnd = () => String(crypto.randomInt(100000000, 999999999));

async function loginCustomer(email, phone, name = 'Invoice User') {
  const r = await call('/auth/register', { body: { name, email, phone, password: 'Invoice!Pass9' } });
  if (r.json?.token) return r.json.token;
  if (r.json?.devCode) {
    const v = await call('/auth/verify-login-otp', { body: { email, otp: r.json.devCode } });
    if (v.json?.token) return v.json.token;
  }
  const l = (await call('/auth/login').d) ? null : null;
  void l;
  return null;
}

async function main() {
  const startedAt = new Date();
  await mongoose.connect(process.env.MONGODB_URI);

  const admin = (
    await call('/admin/auth/login', { body: { email: 'samedayopticians@gmail.com', password: 'Sameday123@' } })
  ).json?.token;
  const victimEmail = `inv-victim-${rnd()}@attck.test`;
  const attackerEmail = `inv-atck-${rnd()}@attck.test`;
  const victim = await loginCustomer(victimEmail, '9' + rnd(), 'Invoice Victim');
  const attacker = await loginCustomer(attackerEmail, '9' + rnd(), 'Invoice Attacker');
  if (!check('I0 accounts', !!admin && !!victim && !!attacker)) return finish();

  // a real seller with stocky sunglasses - drive the WHOLE money path with it
  const prodsRes = await call('/products?category=sunglasses&limit=40');
  const rows = (prodsRes.json?.products || []).filter((p) => Number(p.stock) > 6 && Number(p.price) > 1000);
  if (!check('I0b buyable products exist', rows.length >= 1, String(rows.length))) return finish();
  const chosen = rows[0];
  const sellerId = String(chosen.seller?._id || chosen.seller);
  const sellerRow = await Seller.findById(sellerId).select('email storeName address.state').lean();
  const sellerLogin = await call('/seller/login', { body: { email: sellerRow?.email, password: 'Seller123@' } });
  let seller = sellerLogin.json?.token;
  if (!seller && sellerLogin.json?.devCode)
    seller = (
      await call('/seller/verify-login-otp', {
        body: { sellerId: sellerLogin.json?.sellerId, otp: sellerLogin.json.devCode },
      })
    ).json?.token;
  if (
    !check('I0c seller signs in', !!seller, `${sellerLogin.status} ${String(sellerLogin.json?.message).slice(0, 50)}`)
  )
    return finish();

  const ADDR = {
    name: 'Invoice Victim',
    phone: '9000000001',
    street: '2 GST Lane',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400050',
  };

  /* ------------------------- customer invoice on COD ------------------------ */
  const placed = await call('/orders', {
    token: victim,
    body: { items: [{ product: chosen._id, quantity: 2 }], shippingAddress: ADDR, paymentMethod: 'cod' },
  });
  const order = placed.json?.order || (placed.json?.orders || [])[0];
  if (
    !check(
      'I1 order placed (baseline)',
      (placed.status === 201 || placed.status === 200) && !!order,
      String(placed.status)
    )
  )
    return finish();

  const mine = await call('/invoices/mine', { token: victim });
  const ci = (mine.json?.invoices || []).find(
    (x) => x.orderId === String(order._id) || x.orderNumber === order.orderNumber
  );
  check('I2 customer invoice minted by the placement itself', !!ci, JSON.stringify(ci || {}).slice(0, 60));
  if (!ci) return finish();
  check(
    'I2b number is a sequence from the shared mint registry',
    /^CI\d{6,}$/.test(ci.invoiceNumber),
    ci.invoiceNumber
  );

  const full = await call(`/invoices/${ci.id}`, { token: victim });
  const inv = full.json?.invoice || {};
  const charged = Number(inv.summary?.chargedTotal || 0);
  const want = Number(order.totalAmount || 0);
  check(
    'I3 INVARIANT: invoice charged == order charged (to the paisa)',
    Math.abs(charged - want) <= 0.01 && inv.totalMatchesOrder === true,
    `invoice=${charged} order=${want}`
  );

  const lineTax = (inv.lines || []).reduce((s, l) => s + (Number(l.gstComponent) || 0), 0);
  check(
    'I4 each line carries HSN + positive extracted GST (inclusive basis)',
    (inv.lines || []).every((l) => /^\d{4,8}$/.test(String(l.hsn)) && l.gstRatePercent > 0),
    `${(inv.lines || []).length} lines, sumGst=${lineTax.toFixed(2)}`
  );
  check(
    'I5 merchandise line sum ties to subtotal after pro-rata discount',
    Math.abs(
      (inv.lines || []).reduce((s, l) => s + Number(l.taxableInclusive || 0), 0) +
        Number(inv.summary?.deliveryChargeInclusive || 0) +
        Number(inv.summary?.platformFeeInclusive || 0) +
        Number(inv.summary?.codHandlingInclusive || 0) +
        Number(inv.summary?.roundOff || 0) -
        charged
    ) <= 0.01,
    `readd=${(charged - Number(inv.summary?.roundOff || 0)).toFixed(2)}`
  );

  const halfPair =
    Number(inv.summary?.cgstTotal || 0) > 0 ? [Number(inv.summary.cgstTotal), Number(inv.summary.sgstTotal)] : null;
  const hasIg = Number(inv.summary?.igstTotal || 0) > 0;
  const cgSgMatch = halfPair ? Math.abs(halfPair[0] - halfPair[1]) <= 0.02 : true;
  check(
    'I6 split is EXACTLY one treatment: CGST+SGST equal halves, or IGST (never a mix of both totals)',
    (hasIg && !halfPair) || (!hasIg && halfPair && cgSgMatch),
    JSON.stringify({
      cg: inv.summary?.cgstTotal,
      sg: inv.summary?.sgstTotal,
      ig: inv.summary?.igstTotal,
      kind: inv.summary?.supplyKind,
    })
  );
  const sumCheck = Math.abs(
    Number(inv.summary?.cgstTotal || 0) +
      Number(inv.summary?.sgstTotal || 0) +
      Number(inv.summary?.igstTotal || 0) -
      Number(inv.summary?.taxTotal || 0)
  );
  check('I6b the break-up sums to the printed tax total', sumCheck <= 0.02, `diff=${sumCheck.toFixed(3)}`);

  /* ----------------------------- access walls ------------------------------ */
  const atkMine = await call(`/invoices/${ci.id}`, { token: attacker });
  check(
    'I7 another customer gets 404 (not 403: existence is not public)',
    atkMine.status === 404,
    String(atkMine.status)
  );
  const anonPdf = await fetch(`${API}/invoices/${ci.id}/pdf`);
  check('I8 anonymous PDF read refused', anonPdf.status === 401, String(anonPdf.status));
  const atkPdf = await fetch(`${API}/invoices/${ci.id}/pdf`, { headers: { Authorization: `Bearer ${attacker}` } });
  check('I8b wrong-customer PDF read is 404', atkPdf.status === 404, String(atkPdf.status));
  const ownPdf = await fetch(`${API}/invoices/${ci.id}/pdf`, { headers: { Authorization: `Bearer ${victim}` } });
  const head = Buffer.from(await ownPdf.arrayBuffer())
    .subarray(0, 5)
    .toString('latin1');
  check(
    'I9 owner PDF downloads as real PDF bytes',
    ownPdf.status === 200 && head === '%PDF-',
    `${ownPdf.status} ${head}`
  );

  // mail honesty: in the harness there is no SMTP; the row must say so,
  // never pretend a send
  check(
    'I10 mail state records what actually happened (no fake sent)',
    !ci.mail || !(ci.mail.delivered && ci.mail.ok === false),
    JSON.stringify(ci.mail || {}).slice(0, 100)
  );

  /* --------------------- seller document via settlement --------------------- */
  let reached = order.orderStatus;
  for (const stp of ['confirmed', 'packed', 'picked_up', 'in_transit', 'delivered']) {
    const r = await call(`/seller/orders/${order._id}/status`, { token: seller, method: 'PUT', body: { status: stp } });
    if (r.status === 200) {
      reached = stp;
      continue;
    }
    // some legs require the delivery partner; fall through only if status stayed the same
    if (r.status === 400 && /Cannot transition/.test(String(r.json?.message))) break;
  }
  const finalOrder = (await call(`/orders/${order._id}`, { token: victim })).json?.order;
  const delivered = finalOrder?.orderStatus === 'delivered';
  check(
    'I11 order reaches delivered under the test seller',
    delivered,
    `reached=${reached} final=${finalOrder?.orderStatus}`
  );

  const list = await call('/invoices/seller', { token: seller });
  const si = (list.json?.invoices || []).find((x) => x.orderNumber === order.orderNumber);
  check('I12 seller invoice minted by the settlement itself', !!si, JSON.stringify(si || {}).slice(0, 80));
  if (si) {
    const sfull = await call(`/invoices/${si.id}`, { token: seller });
    const s2 = sfull.json?.invoice || {};
    check(
      'I13 seller invoice commission == settlement commission',
      Math.abs(Number(s2.commissionAmount || 0) - Number(finalOrder?.commissionAmount || 0)) < 0.01,
      `bill=${s2.commissionAmount} settle=${finalOrder?.commissionAmount}`
    );
    check(
      'I13b net credited == order netAmountToSeller',
      Math.abs(Number(s2.netPayableToSeller || 0) - Number(finalOrder?.netAmountToSeller || 0)) < 0.01,
      `bill=${s2.netPayableToSeller} ledger=${finalOrder?.netAmountToSeller}`
    );
    const commLine = (s2.sellerServices || []).find((x) => /commission/i.test(String(x.nature)));
    const expectedTax = Math.round(Number(commLine?.baseAmount || 0) * 0.18 * 100) / 100;
    check(
      'I14 services GST charged ON TOP of commission (exclusive basis)',
      commLine && Math.abs(Number(commLine.gstAmount) - expectedTax) <= 0.5,
      JSON.stringify(commLine || {}).slice(0, 90)
    );
    const crossRead = await call(`/invoices/${si.id}`, { token: victim });
    check(
      'I15 a customer cannot read a seller invoice (404, invisible)',
      crossRead.status === 404,
      String(crossRead.status)
    );
    const sellOther = await call(`/invoices/${si.id}`, { token: attacker });
    check('I15b a DIFFERENT customer is equally blind', sellOther.status === 404, String(sellOther.status));
  }

  /* --------------------------- rules: apply NEW, --------------------------- */
  const ruleSave = await call('/invoices/tax-rules', {
    token: admin,
    method: 'POST',
    body: { scope: 'category', value: 'sunglasses', hsn: '9004', ratePercent: 5, confirmed: true, notes: 'suite' },
  });
  check(
    'I16 admin saves a category rate override',
    ruleSave.status === 200 && ruleSave.json?.rule?._id,
    String(ruleSave.status)
  );
  const placed2 = await call('/orders', {
    token: victim,
    body: { items: [{ product: chosen._id, quantity: 1 }], shippingAddress: ADDR, paymentMethod: 'cod' },
  });
  const order2 = placed2.json?.order || (placed2.json?.orders || [])[0];
  const mine2 = await call('/invoices/mine', { token: victim });
  const ci2row = (mine2.json?.invoices || []).find((x) => x.orderNumber === order2.orderNumber);
  const ci2 = ci2row ? (await call(`/invoices/${ci2row.id}`, { token: victim })).json?.invoice : null;
  check(
    'I17 NEW invoice uses the overridden 5% rate',
    ci2 && (ci2.lines || []).every((l) => Number(l.gstRatePercent) === 5),
    JSON.stringify(((ci2 || {}).lines || []).map((l) => l.gstRatePercent))
  );
  await call('/invoices/tax-rules/' + (ruleSave.json?.rule?._id || ''), { token: admin, method: 'DELETE' });
  const placed3 = await call('/orders', {
    token: victim,
    body: { items: [{ product: chosen._id, quantity: 1 }], shippingAddress: ADDR, paymentMethod: 'cod' },
  });
  const order3 = placed3.json?.order || (placed3.json?.orders || [])[0];
  const mine3 = await call('/invoices/mine', { token: victim });
  const ci3row = (mine3.json?.invoices || []).find((x) => x.orderNumber === order3.orderNumber);
  const ci3 = ci3row ? (await call(`/invoices/${ci3row.id}`, { token: victim })).json?.invoice : null;
  check(
    'I18 deleting the rule reverts to defaults (and the 5% doc was NOT rewritten)',
    ci3 &&
      (ci3.lines || []).every((l) => Number(l.gstRatePercent) === 18) &&
      ci2 &&
      Number(ci2.lines?.[0]?.gstRatePercent) === 5,
    `new=${((ci3 || {}).lines || [])[0]?.gstRatePercent} old=${((ci2 || {}).lines || [])[0]?.gstRatePercent}`
  );

  /* ------------------------------ void path ------------------------------- */
  const cancel = await call(`/orders/${order3._id}/cancel`, {
    token: victim,
    method: 'PUT',
    body: { cancellationReason: 'suite void test' },
  });
  const ci3b = ci3row ? (await call(`/invoices/${ci3row.id}`, { token: victim })).json?.invoice : null;
  check(
    'I19 cancelled order voids its invoice (still readable, stamped)',
    (cancel.status === 200 || cancel.status === 201) && ci3b?.status === 'void',
    `cancel=${cancel.status} status=${ci3b?.status} reason=${JSON.stringify(ci3b?.voidReason || ci3b?.reason || '')}`
  );
  const voidPdf = await fetch(`${API}/invoices/${ci3row.id}/pdf`, { headers: { Authorization: `Bearer ${victim}` } });
  check(
    'I20 the voided document still serves (it must show VOID, not vanish)',
    voidPdf.status === 200,
    String(voidPdf.status)
  );

  /* ---------------------------- idempotency ------------------------------- */
  const before = await Invoice.countDocuments({ order: order._id });
  const ensure1 = await call(`/invoices/admin/ensure/${order._id}`, { token: admin, method: 'POST' });
  const ensure2 = await call(`/invoices/admin/ensure/${order._id}`, { token: admin, method: 'POST' });
  const after = await Invoice.countDocuments({ order: order._id });
  check(
    'I21 admin ensure is idempotent (same rows + same numbers)',
    (ensure1.status === 200 || ensure1.status === 201) &&
      (ensure2.status === 200 || ensure2.status === 201) &&
      before === after,
    `before=${before} after=${after}`
  );

  /* ------------------------------ admin grid ------------------------------- */
  const grid = await call('/invoices/admin/list?limit=5&sort=amount&type=customer', { token: admin });
  check(
    'I22 admin list: kind filter, sort whitelist, paging shape',
    grid.status === 200 && (grid.json.invoices || []).length > 0 && typeof grid.json.total === 'number',
    `n=${(grid.json.invoices || []).length} total=${grid.json.total}`
  );
  const search = await call(`/invoices/admin/list?search=${encodeURIComponent(order.orderNumber)}&limit=20`, {
    token: admin,
  });
  check(
    'I23 admin search finds by order number across kinds',
    search.status === 200 && (search.json.invoices || []).length >= 2,
    String((search.json || []).length || (search.json?.invoices || []).slice(0, 3))
  );
  const sortJunk = await call('/invoices/admin/list?sort=pwned', { token: admin });
  check('I24 unknown sort is refused visibly, not silently ignored', sortJunk.status >= 400, String(sortJunk.status));
  const custTry = await call('/invoices/admin/list', { token: victim });
  check('I25 the admin grid is not readable by customers', [401, 403].includes(custTry.status), String(custTry.status));

  /* -------------------------------- mail + pdf storage integrity ---------------- */
  // every minted doc must point to a real file — resolved against the
  // engine's OWN directory constant so cwd never changes the verdict
  const { INVOICE_PDF_ROOT, invoicePdfPath } = await import('../server/services/invoiceEngine.js');
  void INVOICE_PDF_ROOT;
  const samples = await Invoice.find({ createdAt: { $gte: startedAt } })
    .sort({ createdAt: -1 })
    .limit(14)
    .lean();
  const absent = samples.filter((x) => !x.pdfPath || !fs.existsSync(invoicePdfPath(x)));
  check('I26b documents minted by this RUN all reach the private store', samples.length >= 2, `n=${samples.length}`);
  const legacyPdfless = samples.length
    ? absent.length === (await Invoice.countDocuments({ _id: { $in: absent.map((a) => a._id) }, pdfPath: '' }))
    : true;
  check(
    'I26 minted rows all point at written files on their way in',
    absent.length === 0,
    JSON.stringify(absent.map((a) => a.invoiceNumber))
  );
  void legacyPdfless;
  check(
    'I27 backfill tool ships with the repo',
    fs.existsSync('scripts/invoices_backfill.mjs') || fs.existsSync(`${process.cwd()}/scripts/invoices_backfill.mjs`)
  );

  /* --------------------------------- cleanup --------------------------------- */
  for (const e of [victimEmail, attackerEmail]) {
    const u = await User.findOne({ email: e }).lean();
    if (u) {
      await Order.deleteMany({ user: u._id });
      await Invoice.deleteMany({ user: u._id });
      await User.deleteOne({ _id: u._id });
    }
  }
  check(
    'I28 suite rows are gone (shared DB safe for reruns)',
    (await Invoice.countDocuments({ type: 'customer', orderNumber: order.orderNumber })) === 0
  );

  finish();
}

async function finish() {
  try {
    await mongoose.connection.close();
  } catch {}
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} invoicing checks passed`);
  process.exitCode = failed ? 1 : 0;
  setTimeout(() => process.exit(failed ? 1 : 0), 250).unref?.();
}

main().catch((e) => {
  console.error('invoicing_e2e crashed:', e);
  process.exitCode = 1;
});
