#!/usr/bin/env node
/**
 * One command that answers "is this version actually working?"
 *
 * Before this, checking a change meant starting Mongo and the server by hand,
 * remembering which port each landed on, running five suites one at a time, and
 * hoping nothing was left half-finished. That is exactly how a broken build gets
 * pushed. This script does the whole loop: real database, real server, every
 * suite, both audits, one exit code.
 *
 *   node scripts/verify.mjs              # spins up its own database
 *   MONGODB_URI=mongodb://... node scripts/verify.mjs   # uses an existing one
 *
 * The database URI is read from what the launcher prints rather than assumed to
 * be port 27017. mongo-memory-server asks for 27017 and quietly moves to a
 * random port when something else already holds it - and then a hardcoded URI
 * makes the tests talk to the wrong server, seeding and querying a database
 * nobody is testing.
 */
import { spawn } from 'node:child_process';
import { assertDiskHeadroom } from './verifyDiskGuard.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = path.join(ROOT, '.verify-logs');

const PORT = Number(process.env.VERIFY_PORT || 3111);

const BASE = `http://127.0.0.1:${PORT}`;
const REPORT = () =>
  console.log(
    `harness environment: storage=${HERMETIC.env.STORAGE_BACKEND} | ${HERMETIC.stripped.length} provider credentials stripped from child processes`
  );

const SUITES = [
  ['session lifetime', 'scripts/session_e2e.mjs'],
  ['prescription and stock safety', 'scripts/safety_e2e.mjs'],
  ['catalogue and access control', 'scripts/catalog_access_e2e.mjs'],
  ['delivery dispatch', 'scripts/dispatch_e2e.mjs'],
  ['privilege boundaries on listings', 'scripts/privilege_boundary_e2e.mjs'],
  ['seller ranking', 'scripts/ranking_e2e.mjs'],
  ['partner flow', 'scripts/partner_flow_e2e.mjs'],
  ['brand supply claims', 'scripts/listing_approval_e2e.mjs'],
  ['customer charges', 'scripts/charges_e2e.mjs'],
  ['idle session decision', 'scripts/session_idle_unit.mjs'],
  ['idle sign-out (boots its own server)', 'scripts/session_idle_e2e.mjs'],
  // `scripts/payout_console_e2e.mjs` exists and passes locally, but it cannot
  // run in the aggregate suite as written: it must first EARN the ₹50 minimum,
  // which it does by completing hand-offs that depend on this particular partner
  // still being the one the order went to. On CI the dispatch cascade had already
  // offered some of those orders elsewhere, so only 4 runs completed and the
  // partner had ₹40, which failed the suite for a reason to do with test
  // preparation rather than with the settlement behaviour. The fix is to fund the
  // partner through the offer path the cascade actually used (or ask for a
  // dev-only earnings fixture) - not to loosen the assertion. Until then the file
  // is run by hand and the contract it covers is exercised in OPERATIONS.md.
  ['catalogue facets and upload criteria', 'scripts/catalog_facets_e2e.mjs'],
  ['global search and facet controls', 'scripts/search_facets_e2e.mjs'],
  ['partner payout settlement queue', 'scripts/payout_console_e2e.mjs'],
  ['notification fan-out', 'scripts/notifications_fanout_e2e.mjs'],
  ['delivery distance ceilings', 'scripts/delivery_radii_e2e.mjs'],
  ['manufacturer profile rules', 'scripts/manufacturer_profile_e2e.mjs'],
  ['weekly partner ranking', 'scripts/partner_ranking_e2e.mjs'],
  ['brand registration and logos', 'scripts/brand_logo_e2e.mjs'],
  ['product upload parity', 'scripts/product_upload_parity_e2e.mjs'],
  ['entity codes over http', 'scripts/entity_ids_e2e.mjs'],
  ['otp takeover chain', 'scripts/otp_takeover_chain_e2e.mjs'],
  ['socket auth and room boundaries', 'scripts/socket_membership_e2e.mjs'],
];

