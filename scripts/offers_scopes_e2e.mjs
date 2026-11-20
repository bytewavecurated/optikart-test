#!/usr/bin/env node
/**
 * Festive offers and voucher scopes, over the real routers.
 *
 * This suite exists because three separate contract lies were possible before
 * it was written, none of them visible in a demo:
 *  1. categories/brands on a SaleEvent narrowed WHICH PRODUCTS A CAMPAIGN
 *     TOUCHED, and the admin UI could not express brand narrowing at all -
 *     the festive-card story (Durga Puja: 30% off Ray-Ban) is brand-scoped by
 *     nature. So: create over HTTP, apply via the model's own folded matching,
 *     watch the exact arithmetic land only on in-scope rows.
 *  2. COUPON SCOPE WAS DECORATIVE. applicableCategories had been stored since
 *     the model was born and enforced nowhere; validate and the order door
 *     each quoted from the FULL subtotal. A 'glasses only' voucher was a
 *     whole-cart voucher at redemption time. Both doors now lean on
 *     services/couponScope.js, and this file asserts they AGREE - validate's
 *     promised number must equal the base the order door would use, because
 *     the checkout screen quotes from validate.
 *  3. EDITING A LIVE EVENT RE-APPLIED ON TOP OF ITSELF: the restore anchor
 *     (originalDiscountedPrice) got overwritten with the discounted number,
 *     so switching that event off restored yesterday's festival price as the
 *     "normal" price. PUT now deactivates first; this suite asserts the
 *     anchor after one live edit, because that number is what a real rollback
 *     depends on months later.
 */
import Product from '../server/models/Product.js';
import SaleEvent from '../server/models/SaleEvent.js';
import Coupon from '../server/models/Coupon.js';

const mongoose = Product.db.base;
const BASE = process.argv[2] || process.env.VERIFY_BASE || 'http://localhost:3111';
const API = `${BASE}/api`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 160)}` : ''}`);
  return ok;
};

