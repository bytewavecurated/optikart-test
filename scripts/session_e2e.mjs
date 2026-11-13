#!/usr/bin/env node
/**
 * Session lifetime suite.
 *
 * "Logout" used to mean the browser forgot the token. The token stayed valid
 * until its own expiry - 7 days for the admin console - so a second tab, a
 * shared machine, or anybody who had copied the string kept full access. Four
 * role consoles called a logout route that did not exist at all, and the client
 * swallowed the 404, so the failure was invisible from the outside.
 *
 * This proves both halves of the fix as an observer would see it: signing out
 * ends the session everywhere, and signing in again still works afterwards.
 *
 *   node scripts/session_e2e.mjs [base-url]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 140)}` : ''}`);
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

const ROLES = [
  { role: 'customer', login: '/auth/login', email: 'testuser@optikart.com', password: 'Test123@', logout: '/auth/logout', probe: '/auth/me' },
  { role: 'seller', login: '/seller/login', email: 'opticalworld@gmail.com', password: 'Seller123@', logout: '/seller/logout', probe: '/seller/me' },
  { role: 'admin', login: '/admin/auth/login', email: 'samedayopticians@gmail.com', password: 'Sameday123@', logout: '/admin/auth/logout', probe: '/admin/me' },
  { role: 'staff', login: '/auth/login', email: 'meera.staff@optikart.com', password: 'Staff123@', logout: '/auth/logout', probe: '/staff/overview' },
  { role: 'executive', login: '/executive/login', email: 'executive.delivery@optikart.com', password: 'Executive123@', logout: '/executive/logout', probe: '/executive/deliveries/assigned' },
  { role: 'manufacturer', login: '/manufacturer/login', email: 'rayban.manufacturer@optikart.com', password: 'Manufacturer123@', logout: '/manufacturer/logout', probe: '/manufacturer/products' },
  { role: 'retailer', login: '/manufacturer-seller/login', email: 'rayban.retailer1@optikart.com', password: 'Retailer123@', logout: '/manufacturer-seller/logout', probe: '/manufacturer-seller/me' },
  { role: 'delivery partner', login: '/delivery-partner/login', email: 'suresh.partner@optikart.com', password: 'Partner123@', logout: '/delivery-partner/logout', probe: '/delivery-partner/me' }
];

for (const r of ROLES) {
  const signedIn = await call(r.login, { body: { email: r.email, password: r.password } });
  const token = signedIn.json?.token;
  if (!check(`${r.role}: sign-in issues a token`, signedIn.status === 200 && !!token, signedIn.text)) continue;

  const live = await call(r.probe, { token });
  check(`${r.role}: protected read works while signed in`, live.status === 200, `status ${live.status}`);

  const out = await call(r.logout, { token, body: {} });
  check(`${r.role}: logout route exists`, out.status === 200, out.text);

  const after = await call(r.probe, { token });
  check(`${r.role}: the same token is refused after logout`, after.status === 401,
    `expected 401, got ${after.status}: ${after.text}`);
  check(`${r.role}: refusal says the session was signed out`, after.json?.code === 'SESSION_REVOKED',
    JSON.stringify(after.json));

  const again = await call(r.login, { body: { email: r.email, password: r.password } });
  const fresh = again.json?.token;
  check(`${r.role}: signing in again works`, again.status === 200 && !!fresh, again.text);
  if (fresh) {
    const reborn = await call(r.probe, { token: fresh });
    check(`${r.role}: the new session is live`, reborn.status === 200, `status ${reborn.status}`);
    await call(r.logout, { token: fresh, body: {} });
  }
}

/*
 * Tokens minted before session ids existed have no jti. They stay revocable
 * because the key falls back to the token itself - and only a hash of it is
 * ever stored, so the revocation table cannot hand anyone a working credential.
 */
const session = await import('../server/services/session.js');
const withJti = session.sessionKey({ decoded: { jti: 'abc-123' }, token: 'opaque-token-string' });
const withoutJti = session.sessionKey({ decoded: {}, token: 'opaque-token-string' });
check('session key is a hash', /^[0-9a-f]{64}$/.test(withJti));
check('session key prefers the minted jti over the token', withJti !== withoutJti);
check('a token with no jti is still revocable', /^[0-9a-f]{64}$/.test(withoutJti));
check('the stored key never contains the credential', !withoutJti.includes('opaque') && !withJti.includes('abc'));

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log(' failing:');
  for (const f of failed) console.log(`  - ${f.name}`);
  process.exitCode = 1;
}
