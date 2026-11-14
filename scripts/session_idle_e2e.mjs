#!/usr/bin/env node
/**
 * Idle sign-out suite.
 *
 * The rule under test: a console left untouched stops working, and the customer
 * storefront does not get punished for it. Waiting an hour to prove that is not a
 * test anyone runs, so this starts its own API process with
 * `SESSION_IDLE_MINUTES` shortened to nine seconds' worth, and observes what the
 * server does to a session that went quiet.
 *
 * Requirements: MONGODB_URI must be set (verify.mjs passes it; or point it at any
 * seeded development database). Boots on its own port so it cannot interfere with
 * whatever else is running.
 *
 *   MONGODB_URI=mongodb://127.0.0.1:27017/eyewear-platform node scripts/session_idle_e2e.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.IDLE_TEST_PORT || 3223);
const BASE = `http://127.0.0.1:${PORT}`;
const API = `${BASE}/api`;
// 0.15 minutes = nine seconds of idle before a console is signed out.
const WINDOW_MINUTES = 0.15;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
  return ok;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const call = async (p, { token, body, method } = {}) => {
  const res = await fetch(API + p, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text };
};

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required: this suite boots its own API process.');
  process.exit(2);
}

const server = spawn('node', ['server.js'], {
  cwd: path.join(ROOT, 'server'),
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'development',
    SEED_ON_BOOT: 'true',
    MONGODB_URI: process.env.MONGODB_URI,
    SESSION_IDLE_MINUTES: String(WINDOW_MINUTES)
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverTail = '';
server.stdout.on('data', (c) => { serverTail = (serverTail + c).slice(-4000); });
server.stderr.on('data', (c) => { serverTail = (serverTail + c).slice(-4000); });

const stop = () => { try { server.kill('SIGTERM'); } catch { /* gone */ } };
process.on('SIGINT', () => { stop(); process.exit(130); });

async function waitHealthy(deadlineMs = 150000) {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    if (server.exitCode !== null) return `exited with ${server.exitCode}`;
    try {
      const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return true;
    } catch { /* not yet */ }
    await sleep(1500);
  }
  return 'timed out';
}

async function main() {
  const healthy = await waitHealthy();
  if (healthy !== true) {
    console.error(`the test server never became healthy: ${healthy}\n${serverTail.split('\n').slice(-20).join('\n')}`);
    stop();
    process.exitCode = 1;
    return;
  }

  const admin = await call('/admin/auth/login', { body: { email: 'samedayopticians@gmail.com', password: 'Sameday123@' } });
  const adminToken = admin.json?.token;
  if (!check('console signed in (short idle window active)', !!adminToken, admin.text)) return finish();

  const policy = await call('/auth/session-policy', { token: adminToken });
  check('the server publishes the window it enforces',
    Number(policy.json?.policy?.windowMinutes) === WINDOW_MINUTES && policy.json?.policy?.controlled === true,
    JSON.stringify(policy.json?.policy));
  check('and tells the console how long this session has left',
    typeof policy.json?.policy?.secondsRemaining === 'number', JSON.stringify(policy.json?.policy));

  const first = await call('/admin/me', { token: adminToken });
  check('an active console works normally', first.status === 200, `status ${first.status}`);

  // Keep the session alive the way a working desk would: activity inside the
  // window must not expire it, otherwise the rule is just a short token.
  await sleep(4000);
  const mid = await call('/admin/me', { token: adminToken });
  check('activity inside the window keeps the session alive', mid.status === 200, `status ${mid.status}`);

  await sleep(Math.ceil(WINDOW_MINUTES * 60000) + 3000);
  const afterIdle = await call('/admin/me', { token: adminToken });
  check('an idled console is refused', afterIdle.status === 401, `status ${afterIdle.status}: ${afterIdle.text.slice(0, 90)}`);
  check('and refused with the reason, so the screen can say it out loud',
    afterIdle.json?.code === 'SESSION_IDLE' && /without activity/i.test(afterIdle.json?.message || ''),
    JSON.stringify(afterIdle.json));
  check('the message is spoken in whole minutes, never as "0.15 minutes"',
    !/0\.\d+ minutes/.test(afterIdle.json?.message || '') && /minute/i.test(afterIdle.json?.message || ''),
    afterIdle.json?.message);

  const revived = await call('/admin/auth/login', { body: { email: 'samedayopticians@gmail.com', password: 'Sameday123@' } });
  check('signing in again works', !!revived.json?.token, revived.text);
  const again = await call('/admin/me', { token: revived.json?.token });
  check('and the new session is live', again.status === 200, `status ${again.status}`);

  /*
   * The exclusion, which is the part a reviewer should be able to check rather
   * than take on trust: a shopper's session must survive the same silence.
   */
  const cust = await call('/auth/login', { body: { email: 'demo@optikart.com', password: 'Demo123@' } });
  const custToken = cust.json?.token;
  if (!check('a customer session starts', !!custToken, cust.text)) return finish();
  const custPolicy = await call('/auth/session-policy', { token: custToken });
  check('a customer is told they are outside the idle rule',
    custPolicy.json?.policy?.controlled === false, JSON.stringify(custPolicy.json?.policy));
  await sleep(Math.ceil(WINDOW_MINUTES * 60000) + 3000);
  const custAfter = await call('/auth/me', { token: custToken });
  check('and an idle customer is not signed out', custAfter.status === 200, `status ${custAfter.status}`);

  return finish();
}

function finish() {
  stop();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} idle-session assertions passed`);
  if (failed.length) {
    console.log(' failing:');
    for (const f of failed) console.log(`  - ${f.name}`);
    console.log('\nserver output tail:\n' + serverTail.split('\n').slice(-16).join('\n'));
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error('SCRIPT ERROR', e); stop(); process.exitCode = 2; });
