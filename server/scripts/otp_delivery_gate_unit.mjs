#!/usr/bin/env node
/**
 * The OTP delivery gate, asserted in both directions.
 *
 * What is under test is a security boundary that hangs off a single string
 * comparison. A code may appear in an HTTP response body (`devCode`) only when
 * this machine cannot mail it AND it is not production. The second half is the
 * entire protection, and it used to be written two different ways in the same
 * app: `isProduction()` in config/authMode.js, which trims and lowercases, and an
 * inline `process.env.NODE_ENV === 'production'`, which does neither.
 *
 * That difference is not stylistic. A deployment started with NODE_ENV=Production
 * (or ' production') fails the inline comparison, takes the development branch,
 * and starts handing out sign-in and password-reset codes to anyone who names an
 * account - while believing it is a production server that refuses to do exactly
 * that. So every odd-but-plausible spelling is asserted here, not just the
 * canonical one.
 *
 * The route-facing half is tested without a database or a mail server:
 * describeOtpDelivery is a pure decision over a send result, which is precisely
 * why it can be pinned down completely.
 *
 *   node server/scripts/otp_delivery_gate_unit.mjs
 */
import assert from 'node:assert/strict';
import { isProduction } from '../config/authMode.js';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 170)}` : ''}`);
};

const ENV = ['NODE_ENV', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];

// Fresh module each time: undeliverable() reads the env when the module is
// imported, so a cached instance would report the previous case.
const freshEmail = async () => {
  const url = new URL('../services/email.js', import.meta.url).href;
  return import(`${url}?v=${Math.random().toString(36).slice(2)}`);
};

const noMailConfigured = () => {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
};

/* ── 1. one definition of "production" ──────────────────────────────────────── */
const savedEnv = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
try {
  /*
   * Note the first draft of this list: it included 'PrOdAcTiOn', which lowercases
   * to 'prodaction' - a typo in the fixture, not in isProduction(). The assertion
   * failed, and the lesson is that a case-insensitivity test must be checked
   * against the string it thinks it wrote, or it "finds" a bug in code that is
   * correct.
   */
  for (const spelling of ['production', 'Production', 'PRODUCTION', ' PRODUCTION ', 'production ', 'pRoDuCtIoN\t']) {
    process.env.NODE_ENV = spelling;
    check(`isProduction() treats ${JSON.stringify(spelling)} as production`, isProduction() === true);
  }
  for (const spelling of ['development', 'test', 'staging']) {
    process.env.NODE_ENV = spelling;
    check(`isProduction() is false for ${spelling}`, isProduction() === false);
  }
  delete process.env.NODE_ENV;
  check('a bare laptop run (NODE_ENV unset) is not production', isProduction() === false);

  const emailSrc = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../services/email.js', import.meta.url), 'utf8')
  );
  check(
    'the mail service asks isProduction(), never the raw string comparison',
    !/process\.env\.NODE_ENV === 'production'/.test(emailSrc) && /isProduction\(\)/.test(emailSrc),
    emailSrc.includes("process.env.NODE_ENV === 'production'") ? 'inline comparison still present' : 'ok'
  );

  /* ── 2. production must not fabricate a code ──────────────────────────────── */
  process.env.NODE_ENV = 'production';
  noMailConfigured();
  {
    const { sendOTP, isSmtpConfigured, describeOtpDelivery } = await freshEmail();
    check('no SMTP credentials -> isSmtpConfigured() is false', isSmtpConfigured() === false);
    const out = await sendOTP('someone@example.test', '161394', 'reset');
    check('production without SMTP -> the send reports failure', out.success === false, JSON.stringify(out));
    check('and offers no code to put in a response', !out.devCode, JSON.stringify(out));
    const described = describeOtpDelivery(out, { purpose: 'verification' });
    check(
      'the route answers 503, not "check your inbox"',
      described.status === 503 && described.ok === false,
      JSON.stringify(described)
    );
    check(
      'the failure text says no code was issued',
      /no code has been issued|nothing to wait for/i.test(described.message),
      described.message
    );
    check('and devCode stays null in that answer', described.devCode === null || described.devCode === undefined);
  }

  /* the same spelling trap, end to end */
  process.env.NODE_ENV = 'Production';
  noMailConfigured();
  {
    const { sendOTP } = await freshEmail();
    const out = await sendOTP('someone@example.test', '111222', 'login');
    check(
      'NODE_ENV=Production is production: still no code offered',
      out.success === false && !out.devCode,
      JSON.stringify(out)
    );
  }

  /* ── 3. development keeps working, out loud ───────────────────────────────── */
  process.env.NODE_ENV = 'development';
  noMailConfigured();
  {
    const { sendOTP, describeOtpDelivery } = await freshEmail();
    const out = await sendOTP('someone@example.test', '998877', 'login');
    check(
      'a local server with no mailer can still complete a flow',
      out.success === true && out.delivered === false && out.devCode === '998877',
      JSON.stringify(out)
    );
    const described = describeOtpDelivery(out, { purpose: 'sign-in' });
    check(
      'and the response labels it as an unconfigured-mailer fallback',
      described.ok === true && /not configured/i.test(described.message) && described.devCode === '998877',
      JSON.stringify(described)
    );
  }

  /* ── 4. the pure decision table ───────────────────────────────────────────── */
  {
    const { describeOtpDelivery } = await freshEmail();
    const delivered = describeOtpDelivery({ success: true, delivered: true });
    check(
      'a delivered send is described as delivered',
      delivered.ok && delivered.status === 200 && !delivered.devCode,
      JSON.stringify(delivered)
    );
    const refused = describeOtpDelivery({ success: false, reason: 'send-failed' });
    check(
      'a failed send never claims delivery',
      refused.ok === false && !/sent to your|check your inbox/i.test(refused.message),
      JSON.stringify(refused)
    );
    const nonsense = describeOtpDelivery(undefined);
    check(
      'a missing result is treated as a failure, not as success',
      nonsense.ok === false && nonsense.status === 503,
      JSON.stringify(nonsense)
    );
    const purpose = describeOtpDelivery({ success: false }, { purpose: 'password reset' });
    check(
      'the message names what the code was for',
      /password reset/i.test(purpose.message),
      purpose.message.slice(0, 90)
    );
  }
} catch (error) {
  check(
    'the gate suite ran without an unexpected failure',
    false,
    `${error.message} @ ${(error.stack || '').split('\n')[1] || ''}`
  );
} finally {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} OTP delivery-gate checks passed`);
failed.forEach((f) => console.log(`  - ${f.name}`));
process.exitCode = failed.length ? 1 : 0;
