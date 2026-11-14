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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = path.join(ROOT, '.verify-logs');

const PORT = Number(process.env.VERIFY_PORT || 3111);
const BASE = `http://127.0.0.1:${PORT}`;

const SUITES = [
  ['session lifetime', 'scripts/session_e2e.mjs'],
  ['prescription and stock safety', 'scripts/safety_e2e.mjs'],
  ['catalogue and access control', 'scripts/catalog_access_e2e.mjs'],
  ['delivery dispatch', 'scripts/dispatch_e2e.mjs'],
  ['seller ranking', 'scripts/ranking_e2e.mjs'],
  ['partner flow', 'scripts/partner_flow_e2e.mjs'],
  ['brand supply claims', 'scripts/listing_approval_e2e.mjs'],
  ['customer charges', 'scripts/charges_e2e.mjs']
];

// Static checks: no server needed, but they gate the same push.
const AUDITS = [
  ['client/API contract', 'server/scripts/audit/api-contract.mjs'],
  ['mounted routes', 'server/scripts/audit/routes-mounted.mjs']
];

const logStream = (name) => {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  return fs.createWriteStream(path.join(LOG_DIR, `${name}.log`), { flags: 'w' });
};

const run = (cmd, args, opts = {}) => new Promise((resolve) => {
  const child = spawn(cmd, args, { cwd: ROOT, ...opts });
  let tail = '';
  const capture = (chunk) => {
    tail += chunk.toString();
    if (tail.length > 8000) tail = tail.slice(-4000);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  child.on('exit', (code) => resolve({ code: code ?? 1, tail }));
});

const started = [];
const teardown = () => {
  for (const child of started) {
    try { child.kill('SIGTERM'); } catch { /* already gone */ }
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
    } catch { /* a still-held directory is left for the OS temp cleanup */ }
  }
};

let ownDbPath = '';
process.on('SIGINT', () => { teardown(); process.exit(130); });

/* ------------------------------------------------------------------ database */
let mongoUri = process.env.MONGODB_URI || '';
let mongoOut = null;
if (!mongoUri) {
  process.stdout.write('starting an isolated database... ');
  const out = logStream('mongo');
  const child = spawn('node', ['.mongo.mjs'], { cwd: path.join(ROOT, 'server'), stdio: ['ignore', 'pipe', 'pipe'] });
  started.push(child);
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  const dbpathListener = (chunk) => {
    const line = chunk.toString().split('\n').find((l) => l.startsWith('MONGO_DBPATH'));
    if (line) ownDbPath = line.split(' ').pop().trim();
  };
  child.stdout.on('data', dbpathListener);
  mongoUri = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('database did not report ready within 120s (see .verify-logs/mongo.log)')), 120000);
    child.stdout.on('data', (chunk) => {
      const line = chunk.toString().split('\n').find((l) => l.startsWith('MONGO_READY'));
      if (line) { clearTimeout(timer); resolve(line.split(' ').pop()); }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      /*
       * The launcher dies for one reason far more often than any other: the
       * in-memory database unpacks into the system temp directory, and a
       * sandbox that has been reused accumulates a ~200MB folder per run.
       * Saying "disk space" here beats reading a stack trace.
       */
      reject(new Error(`database exited with code ${code}. If the log shows a download or extraction failure, check free space in the temp directory (du -sh /tmp/mongo-mem-* after a run; each isolated database leaves one behind while it lives).`));
    });
  });
  console.log('ready');
} else {
  console.log(`using the database already configured: ${process.env.MONGODB_URI}`);
}

/* -------------------------------------------------------------------- server */
process.stdout.write(`starting the API on ${BASE}... `);
const srvOut = logStream('server');
const server = spawn('node', ['server.js'], {
  cwd: path.join(ROOT, 'server'),
  env: {
    ...process.env,
    PORT: String(PORT),
    MONGODB_URI: mongoUri,
    // Seeding here is the point: the suites assert against known accounts.
    // Boot-time seeding is refused when NODE_ENV=production for exactly this
    // reason, so the harness states development explicitly.
    NODE_ENV: 'development',
    SEED_ON_BOOT: 'true'
  },
  stdio: ['ignore', 'pipe', 'pipe']
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
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return 'timed out waiting for /api/health';
})();

if (healthy !== true) {
  console.log('FAILED');
  console.error(`\nthe API never became healthy: ${healthy}`);
  console.error(`last server output:\n${fs.readFileSync(path.join(LOG_DIR, 'server.log'), 'utf8').split('\n').slice(-25).join('\n')}`);
  teardown();
  process.exit(1);
}
console.log('healthy');

/* ------------------------------------------------------------------- results */
const results = [];
for (const [label, script] of AUDITS) {
  const r = await run('node', [script]);
  results.push({ label, ok: r.code === 0, tail: r.tail });
}
for (const [label, script] of SUITES) {
  const r = await run('node', [script, BASE]);
  results.push({ label, ok: r.code === 0, tail: r.tail });
}

teardown();

for (const r of results) {
  console.log(`\n${r.ok ? 'PASS' : 'FAIL'}  ${r.label}`);
  if (!r.ok) console.log(r.tail.split('\n').filter((l) => /FAIL|Error|expected/iu.test(l)).slice(-20).join('\n'));
  else console.log(r.tail.trim().split('\n').filter(Boolean).pop());
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks green`);
if (failed.length) {
  console.log(`logs kept in ${LOG_DIR}`);
  process.exitCode = 1;
}