// Static checks: no server needed, but they gate the same push.
const AUDITS = [
  /*
   * Registration note for whoever reads a "19 groups" number somewhere in the
   * project history: the seed guard is asserted here because a boot-time hazard
   * that nobody executes in CI is a hazard that silently rots. It is a pure
   * function test, so it costs a second and needs no database.
   */
  ['production seed guard', 'scripts/seed_guard_unit.mjs'],
  ['weekly partner ranking (frozen clock)', 'scripts/partner_ranking_unit.mjs'],
  ['product upload requirements', 'scripts/product_requirements_unit.mjs'],
  ['entity code generation', 'server/scripts/entity_ids_unit.mjs'],
  ['storage guards and asset inventory', 'server/scripts/storage_upload_guards_unit.mjs'],
  ['harness disk guard', 'scripts/disk_headroom_unit.mjs'],
  ['fixture destruction guard', 'server/scripts/fixtures_destruction_guard_unit.mjs'],
  ['security audit gate', 'server/scripts/audit/security.mjs'],
  ['vacuous-assertion and orphan-file gate', 'server/scripts/audit/vacuous.mjs'],
  ['otp delivery gate', 'server/scripts/otp_delivery_gate_unit.mjs'],
  ['client/API contract', 'server/scripts/audit/api-contract.mjs'],
  ['mounted routes', 'server/scripts/audit/routes-mounted.mjs'],
  ['controls that only announce success', 'scripts/audit/fake-actions.mjs'],
  ['source formatting', 'scripts/format_check.mjs'],
  ['brand logos and storage policy', 'scripts/brand_logo_unit.mjs'],
  ['brand model invariants', 'server/scripts/audit/brand_invariants.mjs'],
];

/*
 * Everything the harness spawns gets this environment, and the point of the
 * deletion pass is not tidiness. A developer's `server/.env` carries live-ish
 * CLOUDINARY_* and SMTP_* credentials; with them inherited, a test run uploads
 * real files to a real CDN and attempts real Gmail auth (the `535 BadCredentials`
 * lines in our own server logs were a *test* emailing Google). Provider behaviour
 * then depends on which laptop ran CI, and the CI claim "no external services"
 * becomes false. So: pin the storage backend to the deterministic fallback and
 * strip every third-party credential. JWT_SECRET and MONGODB_URI survive; the
 * development OTP bypass survives because SMTP_* is gone.
 */
const PROVIDER_ENV_PREFIXES = [
  'CLOUDINARY',
  'SMTP',
  'OPENAI',
  'AZURE_',
  'GOOGLE_',
  'RAZORPAY',
  'SHIPROCKET',
  'AWS_',
  'SENTRY',
  'VIRTUAL_TRYON',
  'CHATBOT',
  'FACE_DETECTION',
  'SPEECH_RECOGNITION',
  'ADMIN_EMAIL',
];

const EMPTY_ENV = path.join(os.tmpdir(), `optikart-verify-empty-${process.pid}.env`);
// dotenv reads `path`, not `contents` - an absent file is equivalent to an empty
// one, so the file only has to exist long enough for the child to load it.
fs.writeFileSync(EMPTY_ENV, '# deliberately empty: see the comment above\n');

const hermeticEnv = () => {
  const env = {
    ...process.env,
    STORAGE_BACKEND: 'local',
    ENV_FILE: EMPTY_ENV,
    /*
     * The harness supplies its own signing secret instead of inheriting one.
     * Not cosmetic: with `.env` no longer reachable from a test run, boot
     * legitimately refuses without a secret, and a developer whose shell has
     * none would see the harness die for a reason that looks like a code fault.
     * CI already passes this variable; now the local path is exactly as strict
     * as CI, so neither can drift into "works only because someone's .env did".
     */
    JWT_SECRET: 'optikart-harness-only-secret-not-for-deployment-0123456789',
  };
  const stripped = [];
  for (const key of Object.keys(env)) {
    if (PROVIDER_ENV_PREFIXES.some((p) => key.startsWith(p))) {
      delete env[key];
      stripped.push(key);
    }
  }
  return { env, stripped };
};

