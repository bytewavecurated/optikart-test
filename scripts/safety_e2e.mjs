#!/usr/bin/env node
/**
 * Prescription and stock safety suite.
 *
 * Covers the two correctness holes:
 *  - ordering lenses that must be ground, against a prescription nobody checked
 *    (pending, rejected, missing, or belonging to somebody else), and the one
 *    case that must pass: the buyer's own approved prescription;
 *  - two buyers racing for the last unit, which the old read-check-save path let
 *    both through.
 *
 *   node scripts/safety_e2e.mjs [base-url]
 *
 * Needs a seeded development database.
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 120)}` : ''}`);
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

const ADDRESS = {
  name: 'Safety Runner', phone: '9800007788', street: '5 Mount Road',
  city: 'Chennai', state: 'Tamil Nadu', pincode: '600002'
};

async function main() {
  const customer = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  const other = await login('/auth/login', 'testuser@optikart.com', 'Test123@');
  const verifier = await login('/auth/login', 'meera.staff@optikart.com', 'Staff123@');
  if (!check('logins succeed (customer, second customer, verifier)', !!(customer && verifier), `${!!customer}${!!other}${!!verifier}`)) return finish();

  // A line carrying power is the case that must be gated.
  const poweredLine = (productId, variant) => ({
    items: [{ product: productId, quantity: 1, variant: { color: variant.color, size: variant.size, power: variant.power, cyl: variant.cyl } }],
    shippingAddress: ADDRESS,
    paymentMethod: 'cod'
  });

  /** Any product with a variant that has a non-zero power, so the gate has teeth. */
  const catalogue = (await call('/products?limit=200')).json.products || [];
  const looksPower = (v) => {
    const n = Number(String((v.power ?? v.size ?? '') + '').replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(n) && n !== 0 && String(v.power ?? v.size ?? '').trim() !== '' && /^[+-]?[\d.]+$/.test(String(v.power ?? v.size).trim().replace(/\s/g, ''));
  };
  const powered = catalogue.find((p) => (p.variants || []).some((v) => looksPower(v) && Number(v.stock) > 0));
  if (!check('seeded catalogue contains a powered variant', !!powered, powered?.title)) return finish();
  const rxVariant = (powered.variants || []).find((v) => looksPower(v) && Number(v.stock) > 0);

  // ---------------------------------------------------------------- prescription
  const noRx = await call('/orders', { token: customer, body: poweredLine(powered._id, rxVariant) });
  check('powered order without a prescription is refused', noRx.status === 403 && noRx.json?.code === 'PRESCRIPTION_REQUIRED',
    `${noRx.status} ${noRx.json?.code || noRx.json?.message}`);

  const made = await call('/auth/prescriptions', {
    token: customer,
    body: { fileUrl: '/uploads/prescriptions/safety.jpg', eyePower: { rightEye: { sph: String(rxVariant.power) }, leftEye: {} }, patientName: 'Safety Runner' }
  });
  if (!check('prescription upload queues a verification record', made.status === 201 && !!made.json?.verificationId, JSON.stringify(made.json?.verificationStatus || ''))) return finish();

  const asPending = await call('/orders', {
    token: customer,
    body: { ...poweredLine(powered._id, rxVariant), prescriptionId: made.json.prescription?._id }
  });
  // The pending case needs the *Prescription* id, which the save response does not
  // return; resolve it from the buyer's own list so the assertion is precise.
  const myList = (await call('/auth/prescriptions', { token: customer })).json.prescriptions || [];
  const rxRow = myList.find((x) => x.verificationStatus === 'pending') || myList[myList.length - 1];

  // Structured records are what the gate reads; find the one just created.
  const queue = (await call('/prescription-verification/pending', { token: verifier })).json.data || [];
  const mine = queue.filter((v) => v.user && (v.user.email === 'demo@optikart.com')).slice(-1)[0];
  if (!check('new prescription appears in the verifier queue', !!mine, queue.length ? `${queue.length} queued` : 'queue empty')) return finish();

  const pendingOrder = await call('/orders', {
    token: customer,
    body: { ...poweredLine(powered._id, rxVariant), prescriptionId: mine.prescription?._id }
  });
  check('pending review blocks the order', pendingOrder.status === 403 && pendingOrder.json?.code === 'PRESCRIPTION_PENDING',
    `${pendingOrder.status} ${pendingOrder.json?.code || ''}`);

  // Somebody else's prescription must not pass, and must not reveal why.
  const stolen = await call('/orders', {
    token: other || customer,
    body: { ...poweredLine(powered._id, rxVariant), prescriptionId: mine.prescription?._id }
  });
  check("another buyer's prescription is refused", stolen.status === 403 && stolen.json?.code === 'PRESCRIPTION_NOT_FOUND',
    `${stolen.status} ${stolen.json?.code || ''}`);

  // Reject it: the shopper should read the reason, not a bare failure.
  await call(`/prescription-verification/${mine._id}/reject`, { token: verifier, body: { reason: 'axis value is missing on the left eye' } });
  const rejectedOrder = await call('/orders', {
    token: customer,
    body: { ...poweredLine(powered._id, rxVariant), prescriptionId: mine.prescription?._id }
  });
  check('rejected prescription carries the reason to the shopper',
    rejectedOrder.status === 403 && rejectedOrder.json?.code === 'PRESCRIPTION_REJECTED' && /axis/.test(rejectedOrder.json?.message || ''),
    (rejectedOrder.json?.message || '').slice(0, 90));

  // Clean copy, approved: the order should go through.
  const requeue = await call('/auth/prescriptions', {
    token: customer,
    body: { fileUrl: '/uploads/prescriptions/clear.jpg', eyePower: { rightEye: { sph: String(rxVariant.power), cyl: '-0.50', axis: '90' }, leftEye: { sph: '-1.00' }, pd: '62' }, patientName: 'Safety Runner' }
  });
  const q2 = (await call('/prescription-verification/pending', { token: verifier })).json.data || [];
  const fresh = q2.filter((v) => v.user?.email === 'demo@optikart.com').slice(-1)[0];
  if (!check('second prescription queued for review', !!fresh, requeue.status)) return finish();
  const approved = await call(`/prescription-verification/${fresh._id}/approve`, { token: verifier, body: { notes: 'legible' } });
  check('verifier approves it', approved.status === 200, approved.json?.message);

  const okOrder = await call('/orders', {
    token: customer,
    body: { ...poweredLine(powered._id, rxVariant), prescriptionId: fresh.prescription?._id }
  });
  check('approved prescription lets the order through', [200, 201].includes(okOrder.status),
    `${okOrder.status} ${okOrder.json?.message || okOrder.json?.code || ''}`);

  // A non-powered line must never be blocked by this gate.
  const plain = catalogue.find((p) => !(p.variants || []).length && p.stock > 0);
  if (plain) {
    const plainOrder = await call('/orders', { token: customer, body: { items: [{ product: plain._id, quantity: 1 }], shippingAddress: ADDRESS, paymentMethod: 'cod' } });
    check('single-vision order without power is not blocked', [200, 201].includes(plainOrder.status), `${plainOrder.status}`);
  }

  return finish();
}

