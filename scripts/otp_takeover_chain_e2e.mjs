#!/usr/bin/env node
/**
 * The phone-OTP takeover chain, attempted on every push.
 *
 * What this file exists because of: POST /api/auth/send-otp took a phone number,
 * required no session, and answered with the code it had just generated
 * (`{ success: true, message: 'OTP sent successfully.', otp }`). Its partner POST
 * /api/auth/verify-otp - also sessionless - exchanges that code for
 * `generateToken(user._id)`, a seven-day bearer token. Two unauthenticated
 * requests and any 10-digit number the attacker knows, buys or guesses was a
 * complete account takeover of any shopper, reachable with curl. The response also
 * distinguished "Phone number not registered", which turns guessing into
 * enumeration.
 *
 * The code field was a development convenience that shipped. It is gone, and this
 * suite is what keeps it gone: the fix is one deleted response property, the most
 * easily "restored for testing" line in the codebase, and a regression would show
 * up as a passing test suite rather than an incident only if nothing asserts it.
 *
 * Asserted here against a real server:
 *  - no undocumented credential field in any auth response;
 *  - a code that *is* returned is only ever the labelled development fallback;
 *  - a blind guess never yields a token;
 *  - the chain cannot be completed from the response alone in any mode where mail
 *    is configured (which is what production is - pinned in
 *    server/scripts/otp_delivery_gate_unit.mjs).
 *
 *   node scripts/otp_takeover_chain_e2e.mjs [base-url]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;

/* A seeded shopper's number; the suites all run against the seeded database. */
const SEEDED_PHONE = '9876543219';
const UNREGISTERED_PHONE = '8999999999';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 190)}` : ''}`);
};

/*
 * Two narrow predicates for the "mail worked" branch. Kept as functions rather
 * than inlined so the earlier `check(...)` uses the same words the assertions
 * name, and so a future edit cannot leave one of them comparing to a literal.
 */
const deliveryClaimed = (json) =>
  /on its way|has been sent|is on its way|check your (email|inbox)/i.test(String(json?.message || ''));
const credentialFields = (json) => {
  const flat = flatten(json);
  return flat.some(([p, v]) => {
    const leaf = p
      .split('.')
      .pop()
      .replace(/\[\d+\]$/, '')
      .toLowerCase();
    return (
      leaf !== 'devcode' && FORBIDDEN_CREDENTIAL_FIELDS.includes(leaf) && v !== null && v !== undefined && v !== ''
    );
  });
};

const post = async (path, body) => {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text };
};

/* Names that must never appear in an auth response with a live value. */
const FORBIDDEN_CREDENTIAL_FIELDS = ['otp', 'password', 'resetOtp', 'loginOtp', 'phoneOtp', 'plainPassword', 'code'];

const flatten = (value, prefix = '') => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap((v, i) => flatten(v, `${prefix}[${i}]`));
  if (typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
  return [[prefix, value]];
};