const HERMETIC = hermeticEnv();

const logStream = (name) => {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  return fs.createWriteStream(path.join(LOG_DIR, `${name}.log`), { flags: 'w' });
};

const run = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    /*
     * Suites are handed the database URI they cannot otherwise know.
     *
     * One of them has to start its own API process with a shortened idle window,
     * because the timeout cannot be tested by waiting an hour. Without this it
     * would have to guess a port and a connection string, and a suite that guesses
     * is a suite that fails in whichever way the environment happens to differ
     * from the laptop it was written on.
     */
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...HERMETIC.env, MONGODB_URI: mongoUriForSuites || '', VERIFY_PORT: String(PORT) },
      ...opts,
    });
    let tail = '';
    /*
     * Failure detail is kept in FULL, and separately from the routine output.
     *
     * The previous ring buffer kept only the last 4000 characters, so on a group
     * with 21 checks the FAIL line that named the cause could be evicted before the
     * harness printed its summary - and I spent three debugging cycles today
     * reading "FAIL <group>" with no reason attached, guessing at causes the suite
     * had in fact reported. Retaining the failing assertions verbatim is the whole
     * point of running them.
     */
    const failures = [];
    const totals = { passed: 0, ran: 0 };
    /*
     * Line-buffered, because stdout arrives in arbitrary chunks. My first version
     * tested each chunk line-by-line, so a `FAIL  <label>` that happened to split
     * across two chunks matched neither pattern in full and the group reported a
     * bare "FAIL" with no reason at all - which cost me three rounds of guessing at
     * causes the suite had actually printed. Line boundaries are a property of the
     * stream, not of the data, and the harness has to respect them.
     */
    let partial = '';
    const capture = (chunk) => {
      const text = partial + chunk.toString();
      const lines = text.split('\n');
      partial = lines.pop() ?? '';
      tail += text;
      if (tail.length > 24000) tail = tail.slice(-16000);
      for (const line of lines) {
        if (/^FAIL\b/iu.test(line.trim()) || /^\s+-\s/.test(line)) failures.push(line.trimEnd());
        const m = line.match(/(\d+)\/(\d+)\s+.*checks? passed|(\d+)\/(\d+)\s+.*assertions? passed/iu);
        if (m) {
          totals.passed = Number(m[1] ?? m[3]);
          totals.ran = Number(m[2] ?? m[4]);
        }
        // a group that stopped early says so in its own words; keep it visible
        if (/stopped early|CRASHED/iu.test(line)) failures.push(line.trimEnd());
      }
      if (failures.length > 60) failures.splice(0, failures.length - 60);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('exit', (code) => {
      // the tail of the last line never carried a newline; do not lose it
      if (partial) {
        if (/^FAIL\b|stopped early|CRASHED/iu.test(partial.trim())) failures.push(partial.trimEnd());
        tail += partial;
      }
      resolve({ code: code ?? 1, tail, failures, totals });
    });
  });

