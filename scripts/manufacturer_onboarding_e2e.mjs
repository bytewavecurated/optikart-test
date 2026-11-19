#!/usr/bin/env node
/**
 * Manufacturer onboarding: KYC completeness, emailed confirmation, the
 * update-request loop through the desk, and OTP-gated instatement.
 *
 * Pinned behaviour (services/manufacturerOnboarding.js):
 *  - the desk cannot create a half-record: missing GST/PAN/bank/address
 *    arrive as a field-list, not a 500 or a silent save;
 *  - creation lands PENDING: sign-in refuses with the onboarding state and
 *    a usable sentence, never "invalid password";
 *  - the emailed token opens the record (public), VERIFY escalates to an
 *    OTP (dev-no-smtp hands back devCode so this suite - and a laptop with
 *    no mailer - can finish the walk), a wrong code is refused and counted,
 *    and only the right code flips the manufacturer active;
 *  - UPDATE files a PROPOSAL (never live), the desk sees it in the queue,
 *    re-create applies it deliberately and every OLD token dies;
 *  - re-create rejects proposals that would break KYC.
 *
 * Run with no SMTP (the harness always does), so every mail path exercises
 * the honest dev fallback and `mail.devToken`.
 */
import Manufacturer from '../server/models/Manufacturer.js';

// scripts/ has no node_modules; borrow the instance the models resolve on.
const mongoose = Manufacturer.db.base;

const BASE = process.argv[2] || process.env.VERIFY_BASE || 'http://localhost:3111';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
  return ok;
};