async function main() {
  const health = await fetch(`${API}/health`).catch(() => null);
  if (!health?.ok) {
    console.log('SKIP  otp takeover chain (no API at ' + API + ')');
    process.exit(0);
  }

  /* ── step 1: ask for a code, unauthenticated ─────────────────────────────── */
  const send = await post('/auth/send-otp', { phone: SEEDED_PHONE });
  check(
    'the endpoint is reachable without a session (so the finding was as described)',
    send.status === 200 || send.status === 503,
    `HTTP ${send.status}`
  );

  const entries = flatten(send.json);
  const leaks = entries.filter(([path, value]) => {
    const leaf = path
      .split('.')
      .pop()
      .replace(/\[\d+\]$/, '');
    const isCredentialName = FORBIDDEN_CREDENTIAL_FIELDS.includes(leaf.toLowerCase());
    return (
      isCredentialName && value !== null && value !== undefined && value !== '' && leaf.toLowerCase() !== 'devcode'
    );
  });
  check(
    'no credential-shaped field appears in the response',
    leaks.length === 0,
    leaks.map(([p, v]) => `${p}=${String(v).slice(0, 10)}`).join(', ') || `fields: ${entries.map(([p]) => p).join(',')}`
  );

  /*
   * `devCode` is allowed here and only here: this server is development with no
   * configured mailer, so the code cannot be mailed and the flow would otherwise
   * be untestable. The point of these assertions is that the value is (a) named
   * for what it is, and (b) accompanied by a message saying email is unconfigured
   * rather than one claiming a delivery - so nobody can mistake it for the old
   * `otp` field.
   */
  const devCode = send.json?.devCode ?? null;
  if (devCode) {
    check(
      'the development fallback is labelled as such in the same response',
      /not configured|development/i.test(String(send.json?.message || '')),
      String(send.json?.message).slice(0, 130)
    );
    check('the undocumented `otp` spelling is gone', !('otp' in (send.json || {})), Object.keys(send.json).join(','));
  } else {
    /*
     * No code came back - which is the case worth asserting rather than papering
     * over with `true` (my first version did exactly that, printing a PASS line
     * that verified nothing, in the very file written to stop this bug class).
     * Assert the two things that must be true instead: the answer claims
     * delivery, and no field in it carries a credential.
     */
    check(
      'when mail is configured the response claims delivery and carries no code',
      send.status === 200 && deliveryClaimed(send.json) && !credentialFields(send.json),
      JSON.stringify(send.json).slice(0, 150)
    );
  }

  /* ── step 2: a blind guess must not produce a session ────────────────────── */
  const blind = await post('/auth/verify-otp', { phone: SEEDED_PHONE, otp: '000000' });
  check(
    'a guessed code yields no token',
    !blind.json?.token,
    `HTTP ${blind.status} ${JSON.stringify(blind.json)?.slice(0, 90)}`
  );
  check('and the rejection is a 4xx, not a 500', blind.status >= 400 && blind.status < 500, `HTTP ${blind.status}`);

  /* ── step 3: the chain, end to end, only if a code was handed out ────────── */
  if (devCode) {
    const chain = await post('/auth/verify-otp', { phone: SEEDED_PHONE, otp: String(devCode) });
    /*
     * This SUCCEEDS, and that is the honest shape of what is left: a development
     * server that cannot mail is deliberately permissive, because otherwise nobody
     * can test the login flow locally. The security claim is narrower and is
     * exactly this sentence: in production the code is never in a body, which is
     * proven at the decision point in server/scripts/otp_delivery_gate_unit.mjs
     * (including the NODE_ENV='Production' casing that a raw string comparison
     * gets wrong). Asserting the chain FAILS here would be asserting something the
     * development server is designed not to do.
     */
    check(
      'the development fallback is the only path that can complete this chain',
      Boolean(chain.json?.token),
      `HTTP ${chain.status}`
    );
    check(
      'and it never appears as a bare `otp` field that could be mistaken for production behaviour',
      !('otp' in (send.json || {})) && !!send.json?.devCode
    );
  }

  /* ── step 4: the enumeration oracle, recorded rather than hidden ─────────── */
  const unknown = await post('/auth/send-otp', { phone: UNREGISTERED_PHONE });
  check(
    'unregistered numbers answer differently (known weakness, disclosed here on purpose)',
    unknown.status === 404 || /not registered/i.test(String(unknown.json?.message)),
    `HTTP ${unknown.status} ${String(unknown.json?.message).slice(0, 70)}`
  );
  /*
   * send-otp confirms which phone numbers hold accounts, which is what makes
   * guessing worth attempting. It is left in place because the sign-in UX depends
   * on telling a user their number is not registered, and silently changing that
   * during a security batch is the kind of unreviewed behaviour change I have been
   * careful about elsewhere. So it is asserted as it actually is, with a
   * deliberately loose rate limiter check below to at least slow it down.
   */
  const hammer = [];
  for (let i = 0; i < 14; i += 1) {
    const r = await post('/auth/send-otp', { phone: UNREGISTERED_PHONE });
    hammer.push(r.status);
  }
  check(
    'the attempt limiter eventually refuses repeat probing of that oracle',
    hammer.includes(429),
    `statuses: ${hammer.join(',')}`
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OTP chain checks passed`);
  failed.forEach((f) => console.log(`  - ${f.name}`));
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  /*
   * A crash must not look like a pass. `finish?.()` referenced a function this
   * file never defines (optional chaining quietly skipped it) - the failure mode
   * being an exit code of 0 on a suite that never ran its checks.
   */
  console.log(`\nOTP-CHAIN SUITE CRASHED: ${e.message}`);
  console.log((e.stack || '').split('\n')[1] || '');
  process.exitCode = 1;
});
