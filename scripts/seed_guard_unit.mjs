#!/usr/bin/env node
/**
 * The production seed guard, checked as arithmetic.
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
import { seedDecision, productionBootErrors } from '../server/config/authMode.js';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail)}` : ''}`);
  return ok;
};

// development / CI behaviour (what scripts/verify.mjs relies on)
check(
  'development auto seeds an empty database (the suites need seeded logins)',
  seedDecision({ flag: 'auto', existing: 0, production: false }).seed === true
);
check(
  'development auto skips a populated database',
  seedDecision({ flag: 'auto', existing: 12, production: false }).seed === false
);
check('development true forces a seed', seedDecision({ flag: 'true', existing: 99, production: false }).seed === true);

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

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} seed-guard checks passed`);
process.exitCode = failed.length ? 1 : 0;
