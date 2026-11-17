#!/usr/bin/env node
/**
 * The production seed guard, checked as arithmetic.
 *
 * READ THIS FIRST: `seedDecision` no longer describes anything the application
 * does. The app cannot seed at all - the demo dataset moved to
 * `server/fixtures/` and server.js stopped importing it, so there is no boot-time
 * decision left to make (see server/fixtures_destruction_guard_unit.mjs for what IS
 * enforced now, and OPERATIONS.md "Demo fixtures, staging, and production").
 *
 * The cases below are kept because two things remain live:
 *  - `productionBootErrors`, which still refuses a production start that sets
 *    SEED_ON_BOOT=true without ALLOW_DEMO_SEED - not because it would seed, but
 *    because an operator following a stale runbook should hear that now, from an
 *    error, rather than later from a database that never filled;
 *  - the historical decision table itself, which the next reader will find in
 *    authMode.js and reasonably assume is current. Pinning it, with
 *    `@deprecated` on the function and this note above the tests, is the honest
 *    version: `seedDecision()` is asserted as documentation of an old rule, never
 *    as behaviour of the running system. A test that quietly certifies dead code is
 *    worse than no test, because it looks like coverage.
 *
 * The hazard was quiet and total: `SEED_ON_BOOT` defaulted to `auto`, which
 * means "seed if the database looks empty" - and a brand new production
 * database is exactly that. A first ordinary boot would run the demo fixtures,
 * whose seller, shopper, manufacturer and partner accounts have fixed
 * passwords published in LOGINS.md, and the seed deletes the collections it
 * owns before writing. Nothing would have looked broken: the site would have
 * simply come up full of demo data and demo logins.
 *
 * This cannot be tested end to end without booting the API against a database,
 * which is slow and would need two environments. The decision is therefore a
 * pure function, and every case is asserted directly - including that
 * production `auto` refuses even when the row count is zero, which is the exact
 * condition the old ladder treated as licence.
 *
 *   node scripts/seed_guard_unit.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedDecision, productionBootErrors } from '../server/config/authMode.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail)}` : ''}`);
  return ok;
};

// Historical development behaviour. verify.mjs does NOT rely on this any more;
// it applies fixtures itself before the API starts. Asserted so the table below is
// known-good as a record, not as a runtime guarantee.
check(
  'historical: development auto seeded an empty database (no longer reachable from boot)',
  seedDecision({ flag: 'auto', existing: 0, production: false }).seed === true
);
check(
  'development auto skips a populated database',
  seedDecision({ flag: 'auto', existing: 12, production: false }).seed === false
);
check(
  'historical: development true forced a seed',
  seedDecision({ flag: 'true', existing: 99, production: false }).seed === true
);

// the production cases that used to be the hole
const prodAutoEmpty = seedDecision({ flag: 'auto', existing: 0, production: true });
check(
  'production auto NEVER seeds, even with zero rows - the fresh-database case',
  prodAutoEmpty.seed === false && prodAutoEmpty.reason === 'production-never-auto-seeds',
  JSON.stringify(prodAutoEmpty)
);
check(
  'the default flag value is the dangerous one and is still refused',
  seedDecision({ existing: 0, production: true }).seed === false,
  'flag omitted => auto'
);
check(
  'production auto is refused on a partly-populated database too',
  seedDecision({ flag: 'auto', existing: 5, production: true }).seed === false
);

// explicit staging acknowledgement, both flags required
check(
  'production true without acknowledgement is refused',
  seedDecision({ flag: 'true', production: true, allowDemoSeed: false }).seed === false
);
const acked = seedDecision({ flag: 'true', production: true, allowDemoSeed: true });
check(
  'production true + ALLOW_DEMO_SEED seeds and is marked destructive',
  acked.seed === true && acked.destructive === true && acked.reason === 'production-staging-acknowledged',
  JSON.stringify(acked)
);
check(
  'ALLOW_DEMO_SEED alone does not enable auto-seeding in production',
  seedDecision({ flag: 'auto', existing: 0, production: true, allowDemoSeed: true }).seed === false
);

check(
  'an explicit false beats every other setting',
  seedDecision({ flag: 'false', existing: 0, production: false }).seed === false &&
    seedDecision({ flag: '0', existing: 0, production: true, allowDemoSeed: true }).seed === false
);
check(
  'reasons are stable strings, because they are what the boot log tells the operator',
  typeof seedDecision({ flag: 'auto', existing: 0, production: false }).reason === 'string' &&
    seedDecision({ flag: 'false', production: false }).reason === 'disabled-by-flag'
);

// boot-error message: must name the second flag, or the refusal is a dead end
const prevEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'unit-test-secret-value-long-enough-0123456789';
process.env.SMTP_HOST = 'smtp.example.test';
process.env.SMTP_USER = 'ops@example.test';
process.env.SMTP_PASS = 'secret';
try {
  const refused = productionBootErrors({ seedForced: true, seedAcknowledged: false });
  check(
    'production boot error explains both flags rather than just saying no',
    refused.some((e) => /SEED_ON_BOOT=true/.test(e) && /ALLOW_DEMO_SEED=true/.test(e)),
    String(refused[0] || '').slice(0, 120)
  );
  check(
    'an acknowledged staging seed no longer blocks the boot',
    !productionBootErrors({ seedForced: true, seedAcknowledged: true }).some((e) => /SEED_ON_BOOT/.test(e))
  );
  check(
    'production still refuses an unacknowledged forced seed',
    productionBootErrors({ seedForced: true }).some((e) => /SEED_ON_BOOT/.test(e))
  );
} finally {
  process.env.NODE_ENV = prevEnv;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
}

/* ── what is actually true now (the reason this file still earns CI time) ── */
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const serverSrc = fs.default.readFileSync(path.default.join(ROOT, 'server', 'server.js'), 'utf8');
  check(
    'the application does not import the demo dataset',
    !/seed\.js|writeDemoData|applyDemoFixtures/.test(serverSrc)
  );
  check(
    'boot-time seeding is gone from the config table in authMode',
    /@deprecated the app never seeds/.test(
      fs.default.readFileSync(path.default.join(ROOT, 'server', 'config', 'authMode.js'), 'utf8')
    )
  );
  check(
    'SEED_ON_BOOT is reported as inert rather than silently ignored',
    /SEED_ON_BOOT is set but no longer has any effect/.test(serverSrc)
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} seed-guard checks passed`);
process.exitCode = failed.length ? 1 : 0;
