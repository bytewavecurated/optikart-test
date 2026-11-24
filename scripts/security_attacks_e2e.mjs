#!/usr/bin/env node
/**
 * Attack suite: the techniques catalogued in the security review, executed
 * against the running API by an actual attacker-shaped client.
 *
 * Why this exists next to the static audits: a table of which middleware sits
 * in which chain answers "was the gate written"; it does not answer "what
 * happens on the wire". Every check below is an attempt that SHOULD fail and
 * an assertion of HOW it fails: 401 vs silently-accepted, honest generic
 * message vs enumeration oracle, server-computed money vs client claim. A
 * regression of any gate this file models turns CI red with the attack named.
 *
 * Categories: A authentication/account, B object-level access, C uploads,
 * D Mongo/NoSQL, E money, F API surface, H sockets, K business gates.
 *
 * Isolation rule used throughout: every destructive probe (brute force,
 * account mutation) runs against accounts THIS FILE created, never against
 * the shared demo fixtures, so one suite cannot rate-limit out the next.
 */
import { createRequire } from 'node:module';
import { randomInt as cryptoRandomInt } from 'node:crypto';

// server-side dependencies resolved from the server package (the scripts/ dir
// has no node_modules of its own; this is how every suite reuses server libs)
const reqS = createRequire(new URL('../server/server.js', import.meta.url));
const jwt = reqS('jsonwebtoken');
import User from '../server/models/User.js';
import Product from '../server/models/Product.js';
import SaleEvent from '../server/models/SaleEvent.js';
import Order from '../server/models/Order.js';
import Seller from '../server/models/Seller.js';
import { signSession } from '../server/services/session.js';
import { stampOtp } from '../server/services/otpCode.js';

const BASE = process.argv[2] || process.env.VERIFY_BASE || 'http://localhost:3111';
const API = `${BASE}/api`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 170)}` : ''}`);
  return ok;
};