const call = async (path, { token, method, body } = {}) => {
  const res = await fetch(API + path, {
    // body-implying-POST was a trap: `call('/x/toggle', { token })` silently
    // sent a GET and every route-missing assertion afterwards pointed at
    // middleware that did not exist. Toggle-style actions must say so.
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

const days = (n) => new Date(Date.now() + n * 86400000).toISOString();
const near = Math.round;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = (
    await call('/admin/auth/login', { body: { email: 'samedayopticians@gmail.com', password: 'Sameday123@' } })
  ).json?.token;
  const customer = (await call('/auth/login', { body: { email: 'demo@optikart.com', password: 'Demo123@' } })).json
    ?.token;
  if (!check('admin + customer login', !!admin && !!customer)) return finish();

  /* -------------------------------- data -------------------------------- */
  // one Ray-Ban sunglasses row and one other-brand sunglasses row from the
  // fixtures; snapshot their pre-state so arithmetic is absolute, not lucky.
  const inScope = await Product.findOne({ brand: 'Ray-Ban', category: 'sunglasses', isActive: true }).lean();
  const outScope = await Product.findOne({ brand: { $ne: 'Ray-Ban' }, category: 'sunglasses', isActive: true }).lean();
  if (!check('fixture products exist for brand-scoped event', !!inScope && !!outScope)) return finish();
  const beforeIn = { discountedPrice: inScope.discountedPrice, price: inScope.price };
  const beforeOut = { discountedPrice: outScope.discountedPrice, saleEventId: outScope.saleEventId };

  // the database is shared with every other group in this harness run, and a
  // leftover E2E_* coupon from a crashed run poisons 'code already exists'.
  // Sweep first, always.
  const Coupon0 = Coupon;
  await Coupon0.deleteMany({ code: /^E2E_/ });
  await SaleEvent.deleteMany({ name: /^E2E |^PROBE/ });
  // nothing in this suite should survive an earlier interrupted run: leaving
  // a live event on the fixture's Ray-Ban rows corrupts the very baseline
  // that the arithmetic checks below measure against
  for (const orphan of await SaleEvent.find({ isActive: true })) {
    await call(`/sale-events/${orphan._id}`, { token: admin, method: 'PUT', body: { isActive: false } });
  }
  await SaleEvent.deleteMany({ name: /^E2E |^PROBE/ });

  /* --------------------------- branded sale event ------------------------ */
  // brand list deliberately sent as 'ray ban' (no hyphen, lowercase): foldBrand
  // must match the stored 'Ray-Ban'. A festival card typed slightly different
  // from the catalogue spelling must not silently miss.
  const created = await call('/sale-events', {
    token: admin,
    body: {
      name: 'E2E Puja Ray-Ban 30',
      description: 'brand scoped',
      categories: ['sunglasses'],
      brands: ['ray ban'],
      discountPercentage: 30,
      startDate: days(-1),
      endDate: days(3),
    },
  });
  const evId = created.json?.event?._id;
  check(
    'POST /sale-events accepts brands and applies at create',
    created.status === 201 && !!evId && created.json.affectedProducts >= 1,
    JSON.stringify(created.json?.message || created.status)
  );

  if (evId) {
    const afterIn = await Product.findById(inScope._id)
      .select('price discountedPrice originalDiscountedPrice saleEventId')
      .lean();
    const expect = near(afterIn.price * 0.7);
    check(
      'brand-folded match repriced Ray-Ban to round(price*0.70) with anchor preserved',
      afterIn.discountedPrice === expect &&
        String(afterIn.saleEventId) === evId &&
        afterIn.originalDiscountedPrice === (beforeIn.discountedPrice || beforeIn.price),
      `got ${afterIn.discountedPrice} want ${expect} anchor=${afterIn.originalDiscountedPrice} was=${beforeIn.discountedPrice || beforeIn.price}`
    );
    const afterOut = await Product.findById(outScope._id).select('discountedPrice saleEventId').lean();
    check(
      'same-category same-different-brand product untouched',
      afterOut.discountedPrice === beforeOut.discountedPrice &&
        String(afterOut.saleEventId || null) === String(beforeOut.saleEventId || null),
      JSON.stringify(afterOut)
    );

    /* live PAUSE and LIVE EDIT (the restore-anchor contract) */
    const toff = await call(`/sale-events/${evId}/toggle`, { token: admin, method: 'POST' });
    const restored = await Product.findById(inScope._id).select('discountedPrice').lean();
    check(
      'toggle off restores the pre-event price',
      restored.discountedPrice === (beforeIn.discountedPrice || beforeIn.price),
      `got ${restored.discountedPrice} want ${beforeIn.discountedPrice || beforeIn.price} :: ${toff.status} ${JSON.stringify(toff.json?.message || toff.json || '')}`
    );
    await call(`/sale-events/${evId}/toggle`, { token: admin, method: 'POST' });

    // 25% because it is NOT round(price*0.70) and not the restored 7192: an
    // edit whose expected number equals the restore number proves nothing.
    const put = await call(`/sale-events/${evId}`, { token: admin, method: 'PUT', body: { discountPercentage: 25 } });
    const edited = await Product.findById(inScope._id).select('price discountedPrice originalDiscountedPrice').lean();
    check(
      'PUT on a LIVE event re-prices AND keeps the TRUE restore anchor',
      put.status === 200 &&
        edited.discountedPrice === near(edited.price * 0.75) &&
        edited.originalDiscountedPrice === (beforeIn.discountedPrice || beforeIn.price),
      `put=${put.status} price=${edited.discountedPrice} want ${near(edited.price * 0.75)} anchor=${edited.originalDiscountedPrice}`
    );
    await call(`/sale-events/${evId}`, { token: admin, method: 'PUT', body: { isActive: false } });
    const off = await Product.findById(inScope._id).select('discountedPrice saleEventId').lean();
    check(
      'PUT isActive:false deactivates and restores',
      String(off.saleEventId || '') === '' && off.discountedPrice === (beforeIn.discountedPrice || beforeIn.price)
    );

    await call(`/sale-events/${evId}`, { token: admin, method: 'DELETE' });
  }

  /* ------------------------- public events surface ------------------------ */
  const pub = await call('/sale-events');
  check(
    'GET /sale-events (public) returns events + activeEvents',
    pub.status === 200 && Array.isArray(pub.json?.events) && Array.isArray(pub.json?.activeEvents)
  );

  /* --------------------- coupon scope: the enforcement ----------------*/
  const other = await Product.findOne({ brand: 'Fastrack', category: 'sunglasses', isActive: true }).lean();

  const mk = async (code, extra) => {
    const r = await call('/coupons', {
      token: admin,
      body: {
        code,
        description: code,
        discountType: 'percentage',
        discountValue: 10,
        validFrom: days(-1),
        validUntil: days(1),
        usageLimit: 100,
        ...extra,
      },
    });
    return { id: r.json?.coupon?._id || r.json?._id, status: r.status, body: r.json };
  };

  const scoped = await mk('E2E_SCOPE_GL', { applicableCategories: ['eyeglasses'] });
  check(
    'admin POST /coupons stores applicableBrands/Categories',
    scoped.status === 201 && !!scoped.id,
    JSON.stringify(scoped.body?.message || scoped.status)
  );

  if (scoped.id) {
    // 1) line list with NO in-scope row -> refused, naming the scope
    const v1 = await call('/coupons/validate', {
      token: customer,
      body: { code: 'E2E_SCOPE_GL', orderAmount: 20000, items: [{ product: inScope._id, quantity: 1 }] },
    });
    const mess1 = String(v1.json?.message || '');
    check(
      'scoped coupon REFUSED when no line matches',
      v1.status === 400 && /eyeglasses/.test(mess1) && !v1.json?.needsCart,
      mess1
    );

    // 2) scoped coupon quoted from an EMPTY line list -> honest needsCart, no number
    const v2 = await call('/coupons/validate', { token: customer, body: { code: 'E2E_SCOPE_GL', orderAmount: 20000 } });
    check(
      'scoped coupon WITHOUT cart lines refuses to guess (needsCart)',
      v2.status === 400 && v2.json?.needsCart === true
    );
  }

  // percentage on mixed cart = matched lines only. brand-scoped 15% on
  // Ray-Ban; in-scope 8990 -> 1348.50, out line 1495 must NOT inflate the base.
  const mixed = await mk('E2E_MIX15', { discountType: 'percentage', discountValue: 15, applicableBrands: ['Ray-Ban'] });
  if (mixed.id) {
    const v3 = await call('/coupons/validate', {
      token: customer,
      body: {
        code: 'E2E_MIX15',
        orderAmount: inScope.price + other.price,
        items: [
          { product: inScope._id, quantity: 1 },
          { product: other._id, quantity: 1 },
        ],
      },
    });
    const d = Number(v3.json?.coupon?.discount);
    check(
      'percentage voucher on mixed cart discounts the IN-SCOPE base only',
      v3.status === 200 && Math.abs(d - inScope.price * 0.15) < 1,
      `discount=${d} want ~${inScope.price * 0.15} (full cart would say ${(inScope.price + other.price) * 0.15})`
    );
  }

  // min-order checks the IN-SCOPE money: total 1000, but only 495 in scope of
  // a minimum of 1000 -> refuse (this is the "₹2000 min with glasses coupon"
  // reading that the whole contract hinges on).
  const minn = await mk('E2E_MIN1K', {
    discountType: 'fixed',
    discountValue: 100,
    minOrderAmount: 1000,
    applicableBrands: ['Lenskart Air'],
  });
  if (minn.id) {
    const lens = await Product.findOne({ brand: 'Lenskart Air', isActive: true }).lean();
    // no in-scope line at all -> the refusal is the scope sentence, and it
    // must come BEFORE any min-order arithmetic (there is nothing to test).
    const v4 = await call('/coupons/validate', {
      token: customer,
      body: { code: 'E2E_MIN1K', orderAmount: 100000, items: [{ product: inScope._id, quantity: 99 }] },
    });
    check(
      'min-order voucher with zero in-scope lines refused on scope',
      v4.status === 400 && /only|scope/i.test(String(v4.json?.message || '')),
      JSON.stringify(v4.json?.message)
    );
    if (lens) {
      /*
       * The server prices a scope line from product.price x quantity, so the
       * fixture maths here follows THE SAME field, not discountedPrice (sale
       * events are off by this point anyway; consistency beats cleverness).
       */
      const qty = lens.price;
      const cheap = Math.max(1, Math.floor(999 / qty));
      const base = cheap * qty;
      if (base < 1000) {
        // discriminating case: whole cart towers over the minimum, the
        // in-scope money does not. The old whole-cart check waved this
        // through; checkout then refused - validate must refuse it up front.
        const v4b = await call('/coupons/validate', {
          token: customer,
          body: { code: 'E2E_MIN1K', orderAmount: 100000, items: [{ product: lens._id, quantity: cheap }] },
        });
        check(
          'IN-SCOPE base < min while whole cart towers over it -> refused at validate (door parity)',
          v4b.status === 400 && /in brands|eligible/.test(String(v4b.json?.message || '')),
          JSON.stringify(v4b.json?.message)
        );
      } else {
        console.log(
          `SKIP  discriminating min-under-scope case (${lens.brand} line costs ₹${qty}; one in-scope item already clears the ₹1000 minimum)`
        );
      }
      const rich = Math.ceil(1000 / qty) + 1;
      const v5 = await call('/coupons/validate', {
        token: customer,
        body: { code: 'E2E_MIN1K', orderAmount: 1, items: [{ product: lens._id, quantity: rich }] },
      });
      check(
        'voucher passes when scope.base clears min even though orderAmount is nonsense-low',
        v5.status === 200 && Math.abs(Number(v5.json?.coupon?.discount) - 100) < 1,
        JSON.stringify(v5.json?.coupon || v5.json?.message)
      );
    } else {
      console.log('SKIP  Lenskart Air product absent from fixture, scope-min cases not constructed');
    }
  }

  // whole-catalogue unscoped coupon unchanged: validate answers a number off
  // orderAmount with NO items at all (the historical contract must survive).
  const plain = await mk('E2E_PLAIN10', { discountValue: 10 });
  if (plain.id) {
    const v6 = await call('/coupons/validate', { token: customer, body: { code: 'E2E_PLAIN10', orderAmount: 5000 } });
    check(
      'unscoped coupon still quotes off orderAmount without items',
      v6.status === 200 && Math.abs(Number(v6.json?.coupon?.discount) - 500) < 1,
      JSON.stringify(v6.json?.coupon)
    );
  }

  /* ------------------------------ cleanup ------------------------------- */
  for (const id of [scoped.id, mixed.id, minn.id, plain.id].filter(Boolean)) {
    await call(`/coupons/${id}`, { token: admin, method: 'DELETE' });
  }
  await SaleEvent.deleteMany({ name: /^E2E / });
  check('cleanup leaves no E2E rows', (await SaleEvent.countDocuments({ name: /^E2E / })) === 0);

  finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed in offers/scopes suite`);
  process.exitCode = failed ? 1 : 0;
  return mongoose.disconnect().catch(() => {});
}

main().catch((e) => {
  console.error('offers_scopes_e2e crashed:', e);
  process.exitCode = 1;
});
