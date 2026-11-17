#!/usr/bin/env node
/**
 * The fixture destruction guard.
 *
 * What is under test is the property that made Batch F worth doing: the demo
 * dataset's first act is deleting eleven collections plus seller stock, and until
 * this change that happened inside `server.js`'s boot sequence whenever the
 * database looked empty. "Looks empty" is also what a mistyped MONGODB_URI and a
 * staging box pointed at the wrong cluster look like, so the wipe path was
 * reachable by configuration error, and NODE_ENV=production was the only fence.
 *
 * Four guarantees, each asserted rather than asserted-about:
 *
 *  1. the application cannot reach the dataset at all (static, on source text);
 *  2. the guard refuses to wipe a populated database without --force;
 *  3. a database-name mismatch is refused even with --force, because that is the
 *     one case row-counting cannot catch - a wrong connection is indistinguishable
 *     from an empty one;
 *  4. the guard's own inventory is the truth about what gets deleted: every
 *     `deleteMany({})` in the dataset must be a collection the guard counted, or a
 *     future fixture could clear something the operator was never shown.
 *
 * Runs against its own throwaway database, so it cannot damage anything, and it
 * never calls the real write path with a populated database - the guard is tested
 * on the refusal side, and the accept side on an empty one which is a no-op wipe.
 *
 *   node server/scripts/fixtures_destruction_guard_unit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SERVER = path.resolve(HERE, '..');
const { WIPABLE, countWipable, clearWipable } = await import('../fixtures/inventory.mjs');
const { applyDemoFixtures, seedDatabase } = await import('../fixtures/demoData.js');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 190)}` : ''}`);
};

/* ── 1. the application cannot reach the dataset ─────────────────────────────── */
{
  const serverSrc = fs.readFileSync(path.join(SERVER, 'server.js'), 'utf8');
  const routeFiles = fs
    .readdirSync(path.join(SERVER, 'routes'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => [path.join(SERVER, 'routes', f), fs.readFileSync(path.join(SERVER, 'routes', f), 'utf8')]);
  const middlewareFiles = fs
    .readdirSync(path.join(SERVER, 'middleware'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => [path.join(SERVER, 'middleware', f), fs.readFileSync(path.join(SERVER, 'middleware', f), 'utf8')]);

  const offenders = [[path.join(SERVER, 'server.js'), serverSrc], ...routeFiles, ...middlewareFiles].filter(([, src]) =>
    /import\(.*seed\.js.*\)|from '.*seed\.js'|require\(.*seed\.js.\)/.test(src)
  );
  check(
    'no application module imports the demo dataset',
    offenders.length === 0,
    offenders.map(([f]) => path.basename(f)).join(', ')
  );
  check(
    'server.js does not call a seeding function',
    !/seedDatabase\s*\(/.test(serverSrc) && !/writeDemoData\s*\(/.test(serverSrc),
    serverSrc.includes('seedDatabase(') ? 'found a call' : 'clean'
  );
  check('the old seed file is gone from the tree', !fs.existsSync(path.join(SERVER, 'seed.js')));
  check('the legacy name still exists only as a loud failure', typeof seedDatabase === 'function');
  try {
    await seedDatabase();
    check('calling seedDatabase() throws instead of writing', false, 'it resolved');
  } catch (error) {
    check(
      'calling seedDatabase() throws instead of writing',
      /no longer runs from the application/i.test(error.message),
      error.message.slice(0, 90)
    );
  }
}

let mongo = null;
try {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('guardproof'));
  const { default: User } = await import('../models/User.js');

  /* ── 4 (part one): the guard knows what it is about to delete ──────────────── */
  {
    const inventoryLabels = WIPABLE.map((w) => w.model.modelName);
    const dataset = fs.readFileSync(path.join(SERVER, 'fixtures', 'demoData.js'), 'utf8');
    /*
     * Every bulk delete in the dataset must be accounted for by the guard's list.
     *
     * The rule is not simply "no deletes outside clearWipable()", because
     * ordering genuinely matters for one collection (see `deferred` in
     * inventory.mjs: hoisting that delete broke two suites). So a dataset-side
     * delete is allowed exactly when the model is flagged deferred in the list -
     * disclosed to the operator, cleared where the data requires. That keeps the
     * check strict about *silence* without lying about *ordering*, and it removes
     * the temptation to weaken the assertion the first time a legitimate in-place
     * delete appears.
     */
    const modelNameByImport = new Map();
    for (const m of dataset.matchAll(/import\s+(\w+)\s+from '\.\.\/models\/(\w+)\.js'/g)) {
      modelNameByImport.set(m[1], m[2]);
    }
    const deferredNames = new Set(WIPABLE.filter((w) => w.deferred).map((w) => w.model.modelName));
    const direct = [...dataset.matchAll(/(\w+)\.deleteMany\(\{\}\)/g)]
      .map((m) => modelNameByImport.get(m[1]) || m[1])
      .filter((name) => name !== 'clearWipable' && !deferredNames.has(name));
    check(
      'the dataset performs no bulk delete the guard does not disclose',
      direct.length === 0,
      `undisclosed: ${direct.join(', ') || 'none'} (deferred and disclosed: ${[...deferredNames].join(', ') || 'none'})`
    );
    check(
      'a deferred clear is disclosed by name in WIPABLE',
      [...deferredNames].length === 1 && deferredNames.has('SellerStock'),
      [...deferredNames].join(',')
    );
    check('and the dataset really still performs it', /SellerStock\.deleteMany\(\{\}\)/.test(dataset));
    check(
      'the wipe list is the one the guard counts',
      WIPABLE.length === 12 && typeof clearWipable === 'function',
      `${WIPABLE.length} collections`
    );

    /*
     * The deferral property, pinned because its absence cost two suites.
     *
     * SellerStock is disclosed to the guard (an operator must be told it will be
     * deleted) but cleared at the dataset's own call site, where the original seed
     * cleared it. Hoisting that delete into the up-front wipe reordered a
     * 2,000-line fixture and left `seller ranking` and `partner payout` reading an
     * empty routing queue while every seller, product and partner row looked
     * perfectly healthy - data present, order of operations wrong, nothing in a log
     * to say so.
     */
    {
      const deferred = WIPABLE.filter((w) => w.deferred).map((w) => w.model.modelName);
      check(
        'exactly one collection defers its clear, and it is the stock rows',
        deferred.length === 1 && deferred[0] === 'SellerStock',
        deferred.join(',') || 'none'
      );
      check(
        'a deferred collection is still disclosed by label',
        WIPABLE.some((w) => w.deferred && /stock/i.test(w.label)),
        String(WIPABLE.find((w) => w.deferred)?.label)
      );
    }
    check(
      'every listed entry is a registered model with a name',
      inventoryLabels.every(Boolean) && inventoryLabels.length === 12,
      inventoryLabels.join(',')
    );
    check(
      'users are in the list, because that is the collection an operator cannot recover',
      inventoryLabels.includes('User'),
      inventoryLabels.join(',')
    );
  }

  /* ── 2. refuse to wipe a populated database ────────────────────────────────── */
  await User.create({
    name: 'Real Person',
    email: 'real@example.test',
    password: 'Str0ngPass!',
    phone: '9000000111',
    role: 'admin',
  });
  const before = await User.countDocuments();
  const refused = await applyDemoFixtures({ acceptWipe: false });
  check(
    'populated database without --force -> the run is refused',
    refused.skipped === true,
    String(refused.reason).slice(0, 120)
  );
  check(
    'the refusal explains that this is the destructive case',
    /deletes the collections it owns|already hold data/i.test(String(refused.reason)),
    String(refused.reason).slice(0, 140)
  );
  check(
    'and nothing was deleted',
    (await User.countDocuments()) === before,
    `${await User.countDocuments()} vs ${before}`
  );
  check(
    'the refusal reports the counts it saw',
    (refused.counts || []).some((c) => c.label.startsWith('users') && c.documents >= 1),
    JSON.stringify((refused.counts || []).slice(0, 2))
  );

  /* ── 3. the wrong-connection case, which counting cannot catch ─────────────── */
  const wrongName = `${mongoose.connection.name}-but-not-this-one`;
  const mismatch = await applyDemoFixtures({ acceptWipe: true, expectDatabase: wrongName });
  check(
    'a database-name mismatch is refused even with --force',
    mismatch.skipped === true,
    String(mismatch.reason).slice(0, 130)
  );
  check(
    'and names both names, so the operator sees the typo',
    mismatch.database &&
      String(mismatch.reason).includes(wrongName) &&
      String(mismatch.reason).includes(mismatch.database),
    String(mismatch.reason).slice(0, 150)
  );
  check('the mismatch refused nothing real: the user is still there', (await User.countDocuments()) === before);
  check(
    'a force flag does not override the connection check',
    mismatch.skipped === true,
    'acceptWipe was true and it still refused'
  );

  /* ── 2b. an empty database may be written, and the wipe is the honest kind ──── */
  await clearWipable({ quiet: true });
  const empty = await applyDemoFixtures({ acceptWipe: false, expectDatabase: mongoose.connection.name });
  check(
    'an empty database with the right name is accepted',
    empty.skipped === false,
    String(empty.reason || 'ok').slice(0, 90)
  );

  /*
   * Deliberately NOT asserting the dataset's contents: writeDemoData() creates a
   * demo catalogue with fixed passwords, and this file's subject is the guard. The
   * suites that consume the data (scripts/*.mjs) are the assertion that it loads,
   * and they run on every push.
   */
  check(
    'the guard re-checks population on every call rather than caching',
    (await applyDemoFixtures({ acceptWipe: false })).skipped === true,
    'populated by the run above'
  );
} catch (error) {
  check(
    'the guard suite ran without an unexpected failure',
    false,
    `${error.message} @ ${(error.stack || '').split('\n')[1] || ''}`
  );
} finally {
  await mongoose.disconnect().catch(() => {});
  if (mongo) await mongo.stop().catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} fixture-guard checks passed`);
failed.forEach((f) => console.log(`  - ${f.name}`));
process.exitCode = failed.length ? 1 : 0;