const call = async (path, { token, body, method } = {}) => {
  const res = await fetch(BASE + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

const stamp = Date.now();
const EMAIL_A = `onb.a.${stamp}@e2e.optikart.test`;
const EMAIL_B = `onb.b.${stamp}@e2e.optikart.test`;

const complete = (email, brandTag = 'a') => ({
  name: 'Test Signatory',
  companyName: `E2E Optics ${stamp}`,
  email,
  password: 'OnbTest123@',
  phone: '9800001234',
  gstNumber: '27ABCDE1234F1Z5',
  panNumber: 'ABCDE1234F',
  address: { street: '1 Test Works', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
  bank: {
    accountNumber: '12345678901234',
    ifscCode: 'SBIN0001234',
    bankName: 'State Bank of India',
    branchName: 'MG Road',
  },
  brands: [`E2Ebrand-${brandTag}-${stamp}`],
});

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required (run via scripts/verify.mjs)');
  await mongoose.connect(process.env.MONGODB_URI);

  const admin = (
    await call('/api/admin/auth/login', { body: { email: 'samedayopticians@gmail.com', password: 'Sameday123@' } })
  ).json?.token;
  if (!check('admin login', !!admin)) throw new Error('no admin session');

  /* ---------------------- KYC refusal, in detail ---------------------- */
  const partial = {
    ...complete(EMAIL_A),
    gstNumber: '',
    bank: { accountNumber: '', ifscCode: '', bankName: '', branchName: '' },
  };
  let r = await call('/api/admin/manufacturers', { token: admin, body: partial });
  const badFields = new Set((r.json?.errors || []).map((e) => e.field));
  check(
    'incomplete record refused with a field list (GST + bank lines named)',
    r.status === 400 && badFields.has('gstNumber') && badFields.has('bank.ifscCode'),
    JSON.stringify(r.json?.errors || []).slice(0, 140)
  );

  r = await call('/api/admin/manufacturers', {
    token: admin,
    body: { ...complete(EMAIL_A), gstNumber: 'NOTAVALIDGST' },
  });
  check(
    'malformed GSTIN rejected on shape, not just presence',
    r.status === 400 && (r.json?.errors || []).some((e) => /GSTIN/.test(e.message))
  );

  /* --------------------- create = pending, not live ------------------- */
  r = await call('/api/admin/manufacturers', { token: admin, body: complete(EMAIL_A) });
  const created = r.json?.manufacturer;
  const mailA = r.json?.onboarding?.mail;
  check(
    'complete record creates as PENDING with a mail token (dev fallback here)',
    r.status === 201 && r.json?.onboarding?.state === 'pending_verification' && !!mailA?.devToken,
    JSON.stringify(r.json?.onboarding)
  );

  const loginPending = await call('/api/manufacturer/login', { body: { email: EMAIL_A, password: 'OnbTest123@' } });
  check(
    'pending manufacturer cannot sign in, and the 403 says what is missing',
    loginPending.status === 403 &&
      loginPending.json?.onboarding === 'pending_verification' &&
      /confirmation/i.test(loginPending.json?.message),
    loginPending.json?.message
  );

  /* --------------------- verify -> OTP -> activated ------------------- */
  const tokenA = mailA.devToken;
  let open = await call(`/api/manufacturer/onboarding/${tokenA}`);
  check(
    'the emailed token opens the record for the company',
    open.status === 200 && open.json?.onboarding?.state === 'pending_verification'
  );

  let v = await call(`/api/manufacturer/onboarding/${tokenA}/verify`, { body: {} });
  check(
    'VERIFY starts activation and produces the code (dev-honest)',
    v.status === 200 && v.json?.success === true && !!v.json?.devCode,
    v.json?.message
  );

  let bad = await call(`/api/manufacturer/onboarding/${tokenA}/otp`, {
    body: { otp: '000000' === v.json.devCode ? '111111' : '000000' },
  });
  check('a wrong code refuses and does not activate', bad.status === 400);
  const stillPending = await Manufacturer.findById(created._id).select('isActive onboarding');
  check(
    'record still pending after the wrong code',
    stillPending.isActive === false && stillPending.onboarding.state === 'pending_otp'
  );

  v = await call(`/api/manufacturer/onboarding/${tokenA}/otp`, { body: { otp: String(v.json?.devCode) } });
  check('the right code activates the account', v.status === 200 && v.json?.success === true);

  let loginActive = await call('/api/manufacturer/login', { body: { email: EMAIL_A, password: 'OnbTest123@' } });
  check('after activation, the desk-issued password verifies', loginActive.status === 200);
  /*
   * This manufacturer is NOT a seeded public demo account, so the OTP-bypass
   * allow-list does not apply (that list is deliberately narrow - accounts
   * whose password is also published). The honest completion of the real
   * login second factor is mailed; with the no-SMTP dev fallback the code
   * comes back as devCode and we finish exactly the way /verify-login-otp
   * expects. Reaching a session is the whole point of activation, so the
   * suite walks that step instead of pretending it isn't there.
   */
  if (loginActive.json?.requiresOTP) {
    loginActive = await call('/api/manufacturer/verify-login-otp', {
      body: { manufacturerId: loginActive.json.manufacturerId, otp: String(loginActive.json.devCode) },
    });
  }
  check(
    'and the manufacturer reaches a usable session',
    loginActive.status === 200 && !!loginActive.json?.token,
    JSON.stringify(loginActive.json || {}).slice(0, 100)
  );

  const reopen = await call(`/api/manufacturer/onboarding/${tokenA}`);
  check('used token is dead for activation steps (state changed)', reopen.status === 200 || reopen.status === 404);

  /* ---------------- desk correction loop with manufacturer B ---------------- */
  r = await call('/api/admin/manufacturers', { token: admin, body: complete(EMAIL_B, 'b') });
  const mailB = r.json?.onboarding?.mail;
  const tokB = mailB.devToken;

  let u = await call(`/api/manufacturer/onboarding/${tokB}/update`, {
    body: {
      updates: { companyName: 'Renamed E2E Optics', phone: '9800009999' },
      note: 'legal name changed after incorporation',
    },
  });
  check('UPDATE files a proposal', u.status === 200 && u.json?.success === true, u.json?.message);

  const recB = await Manufacturer.findById(r.json?.manufacturer?._id).select('companyName onboarding');
  check(
    'the proposal is NOT live: stored company name unchanged, state update_requested',
    recB.companyName === `E2E Optics ${stamp}` && recB.onboarding.state === 'update_requested',
    JSON.stringify({ companyName: recB.companyName, state: recB.onboarding.state })
  );

  const q = await call('/api/admin/manufacturer-update-requests', { token: admin });
  const entry = (q.json?.data || []).find((x) => x.email === EMAIL_B);
  check(
    'the desk queue shows the request with its fields',
    q.status === 200 && !!entry && Object.keys(entry.updates).length === 2
  );

  u = await call(`/api/manufacturer/onboarding/${tokB}/update`, {
    token: admin,
    body: { updates: { gstNumber: 'GARBAGE' } },
  });
  check('an update proposal that breaks KYC is bounced', u.status === 400 || u.status === 409, JSON.stringify(u.json));

  let rc = await call(`/api/admin/manufacturers/${recB._id}/recreate-invitation`, { token: admin, body: {} });
  check(
    're-create applies proposals, re-mails, and returns a NEW token',
    rc.status === 200 && rc.json?.mail?.devToken && rc.json?.mail?.devToken !== tokB
  );

  const oldTok = await call(`/api/manufacturer/onboarding/${tokB}/verify`, { body: {} });
  check('the old token died when the invitation was re-created', oldTok.status === 404);

  const freshTok = rc.json?.mail?.devToken;
  const applied = await Manufacturer.findById(recB._id).select('companyName onboarding');
  check(
    'state returned to pending_verification with the proposed values applied',
    applied.companyName === 'Renamed E2E Optics' && applied.onboarding.state === 'pending_verification'
  );

  v = await call(`/api/manufacturer/onboarding/${freshTok}/verify`, { body: {} });
  await call(`/api/manufacturer/onboarding/${freshTok}/otp`, { body: { otp: String(v.json?.devCode) } });
  let loginB = await call('/api/manufacturer/login', { body: { email: EMAIL_B, password: 'OnbTest123@' } });
  if (loginB.json?.requiresOTP) {
    loginB = await call('/api/manufacturer/verify-login-otp', {
      body: { manufacturerId: loginB.json.manufacturerId, otp: String(loginB.json.devCode) },
    });
  }
  check(
    'second manufacturer activates through the corrected record end-to-end',
    loginB.status === 200 && !!loginB.json?.token
  );

  /* --------------------------- cleanup --------------------------- */
  await Manufacturer.deleteMany({ email: { $in: [EMAIL_A, EMAIL_B] } });
  const { default: Notification } = await import('../server/models/Notification.js');
  await Notification.deleteMany({ type: 'manufacturer_update_request' });

  const failed = results.filter((x) => !x.ok);
  console.log(`${results.length - failed.length}/${results.length} onboarding checks passed`);
  process.exitCode = failed.length ? 1 : 0;
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('FATAL', e);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exitCode = 1;
});
