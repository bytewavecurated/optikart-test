#!/usr/bin/env node
/**
 * The idle decision, checked as arithmetic.
 *
 * The end-to-end suite (`session_idle_e2e.mjs`) proves the rule fires against a
 * live server, but it has to shorten a window and sleep, which makes it slow and
 * coarse at the boundaries. The boundary itself - the exact second a session
 * turns from alive to expired - is a pure function of the stored row, the clock
 * and the window, so it can be tested directly and instantly, including the
 * combinations an integration test will never land on by accident: a session idle
 * for exactly the window, one second over, a role that is not controlled, a
 * missing row, a disabled window, and the throttle that keeps a busy dashboard
 * from writing the activity row on every single request.
 *
 * The roles are listed here rather than trusted to a constant in the service, so
 * that adding a console role to the codebase without thinking about whether it
 * should idle-expire shows up as a failing test instead of a silent policy
 * change.
 *
 *   node scripts/session_idle_unit.mjs
 */
import { evaluateSessionActivity, isControlledRole, CONTROLLED_ROLES } from '../server/services/sessionActivity.js';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail)}` : ''}`);
  return ok;
};

const NOW = Date.parse('2026-05-01T12:00:00.000Z');
const minutesAgo = (m) => new Date(NOW - m * 60000);
const WINDOW = 60;
const run = (role, lastSeenAt, extra = {}) => evaluateSessionActivity({
  decoded: { role },
  row: lastSeenAt === null ? null : { lastSeenAt },
  now: NOW,
  windowMinutes: WINDOW,
  ...extra
});

check('the controlled set is the six consoles, exactly',
  CONTROLLED_ROLES.length === 6
    && ['admin', 'staff', 'executive', 'manufacturer', 'manufacturerSeller', 'deliveryPartner'].every((r) => CONTROLLED_ROLES.includes(r)),
  CONTROLLED_ROLES.join(','));

const cust = run('user', minutesAgo(600));
check('a customer session is never touched by the idle rule',
  cust.controlled === false && cust.idle === undefined && cust.refresh === false);

[...CONTROLLED_ROLES].forEach((role) => {
  check(`${role}: an idle session is refused at ${WINDOW + 1} minutes`,
    run(role, minutesAgo(WINDOW + 1)).idle === true);
  check(`${role}: still alive at ${WINDOW - 1} minutes`,
    run(role, minutesAgo(WINDOW - 1)).idle === false);
});

const exact = run('admin', minutesAgo(WINDOW));
check('the boundary is inclusive of the window, not off by a minute',
  exact.idle === false && exact.idleSeconds === WINDOW * 60, JSON.stringify(exact));

check('a session with no activity row yet is accepted and seeded',
  (() => { const r = run('admin', null); return r.idle === false && r.refresh === true; })());

// The throttle is the point of comparing against `refreshSeconds`, so both
// sides of it are asserted: two minutes of silence is due a write, ten seconds
// is not. A poll every few seconds must not turn this into the busiest table in
// the database, and an hour of quiet must not leave the row stale either.
const due = run('admin', minutesAgo(2), { refreshSeconds: 60 });
check('two minutes since the last write is due a refresh',
  due.refresh === true && due.idle === false, JSON.stringify(due));
// Ten seconds of silence is well inside a 60-minute window, and below the
// 60-second write throttle, so: alive and no write.
const fresh = evaluateSessionActivity({
  decoded: { role: 'admin' },
  row: { lastSeenAt: new Date(NOW - 10000) },
  now: NOW,
  windowMinutes: WINDOW,
  refreshSeconds: 60
});
check('a request ten seconds after the last write does not write again',
  fresh.refresh === false && fresh.idle === false && fresh.idleSeconds === 10, JSON.stringify(fresh));

const disabled = evaluateSessionActivity({
  decoded: { role: 'admin' },
  row: { lastSeenAt: minutesAgo(999) },
  now: NOW,
  windowMinutes: 0
});
check('window 0 means the rule is not evaluated at all',
  disabled.controlled === false && disabled.disabled === true && disabled.refresh === false,
  JSON.stringify(disabled));

const idleLong = run('admin', minutesAgo(WINDOW + 1));
check('the refusal reports how long it was idle, for the log',
  idleLong.idleSeconds === (WINDOW + 1) * 60, JSON.stringify(idleLong));

check('an unknown role is treated as uncontrolled rather than expired',
  run('who-knows-what', minutesAgo(600)).controlled === false);

check('isControlledRole agrees with the list',
  isControlledRole('admin') === true && isControlledRole('user') === false && isControlledRole(undefined) === false);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} idle-decision checks passed`);
if (failed.length) process.exitCode = 1;