let mongoUriForSuites = '';
const started = [];
const teardown = () => {
  for (const child of started) {
    try {
      child.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
  /*
   * Remove the isolated database this run created - and only this run's, by
   * exact path. Each one is ~200MB and nothing else deletes them, so repeated
   * verification runs filled the temp filesystem and the failure surfaced as an
   * unrelated-looking extraction error.
   */
  if (ownDbPath && ownDbPath.includes('mongo-mem-')) {
    try {
      fs.rmSync(ownDbPath, { recursive: true, force: true });
      console.log(`removed the isolated database directory (${ownDbPath})`);
    } catch {
      /* a still-held directory is left for the OS temp cleanup */
    }
  }
};

let ownDbPath = '';
process.on('SIGINT', () => {
  teardown();
  process.exit(130);
});

/* ------------------------------------------------------------------ database */
let mongoUri = process.env.MONGODB_URI || '';
let mongoOut = null;
if (!mongoUri) {
  assertDiskHeadroom();
  process.stdout.write('starting an isolated database... ');
  const out = logStream('mongo');
  const child = spawn('node', ['.mongo.mjs'], { cwd: path.join(ROOT, 'server'), stdio: ['ignore', 'pipe', 'pipe'] });
  started.push(child);
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  const dbpathListener = (chunk) => {
    const line = chunk
      .toString()
      .split('\n')
      .find((l) => l.startsWith('MONGO_DBPATH'));
    if (line) ownDbPath = line.split(' ').pop().trim();
  };
  child.stdout.on('data', dbpathListener);
  mongoUri = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('database did not report ready within 120s (see .verify-logs/mongo.log)')),
      120000
    );
    child.stdout.on('data', (chunk) => {
      const line = chunk
        .toString()
        .split('\n')
        .find((l) => l.startsWith('MONGO_READY'));
      if (line) {
        clearTimeout(timer);
        resolve(line.split(' ').pop());
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      /*
       * The launcher dies for one reason far more often than any other: the
       * in-memory database unpacks into the system temp directory, and a
       * sandbox that has been reused accumulates a ~200MB folder per run.
       * Saying "disk space" here beats reading a stack trace.
       */
      reject(
        new Error(
          `database exited with code ${code}. If the log shows a download or extraction failure, check free space in the temp directory (du -sh /tmp/mongo-mem-* after a run; each isolated database leaves one behind while it lives).`
        )
      );
    });
  });
  mongoUriForSuites = mongoUri;
  console.log('ready');
} else {
  mongoUriForSuites = process.env.MONGODB_URI;
  console.log(`using the database already configured: ${process.env.MONGODB_URI}`);
}

/* ------------------------------------------------------------------ fixtures */
/*
 * The test data is created here, by the harness, rather than as a side effect of
 * starting the application.
 *
 * Until now the API booted, noticed the database was empty, and loaded the demo
 * dataset - which begins by deleting the eleven collections it owns. That made
 * every deployment inherit a wipe-capable code path, and NODE_ENV=production was
 * the only thing standing between a staging box (or a mistyped MONGODB_URI, which
 * looks identical to an empty database) and losing real accounts, real products
 * and real orders. The dataset now lives in server/fixtures/ and the app never
 * imports it: an application process cannot clear a collection at all.
 *
 * `--expect-database` is passed so a wrong connection is refused rather than
 * wiped. When the caller supplied MONGODB_URI (CI, or a developer pointing at
 * their own cluster) the database name is taken from that URI, because guessing it
 * would defeat the purpose: `apply.mjs` compares the name it actually connected to.
 */
const databaseNameOf = (uri) => {
  try {
    const u = new URL(uri);
    const name = decodeURIComponent((u.pathname || '').replace(/^\/+/, ''));
    const first = name.split('?')[0].trim();
    return first || null;
  } catch {
    return null;
  }
};

const expectedDatabase = databaseNameOf(mongoUri);
process.stdout.write(`applying demo fixtures${expectedDatabase ? ` to "${expectedDatabase}"` : ''}... `);
/*
 * `run` overwrites cwd/env rather than merging them (see its definition), so both
 * are supplied in full here: the fixtures script lives in server/ and needs the
 * same hermetic environment the API gets, with the URI this run owns.
 */
const fixtures = await run(
  'node',
  ['fixtures/apply.mjs', '--force', ...(expectedDatabase ? ['--expect-database', expectedDatabase] : [])],
  {
    cwd: path.join(ROOT, 'server'),
    env: { ...HERMETIC.env, MONGODB_URI: mongoUri },
  }
);
if (fixtures.code !== 0) {
  console.log('FAILED');
  console.log(`\nthe fixture step could not prepare the test database (exit ${fixtures.code}):\n${fixtures.tail}`);
  teardown();
  process.exitCode = 1;
  process.exit(1);
}
console.log('ready');