/**
 * Two buyers, one unit left, same instant. Read-check-save allowed both; the
 * conditional atomic update must allow exactly one.
 */
const lineNeedsPower = (p) => (p.variants || []).some((v) => {
  const raw = String((v.power ?? v.size ?? '') + '').trim().replace(/\s/g, '');
  return /^[+-]?[\d.]+$/.test(raw) && Number(raw.replace(/[^0-9.+-]/g, '')) !== 0;
}) || ['single vision', 'bifocal', 'progressive'].includes(String((p.variants || [])[0]?.lensType || '').toLowerCase());

async function stockRace() {
  const customer = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  const second = await login('/auth/login', 'testuser@optikart.com', 'Test123@') || customer;

  const seller = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  const inventory = (await call('/seller/inventory?limit=120', { token: seller })).json;
  const rows = inventory.products || inventory.data || [];

  /*
   * The seeded catalogue is entirely variant-based, so the race is set up on a
   * variant: pick one with stock, put it down to a single unit through the
   * seller's own inventory editor (which also proves that path persists), and
   * then race two buyers for it.
   */
  let host = null; let variant = null; let target = null;
  for (const row of rows) {
    const cand = (row.variants || []).find((v) => Number(v.stock) >= 2 && String(v.power ?? v.size ?? '').trim() !== '' && !/^[a-zA-Z]+$/.test(String(v.power ?? v.size).trim()));
    if (cand) { host = row; variant = cand; break; }
  }
  if (!host) return void check('found a stocked powered variant to race on', false, 'none in seller inventory');

  const set = await call(`/seller/inventory/${host._id}/variants/${variant._id}`, { token: seller, body: { stock: 1 }, method: 'PUT' });
  if (!check('seller can set variant stock through the inventory editor', [200, 201].includes(set.status) && set.json?.success !== false,
    `${set.status} ${set.json?.message || set.json?.error || JSON.stringify(set.json || {}).slice(0, 60)}`)) return;

  const readBack = (await call(`/products/${host._id}`)).json.product || {};
  const nowVariant = (readBack.variants || []).find((v) => String(v._id) === String(variant._id)) || {};
  if (!check('that stock edit really persisted', Number(nowVariant.stock) === 1, `variant stock=${nowVariant.stock}`)) return;

  target = host._id;
  const line = { product: target, quantity: 1, variant: { color: variant.color, size: variant.size, power: variant.power } };
  void line;

  const shot = (token, who) => call('/orders', {
    token,
    body: {
      items: [{ product: target, quantity: 1, variant: { color: variant.color, size: variant.size, power: variant.power } }],
      shippingAddress: { ...ADDRESS, name: who, phone: who === 'Race A' ? '9800007788' : '9800007789' },
      paymentMethod: 'cod'
    }
  });
  const [a, b] = await Promise.all([shot(customer, 'Race A'), shot(second === customer ? customer : second, 'Race B')]);

  const accepted = [a, b].filter((r) => [200, 201].includes(r.status)).length;
  const after = (await call(`/products/${target}`)).json.product || {};
  check('exactly one concurrent buyer wins the last unit', accepted === 1, `${accepted} accepted`);
  check('stock never goes negative', Number(after.stock) >= 0, `stock=${after.stock}`);
  check('the loser is told about stock, not blamed on the server',
    [a, b].some((r) => ![200, 201].includes(r.status) && /stock|sold out|unavailable/i.test(r.json?.message || '')),
    ([a, b].find((r) => ![200, 201].includes(r.status))?.json?.message || 'none refused').slice(0, 80));
}

function finish() {
  return stockRace().then(() => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} safety assertions passed`);
    process.exitCode = failed.length ? 1 : 0;
  });
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 2; });