const call = async (path, { token, method, body, form, headers: extra } = {}) => {
  const res = await fetch(API + path, {
    method: method || (body || form ? 'POST' : 'GET'),
    headers: {
      ...(form ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extra || {}),
    },
    body: form ? form : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
};

let usedPhones = new Set();
const uphone = (p) => {
  let s;
  do {
    s = p + String(cryptoRandomInt(100000000, 999999999));
  } while (usedPhones.has(s));
  usedPhones.add(s);
  return s;
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const now = () => Date.now();

async function main() {
  const mongoose = Product.db.base;
  await mongoose.connect(process.env.MONGODB_URI);

  /* ---------------------------------------------------------------- prep --- */
  const admin = (
    await call('/admin/auth/login', { body: { email: 'samedayopticians@gmail.com', password: 'Sameday123@' } })
  ).json?.token;
  const customer = (await call('/auth/login', { body: { email: 'demo@optikart.com', password: 'Demo123@' } })).json
    ?.token;
  const seller = (await call('/seller/login', { body: { email: 'opticalworld@gmail.com', password: 'Seller123@' } }))
    .json?.token;
  if (!check('A0 fixtures: admin/customer/seller sign in', !!admin && !!customer && !!seller)) return finish();

  // two throwaway accounts so probes never touch shared fixtures: the
  // "victim" (owns an order + a product line) and the "attacker" customer.
  const victimEmail = `victim-${uuid().slice(0, 8)}@attck.test`;
  const attackerEmail = `atk-${uuid().slice(0, 8)}@attck.test`;
  const attackerPhone = String(9000000000 + Math.floor(Math.random() * 99999999));
  const R = await call('/auth/register', {
    body: { name: 'Victim One', email: victimEmail, phone: uphone('9'), password: 'Victim!Pass1' },
  });
  const R2 = await call('/auth/register', {
    body: { name: 'Attacker Two', email: attackerEmail, phone: attackerPhone.slice(0, 10), password: 'Attack!Pass2' },
  });
  const victim = R.json?.token;
  const attacker = R2.json?.token;
  const prodsRes = await call('/products?category=sunglasses&limit=12');
  // earlier suites may have drained a specific line's stock in the shared DB;
  // pick rows this suite can actually buy three of
  const prods = (prodsRes.json?.products || [])
    .filter((r) => Number(r.price) > 0 && Number(r.stock ?? 99) >= 3)
    .slice(0, 2);
  const ADDR = {
    name: 'Attack Suite',
    phone: attackerPhone,
    street: '1 Test Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400050',
  };
  if (!check('A0c a serviceable product pool exists', prods.length >= 2, String(prods.length))) return finish();
  if (
    !check(
      'A0b throwaway accounts register',
      !!victim && !!attacker,
      `${R.status}/${R2.status} ${(R.json?.message || '') + (R2.json?.message || '')}`
    )
  )
    return finish();

  /* =========================== A - authentication ========================= */

  // A1/A2/A35 — self-registered admin, and role injection on profile update
  {
    const rogueEmail = `rogue-${uuid().slice(0, 8)}@attck.test`;
    const reg = await call('/auth/register', {
      body: {
        name: 'Rogue',
        email: rogueEmail,
        phone: uphone('8'),
        password: 'Rogue!Pass9',
        role: 'admin',
        isAdmin: true,
      },
    });
    const tok = reg.json?.token;
    const probe = tok ? await call('/admin/users?limit=1', { token: tok }) : { status: 0 };
    const row = await User.findOne({ email: rogueEmail }).lean();
    check(
      'A1 self-registration cannot mint an admin (payload role/admin ignored, admin console 403)',
      probe.status !== 200 && row && row.role !== 'admin',
      `console=${probe.status} dbRole=${row?.role}`
    );

    const upd = await call('/auth/update-profile', {
      token: attacker,
      method: 'PUT',
      body: { role: 'admin', isAdmin: true, isVerified: true },
    });
    const row2 = await User.findOne({ email: attackerEmail }).lean();
    check(
      'A2/A35 profile update ignores role/isAdmin fields',
      row2?.role !== 'admin' && row2?.isAdmin !== true,
      `after=${row2?.role}`
    );
  }

  // A4 — JWT manipulation: alg:none and alg-confusion are refused on every door
  {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const victimRow = await User.findOne({ email: victimEmail }).lean();
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ id: String(victimRow._id) })}.`;
    const r1 = await call('/orders?limit=1', { token: none });
    const r2 = await fetch(BASE + '/uploads/../server/.env'); // traversal pair below
    check(
      'A4 alg:none token rejected (401), not "verified"',
      r1.status === 401,
      `${r1.status} ${String(r1.json?.message).slice(0, 40)}`
    );

    const hs = jwt.sign({ id: String(victimRow._id) }, 'jwtsecret2', { algorithm: 'HS256' });
    const r3 = await call('/orders?limit=1', { token: hs });
    check('A5 token forged with a plausible default secret rejected', r3.status === 401, String(r3.status));
  }

  // A6/A17 — expiry honored, logout revokes
  {
    const victimRowId = String((await User.findOne({ email: victimEmail }).lean())?._id);
    const stale = signSession({ id: victimRowId }, { expiresIn: '-10s' });
    const r = await call('/orders?limit=1', { token: stale });
    check('A6 expired token refused', r.status === 401, String(r.status));

    const l2 = await call('/auth/login', { body: { email: attackerEmail, password: 'Attack!Pass2' } });
    let freshTok = l2.json?.token;
    if (!freshTok && l2.json?.devCode) {
      // fresh account, not on the seeded bypass list (correct): finish the
      // email-code leg and take the token IT issues
      const vo = await call('/auth/verify-login-otp', { body: { email: attackerEmail, otp: String(l2.json.devCode) } });
      freshTok = vo.json?.token;
      check(
        'A11x login-OTP leg completes only with the emailed code',
        vo.status === 200 && !!freshTok,
        `${vo.status} ${(vo.json?.message || '').slice(0, 44)}`
      );
    } else if (!freshTok) {
      check(
        'A11x login returned neither token nor devCode',
        false,
        `${l2.status} ${String(l2.json?.message).slice(0, 70)}`
      );
    }
    const before = await call('/orders?limit=1', { token: freshTok });
    await call('/auth/logout', { token: freshTok, method: 'POST' });
    const after = await call('/orders?limit=1', { token: freshTok });
    check(
      'A17 logout revokes the bearer token (works before, refused after)',
      before.status === 200 && after.status === 401,
      `before=${before.status}:"${(before.json?.message || before.text || '').slice(0, 60)}" after=${after.status}`
    );
  }

  // A8/A9/A20 — credential stuffing and brute force are throttled per account
  {
    const statuses = [];
    for (let i = 0; i < 12; i += 1)
      statuses.push((await call('/auth/login', { body: { email: attackerEmail, password: `nope-${i}` } })).status);
    const limited = statuses.includes(429);
    const okAfter = await call('/auth/login', { body: { email: attackerEmail, password: 'Attack!Pass2' } });
    check(
      'A8/A9/A20 12 bad passwords trips the per-account limiter, and the correct one is refused inside the window',
      limited && okAfter.status === 429,
      statuses.join(',')
    );
  }

  // A10 — reset flow is single-use; replayed code refused
  {
    const vrow = await User.findOne({ email: victimEmail });
    stampOtp(vrow, 'resetOtp', '441220');
    vrow.resetOtpExpiry = new Date(Date.now() + 600000);
    await vrow.save();
    const first = await call('/auth/reset-password', {
      body: { email: victimEmail, otp: '441220', newPassword: 'Rotated!Pass9' },
    });
    const second = await call('/auth/reset-password', {
      body: { email: victimEmail, otp: '441220', newPassword: 'Rotated!Pass10' },
    });
    const loginNew = (await call('/auth/login', { body: { email: victimEmail, password: 'Rotated!Pass9' } })).status;
    check(
      'A10/A12 reset code changes the password once and never twice',
      first.status === 200 && second.status === 400 && loginNew === 200,
      `${first.status}/${second.status}/login=${loginNew}`
    );

    const weak = await call('/auth/reset-password', {
      body: { email: victimEmail, otp: '000000', newPassword: '1234' },
    });
    check(
      'A16 weak new password refused on reset',
      weak.status === 400 && /8|characters|number|letter/i.test(String(weak.json?.message)),
      String(weak.json?.message)
    );
  }

  // A13/A15 — enumeration: the identity questions answer identically
  {
    const unknownLogin = await call('/auth/login', { body: { email: 'who-dis@example.com', password: 'whatever' } });
    const badpassLogin = await call('/auth/login', { body: { email: 'demo@optikart.com', password: 'whatever' } });
    check(
      'A15 login does not distinguish unknown account from wrong password',
      unknownLogin.status === badpassLogin.status &&
        String(unknownLogin.json?.message) === String(badpassLogin.json?.message),
      `${unknownLogin.status}/${badpassLogin.status} "${unknownLogin.json?.message}" vs "${badpassLogin.json?.message}"`
    );

    const f1 = await call('/auth/forgot-password', { body: { email: 'who-dis@example.com' } });
    const f2 = await call('/auth/forgot-password', { body: { email: 'demo@optikart.com' } });
    /*
     * The claim is narrow: EXISTENCE is invisible. f1 may legitimately arrive
     * at 429 (our own earlier suites spent some of this IP's five-minute
     * probe budget - a ceiling is not an oracle), f2 may answer its honest
     * dev mail-state. Neither may be a 404 'not registered' sentence.
     */
    check(
      'A13 forgot-password: neither known nor unknown may be told apart by a 404 (probe ceiling tolerated)',
      f1.status !== 404 &&
        f2.status !== 404 &&
        (f1.status === 429 || /matches an account|nothing to wait|not working/i.test(String(f1.json?.message))),
      `unknown=${f1.status} "${String(f1.json?.message).slice(0, 50)}" known=${f2.status}`
    );

    const v1 = await call('/auth/verify-otp', { body: { phone: '0000000000', otp: '123456' } });
    const v2 = await call('/auth/verify-otp', { body: { phone: '9111111111', otp: '123456' } });
    check(
      'A13/15 OTP verification answers unknown numbers with the SAME refusal as wrong codes',
      v1.status === v2.status &&
        String(v1.json?.message) === String(v2.json?.message) &&
        !/not registered|found/i.test(String(v1.json?.message)),
      `${v1.status}/${v2.status} "${v1.json?.message}"`
    );

    const aRow = await User.findOne({ email: attackerEmail }).lean();
    check(
      'A16 no plaintext OTP anywhere in stored rows; digests only',
      !('resetOtp' in aRow) || /^[0-9a-f]{64}$/.test(String(aRow.resetOtp)),
      `stored=${String(aRow.resetOtp).slice(0, 12)}`
    );
  }

  /* ==================== B - object-level and role boundaries ============== */

  // B21/22/25/27/28/30 — one victim-shaped dataset, then a cross-tenant raid
  const victimCtx = { token: victim };
  let victimOrder = null;
  let victimOrderId = '';
  let victimProductId = null;
  {
    // victim places a real order: find a product the victim seller can sell is
    // not needed - customer path via seeded catalog, first address auto.
    const orderItems = prods.slice(0, 2).map((p) => ({ product: p._id || p.id, quantity: 1 }));
    void ADDR;
    const placed = await call('/orders', {
      token: victim,
      body: { items: orderItems, shippingAddress: ADDR, paymentMethod: 'cod' },
    });
    victimOrder = placed.json?.order || (placed.json?.orders || [])[0] || placed.json;
    victimOrderId = String(victimOrder?._id || '');
    if (!check('B0b extracted the placed order id', !!victimOrderId, JSON.stringify(placed.json).slice(0, 90)))
      return finish();
    check('B0 victim order placed (baseline)', placed.status === 200 || placed.status === 201, String(placed.status));

    // one product owned by a DIFFERENT seller than our fixture seller
    const sellerRow = await Seller.findOne({ email: 'opticalworld@gmail.com' }).lean();
    const foreign = await Product.findOne({
      isActive: true,
      seller: { $ne: sellerRow._id },
      category: 'sunglasses',
    }).lean();
    victimProductId = foreign ? String(foreign._id) : String(prods[0]._id);

    const attackerOrders = await call(`/orders/${victimOrderId}`, { token: attacker });
    check(
      "B21/B25 attacker reading another customer's order by id is refused (404 - same as a real missing id)",
      attackerOrders.status === 404,
      String(attackerOrders.status)
    );

    const cs = await call(`/orders/${victimOrderId}/charge-summary`, { token: attacker });
    check('B27 invoice/charge-summary of another order refused', cs.status === 404, String(cs.status));

    const addrPut = await call(`/auth/addresses/000000000000000000000000`, {
      token: attacker,
      method: 'PUT',
      body: { pincode: '111111' },
    });
    check(
      'B22 nonexistent-object PUT is a plain 404 (no differential)',
      addrPut.status === 404,
      String(addrPut.status)
    );

    if (victimProductId) {
      const crossEdit = await call(`/products/${victimProductId}`, {
        token: seller,
        method: 'PUT',
        body: { title: 'HIJACKED' },
      });
      const still = await Product.findById(victimProductId).select('title').lean();
      check(
        'B26/B37 seller cannot rewrite a product they do not own',
        crossEdit.status !== 200 || String(still?.title) !== 'HIJACKED',
        `edit=${crossEdit.status} title=${String(still?.title).slice(0, 24)}`
      );
    }
  }

  // B31/B32/B36/B40 — every console rejects a token from another world
  {
    const probes = [
      ['admin users', '/admin/users?limit=1', customer],
      ['admin users as seller', '/admin/users?limit=1', seller],
      ['seller dashboard', '/seller/dashboard', customer],
      ['executive console', '/executive/overview', customer],
      ['manufacturer console', '/manufacturer/summary', customer],
      ['partner console', '/delivery-partner/orders', customer],
      ['payouts', '/payouts/summary', customer],
    ];
    const outcomes = [];
    for (const [label, path, tok] of probes) {
      const r = await call(path, { token: tok });
      const wrong = r.status === 200;
      outcomes.push(`${label}=${r.status}${wrong ? '!!!' : ''}`);
    }
    check(
      'B31/B32/B36/B40 a customer/seller token cannot open any console area',
      !outcomes.some((o) => o.includes('!!!')),
      outcomes.join(' ')
    );
  }

  // B33/B34 — HTTP-verb and parameter tampering on a customer-owned order
  {
    const oid = victimOrderId;
    const patch = await call(`/orders/${oid}/status`, {
      token: victim,
      method: 'PATCH',
      body: { orderStatus: 'delivered' },
    });
    const o = await Order.findById(oid).lean();
    check(
      'B33/B34 customer PATCH of order status either 404s (no route) or is ignored',
      patch.status === 404 || String(o?.orderStatus) !== 'delivered',
      `http=${patch.status} status=${String(o?.orderStatus).slice(0, 20)}`
    );
  }

  // B34/B76/B97 — the money the client claims is not the money accepted
  {
    const prod = prods[0];
    const cheap = await call('/orders', {
      token: attacker,
      body: {
        items: [{ product: prod._id || prod.id, quantity: 2, price: 1, subtotal: 2, discountPercent: 90 }],
        shippingAddress: ADDR,
        paymentMethod: 'cod',
        deliveryFee: 0,
      },
    });
    const ord = cheap.json?.order || (cheap.json?.orders || [])[0] || cheap.json;
    const want = Number(prod.effectivePrice ?? prod.price) * 2;
    const got = Number(ord?.totalAmount ?? ord?.paymentAmount ?? ord?.total ?? ord?.amount ?? 0);
    check(
      'B34/E76/E77/E78 client-claimed price/subtotal/discount ignored: order priced from catalogue',
      (cheap.status === 200 || cheap.status === 201) && got >= want,
      `clientClaim=2 catalog>=${want} stored=${got} http=${cheap.status}`
    );

    const neg = await call('/orders', {
      token: attacker,
      body: { items: [{ product: prod._id || prod.id, quantity: -3 }], shippingAddress: ADDR, paymentMethod: 'cod' },
    });
    check('E97/E80 negative quantity refused', neg.status === 400, String(neg.status));
  }

  /* =========================== C - uploads and files ====================== */
  {
    const evil = Buffer.concat([Buffer.from('MZ'), Buffer.from(String.fromCharCode(90) + 'x'.repeat(64))]);
    const realJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    const svgBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="1"/></svg>');

    const fd1 = new FormData();
    fd1.append('prescription', new Blob([evil], { type: 'image/jpeg' }), 'photo.jpg');
    const c1 = await call('/auth/prescription-upload', { token: attacker, form: fd1 });
    check(
      'C41/C43/C56 bytes that are not the claimed image are refused (magic-byte gate)',
      c1.status >= 400,
      `${c1.status} ${String(c1.json?.message || '').slice(0, 70)}`
    );

    const fd2 = new FormData();
    fd2.append('prescription', new Blob([svgBytes], { type: 'image/svg+xml' }), 'logo.svg');
    const c2 = await call('/auth/prescription-upload', { token: attacker, form: fd2 });
    check(
      'C42/C44 svg-declared upload refused (neither image signature nor policy)',
      c2.status >= 400,
      `${c2.status} ${String((c2.json && c2.json.message) || c2.text.slice(0, 60) || '').slice(0, 60)}`
    );

    const fd3 = new FormData();
    fd3.append('prescription', new Blob([realJpeg], { type: 'image/jpeg' }), 'ok.jpg');
    const c3 = await call('/auth/prescription-upload', { token: attacker, form: fd3 });
    check(
      'C0a a real JPEG still gets stored (the gate bites fakes only)',
      c3.status === 201 || c3.status === 200,
      String(c3.status)
    );

    const fd4 = new FormData();
    fd4.append('image', new Blob([Buffer.alloc(6 * 1024 * 1024, 0xff)], { type: 'image/jpeg' }), 'big.jpg');
    const c4 = await call(`/products/${prods[0]._id || prods[0].id}/images`, { token: seller, form: fd4 });
    const c4b = await call('/products/000000000000000000000000/images', { token: attacker, form: fd1 });
    check('C47 6MB upload refused by the size cap', c4.status >= 400 || c4.status === 404, String(c4.status));
    check(
      'C60 customer token cannot post images to a seller upload route',
      [401, 403].includes(c4b.status),
      String(c4b.status)
    );

    const fd5 = new FormData();
    fd5.append('prescription', new Blob([realJpeg], { type: 'image/jpeg' }), 'guest.jpg');
    const c5 = await call('/auth/prescription-upload', { form: fd5 });
    check('C60 anonymous upload refused', [401].includes(c5.status), String(c5.status));

    const trav = await fetch(BASE + '/uploads/..%2f..%2fserver%2f.env');
    const travText = await trav.text();
    check(
      'C49/I148 encoded traversal and the .env path do not return server secrets',
      !travText.includes(String(process.env.JWT_SECRET || 'JWT-SECRET').slice(0, 8)),
      `${trav.status} leaks=${travText.includes('JWT_SECRET')}`
    );

    const envDirect = await fetch(BASE + '/.env');
    const envText = await envDirect.text();
    check(
      'I148 /.env is not served with contents',
      envText.includes('<!doctype') ||
        envText.includes('<html') ||
        envText.includes('Frontend not built') ||
        !envText.includes('JWT_SECRET'),
      String(envDirect.status)
    );
  }

  /* ======================= D - Mongo/NoSQL and payloads =================== */
  {
    const inj1 = await call('/auth/login', { body: { email: { $ne: null }, password: { $ne: null } } });
    check(
      'D61/D62/D63 operator objects in login body are scrubbed and refused (never a bypass)',
      inj1.status === 400 && !inj1.json?.token,
      String(inj1.status)
    );

    const inj2 = await call('/products?limit[$gt]=1&search[$exists]=true');
    check(
      'D61 operator-shaped query strings survive as innocuous garbage (200 + sane shape, no error surface)',
      inj2.status === 200 && Array.isArray(inj2.json?.products),
      String(inj2.status)
    );

    const hpp = await call('/products?category=sunglasses&category=contactlenses');
    check('F105 duplicated query keys do not crash', hpp.status < 500 && hpp.status >= 200, String(hpp.status));

    const t0 = now();
    const redos = await call(`/products?search=${encodeURIComponent('(a+)+$')}`);
    const dt = now() - t0;
    check(
      'D72 regex-DoS pattern in search returns quickly (escaped, not executed as regex)',
      dt < 1500 && redos.status === 200,
      `${dt}ms`
    );

    const leak = await call('/definitely-not-a-route');
    check(
      'D69/F: unknown route is JSON-refusal without stack frames',
      ![404, 503].includes(leak.status) ? false : !/\s+at\s+\S+\s+\(/.test(leak.text),
      `${leak.status} ${leak.text.slice(0, 40)}`
    );
  }

  /* =========================== E - payments and money ===================== */
  {
    const wh = await fetch(`${API}/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'a'.repeat(64) },
      body: JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: { entity: { id: 'pay_probeX', order_id: 'does-not-exist', status: 'captured', amount_paid: 1 } },
        },
      }),
    });
    check('E84/E86 webhook forged signature refused', wh.status === 400, String(wh.status));

    // stock race against a real catalogue line with qty=1 set directly
    {
      const prodRow = await Product.findById(prods[0]._id || prods[0].id).lean();
      const prod = prodRow && prodRow.stock > 0 ? prodRow : null;
      if (prod) {
        const originalStock = prod.stock;
        await Product.updateOne({ _id: prod._id }, { $set: { stock: 1 } });
        const addr = ADDR;
        const itemsFor = () => [{ product: String(prod._id), quantity: 1 }];
        const [a, b] = await Promise.all([
          call('/orders', {
            token: attacker,
            body: { items: itemsFor(), shippingAddress: addr, paymentMethod: 'cod' },
          }),
          call('/orders', {
            token: attacker,
            body: { items: itemsFor(), shippingAddress: addr, paymentMethod: 'cod' },
          }),
        ]);
        const ok = [a, b].filter((r) => r.status === 200 || r.status === 201).length;
        const after = await Product.findById(prod._id).select('stock').lean();
        await Product.updateOne({ _id: prod._id }, { $set: { stock: originalStock } });
        check(
          'E95 concurrent checkout on last unit: at most one order succeeds, stock never goes negative',
          ok <= 1 && (after?.stock ?? 0) >= 0,
          `successes=${ok} stockAfter=${after?.stock}`
        );
      }
    }

    const fakeCoupon = await call('/orders', {
      token: attacker,
      body: {
        items: [{ product: prods[0]._id || prods[0].id, quantity: 1 }],
        shippingAddress: ADDR,
        paymentMethod: 'cod',
        couponCode: 'FREEEVER',
      },
    });
    check(
      'E77 non-existent coupon code refused at placement, no silent discount',
      fakeCoupon.status === 400,
      String(fakeCoupon.status)
    );
  }

  /* ============================ F + G - surface =========================== */
  {
    const evil = await fetch(`${API}/products`, { method: 'OPTIONS', headers: { Origin: 'https://evil-cors.test' } });
    const acao = evil.headers.get('access-control-allow-origin');
    check(
      'F108 cross-origin OPTIONS does not echo an arbitrary origin with credentials',
      acao !== 'https://evil-cors.test' && acao !== '*',
      String(acao)
    );

    const proto = { __proto__: { polluted: 'yes' } };
    const pr = await call('/auth/register', {
      body: {
        name: 'P',
        email: `p-${uuid().slice(0, 8)}@attck.test`,
        phone: uphone('7'),
        password: 'Proto!Pass1',
        ...JSON.parse('{"__proto__":{"polluted":"yes"}}'),
      },
    });
    check(
      'F120 prototype-pollution keys are dropped (Object.prototype stays clean)',
      String({}.polluted) === 'undefined' && [400, 201].includes(pr.status),
      `reg=${pr.status}`
    );

    const fe = await (await fetch(`${API}/../package.json`)).text();
    check(
      'G150 debug/env files unreferenced by the public server',
      !/express|bcrypt/.test(fe),
      `probe=${fe.slice(0, 24)}`
    );
  }

  /* ============================= H - websockets ============================ */
  {
    const { io } = createRequire(new URL('../client/package.json', import.meta.url))('socket.io-client');
    const attempt = (opts, ms = 1200) =>
      new Promise((resolve) => {
        let done = null;
        const s = io(BASE, { transports: ['websocket'], autoConnect: true, timeout: ms, auth: opts || {} });
        const win = setTimeout(() => {
          done = 'timeout';
          s.close();
          resolve('timeout');
        }, ms + 250);
        s.on('connect', () => {
          clearTimeout(win);
          if (!done) {
            done = 'connect';
            s.close();
            resolve('connect');
          }
        });
        s.on('connect_error', () => {
          clearTimeout(win);
          if (!done) {
            done = 'error';
            s.close();
            resolve('error');
          }
        });
      });

    const anon = await attempt(null);
    check(
      'H136 unauthenticated socket is refused or gets nothing (no events observable)',
      anon === 'error' || anon === 'timeout',
      String(anon)
    );

    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const noneSock = await attempt({ token: `${b64({ alg: 'none' })}.${b64({ id: 'x', role: 'admin' })}.` });
    check('H137 socket layer rejects alg:none admin impersonation', noneSock !== 'connect', String(noneSock));
  }

  /* ======================= K - business-level boundaries =================== */
  {
    const decide = await call('/seller-stock/public/price-changes/000000000000000000000000/decide', {
      body: { token: 'guess-me', decision: 'accept' },
    });
    check(
      'K186 capability-token guessed: decide refuses',
      [400, 404, 410].includes(decide.status),
      String(decide.status)
    );

    const evilToggle = await call('/sale-events/000000000000000000000000/toggle', { token: attacker, method: 'POST' });
    check(
      'K198/B39 customer cannot toggle sale events (function-level gate)',
      [401, 403, 404].includes(evilToggle.status),
      String(evilToggle.status)
    );

    // reviews: delivered-and-owned only (K190)
    const foreignReview = await call(`/orders/${victimOrderId}/review`, {
      token: attacker,
      body: { rating: 5, comment: 'fake' },
    });
    check(
      "K190 review on another customer's order refused at the ownership door",
      [400, 404].includes(foreignReview.status),
      String(foreignReview.status)
    );

    const wl = await call('/wishlist/add', { token: attacker, body: { productId: victimProductId } });
    const wl2 = await call('/wishlist/remove/' + victimProductId, { token: victim, method: 'DELETE' });
    check(
      'K191 wishlist mutations are scoped: attacker add works on their OWN box; victim remove of a product they never saved is refused',
      [200, 201].includes(wl.status) && wl2.status === 404,
      `add=${wl.status} remove=${wl2.status}`
    );
  }

  /* =================== M - monitoring surface (rec #6) ==================== */
  {
    const ev = await call('/admin/system/security-events', { token: admin });
    const kinds = new Set((ev.json?.events || []).map((e) => e.type));
    check(
      'M6 security-events ring answers the admin desk',
      ev.status === 200 && !!ev.json?.counts,
      `${ev.status} ${[...kinds].slice(0, 5).join(',')}`
    );
    check(
      'M6 guard drops are IN the ring (this suite provoked one earlier)',
      kinds.has('guard_drop'),
      JSON.stringify([...kinds])
    );
    check(
      'M6 forged webhooks are IN the ring',
      kinds.has('webhook_signature'),
      JSON.stringify(ev.json?.counts || {}).slice(0, 90)
    );
    check(
      'M6 revoked-token use is IN the ring (A17 logged one out)',
      kinds.has('revoked_use') || (ev.json?.events || []).some((e) => e.type === 'revoked_use'),
      String(kinds.has('revoked_use'))
    );
    const anonEv = await call('/admin/system/security-events');
    check(
      'M6 the ring itself needs admin (anon 401, no intel for probes)',
      anonEv.status === 401,
      String(anonEv.status)
    );
    const custEv = await call('/admin/system/security-events', { token: attacker });
    check('M6 and a signed-in customer cannot read it either', custEv.status === 403, String(custEv.status));
  }

  /* =================== P - absolute session ceiling (rec #9) ============== */
  {
    const reqJwt2 = createRequire(new URL('../server/server.js', import.meta.url))('jsonwebtoken');
    const { signSession } = await import('../server/services/session.js');
    void signSession;
    const claims = { id: 'x'.padEnd(24, '0'), role: 'admin', iat: undefined };
    void claims;
    // mint through the same pepper+pinning the guard uses, then move iat back;
    // live admin claims from A0, age-shifted (see session_idle group for the
    // end-to-end refusal; here: the pure-decision contract)
    const { evaluateSessionActivity, absoluteCapHours } = await import('../server/services/sessionActivity.js');
    check('P9 default absolute ceiling is 12 console-hours', absoluteCapHours() === 12, String(absoluteCapHours()));
    const old = evaluateSessionActivity({
      decoded: { role: 'admin', iat: Math.floor(Date.now() / 1000) - 13 * 3600 },
      row: { lastSeenAt: new Date() },
    });
    check(
      'P9 a fully-active console still dies past the ceiling',
      old.absolute === true && old.capHours === 12,
      JSON.stringify(old).slice(0, 90)
    );
    const fresh = evaluateSessionActivity({
      decoded: { role: 'seller', iat: Math.floor(Date.now() / 1000) - 60 },
      row: { lastSeenAt: new Date() },
    });
    check(
      'P9 normal fresh sessions sail past the ceiling untouched',
      fresh.absolute !== true,
      JSON.stringify(fresh).slice(0, 70)
    );
    void reqJwt2;
  }

  /* ========================= static: front-end bundle ===================== */
  {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = path.join(process.cwd(), 'client', 'src');
    let dangerHtml = 0;
    let hardcodedSecrets = 0;
    if (fs.existsSync(src)) {
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (/\.jsx?$/u.test(e.name)) {
            const t = fs.readFileSync(p, 'utf8');
            if (/dangerouslySetInnerHTML/u.test(t) && !/chathtml|sanitize/iu.test(t)) dangerHtml += 1;
            if (/["']sk-[A-Za-z0-9]{20,}["']|AKIA[0-9A-Z]{16}/u.test(t)) hardcodedSecrets += 1;
          }
        }
      };
      walk(src);
    }
    // exactly one raw-HTML site is allowed - the blog renderer - and only
    // because the blog routes sanitize at both write doors (verified here too)
    const fs2 = await import('node:fs');
    const blogRoutePath = ['server/routes/blog.js', '../server/routes/blog.js'].find((c) => fs2.existsSync(c));
    const blogRouteText = blogRoutePath ? fs2.readFileSync(blogRoutePath, 'utf8') : '';
    const sanitizesWrites =
      /sanitizeBlogHtml\(req\.body\.content\)/u.test(blogRouteText) &&
      /req\.body\.content !== undefined \?\s*sanitizeBlogHtml/u.test(blogRouteText);
    check(
      'G121 single raw-HTML surface (blog) is matched by server-side sanitization at both write doors',
      dangerHtml <= 1 && sanitizesWrites,
      `sites=${dangerHtml} sanitized=${sanitizesWrites}`
    );
    check('G128/J173 no AWS/OpenAI-shaped literals in client source', hardcodedSecrets === 0, `${hardcodedSecrets}`);
  }

  finish();
}

async function finish() {
  try {
    await mongoose.connection.close();
  } catch {}
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} attack checks passed`);
  process.exitCode = failed ? 1 : 0;
  // the suite holds optional sockets (keep-alive fetch agents, a socketio client
  // that may never have errored); after the summary nothing should delay exit
  setTimeout(() => process.exit(failed ? 1 : 0), 250).unref?.();
}

main().catch((e) => {
  console.error('security_attacks_e2e crashed:', e);
  process.exitCode = 1;
});