/* -------------------------------------------------------------------- server */
REPORT();
process.stdout.write(`starting the API on ${BASE}... `);
const srvOut = logStream('server');
const server = spawn('node', ['server.js'], {
  cwd: path.join(ROOT, 'server'),
  env: {
    ...HERMETIC.env,
    PORT: String(PORT),
    MONGODB_URI: mongoUri,
    NODE_ENV: 'development',
    /*
     * SEED_ON_BOOT is deliberately absent. The application cannot seed any more,
     * so setting it here would only make this file look like it still relies on
     * boot-time data. The fixtures block above is what prepares this database,
     * and if that ever stops running the suites fail loudly rather than quietly
     * asserting against an empty catalogue.
     */
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
started.push(server);
server.stdout.pipe(srvOut);
server.stderr.pipe(srvOut);

const healthy = await (async () => {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) return `exited with code ${server.exitCode}`;
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return 'timed out waiting for /api/health';
})();

if (healthy !== true) {
  console.log('FAILED');
  console.error(`\nthe API never became healthy: ${healthy}`);
  console.error(
    `last server output:\n${fs.readFileSync(path.join(LOG_DIR, 'server.log'), 'utf8').split('\n').slice(-25).join('\n')}`
  );
  teardown();
  process.exit(1);
}
console.log('healthy');

/* ------------------------------------------------------------------- results */
const results = [];
let totalSkipped = 0;
for (const [label, script] of AUDITS) {
  const r = await run('node', [script]);
  results.push({ label, ok: r.code === 0, tail: r.tail, failures: r.failures, totals: r.totals });
}
for (const [label, script] of SUITES) {
  const r = await run('node', [script, BASE]);
  results.push({ label, ok: r.code === 0, tail: r.tail, failures: r.failures, totals: r.totals });
}

teardown();

for (const r of results) {
  console.log(`\n${r.ok ? 'PASS' : 'FAIL'}  ${r.label}`);
  if (!r.ok) {
    /*
     * Every FAIL line the group emitted, in order, without the old keyword filter
     * (which dropped the detail lines that carried the reason). If the ring buffer
     // still overflowed, the count says so rather than presenting a short list as
     // the whole story.
     */
    const lines = (
      r.failures && r.failures.length ? r.failures : r.tail.split('\n').filter((l) => /FAIL/iu.test(l))
    ).slice(-40);
    console.log(lines.join('\n'));
    if (r.totals && r.totals.ran) {
      console.log(`     ${r.totals.passed}/${r.totals.ran} of its own checks passed`);
    }
  } else {
    console.log(r.tail.trim().split('\n').filter(Boolean).pop());
    /*
     * Skipped checks are printed on a passing group, and counted.
     *
     * A suite that SKIPs quietly still reports "all assertions passed", so the
     * harness goes green having measured less than its name suggests - the
     * payout suite does this legitimately (it settles nothing when no withdrawal
     * is queued) but the number of skipped guarantees has to be visible or the
     * coverage claim is decoration. Anything skipped without a documented reason
     * is a bug that is being ignored rather than found.
     */
    const skipped = r.tail.split('\n').filter((l) => /^SKIP/iu.test(l.trim()));
    if (skipped.length) {
      console.log(`     ${skipped.length} check(s) skipped by this group:`);
      for (const line of skipped) console.log(`       ${line.trim()}`);
      totalSkipped += skipped.length;
    }
  }
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks green` +
    (totalSkipped ? ` - with ${totalSkipped} individual check(s) skipped, listed above` : '')
);
if (failed.length) {
  console.log(`logs kept in ${LOG_DIR}`);
  process.exitCode = 1;
}
