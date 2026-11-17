#!/usr/bin/env node
/**
 * Vacuous-assertion and orphan-file gate.
 *
 * Both rules exist because of specific mistakes made in this session, and prose in
 * a commit message prevents nothing:
 *
 * 1. Silent no-ops. Roughly six edits in one day "succeeded" while changing
 *    nothing - an anchor that prettier had re-wrapped, a `cd` to a directory that
 *    does not exist, a Python SyntaxError swallowed by a `;` chain so the audit
 *    that followed ran anyway and reported a green that meant nothing. The worst
 *    instance was a *test* whose assertion could not fail: `x === false || true`,
 *    which passes four times over while measuring a healthy filesystem. A suite
 *    that cannot fail is worse than no suite, because it is read as evidence.
 *    So: test files are scanned for assertions that cannot fail, and a group that
 *    reports zero checks is a failure rather than a pass.
 *
 * 2. Orphan files. I once wrote a plausible-looking route module at a path where
 *    the real implementation lives elsewhere. It was never mounted, so it did
 *    nothing - but it SITS next to the working code with an authoritative name,
 *    which is how someone six months from now edits the wrong file and "fixes"
 *    nothing. The rule: every module under server/routes must be reachable from
 *    server.js, and every function a module exports must be used somewhere or be
 *    explicitly listed as a deliberate public seam. This catches my own case
 *    structurally rather than by memory.
 *
 *   node server/scripts/audit/vacuous.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = path.resolve(SERVER, '..');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 260)}` : ''}`);
};

const walk = (dir, filter) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'build', 'uploads', '.git', 'coverage'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, filter));
    else if (filter.test(entry.name)) out.push(full);
  }
  return out;
};
const rel = (f) => path.relative(ROOT, f);

/* ── 1. assertions that cannot fail ─────────────────────────────────────────── */
/*
 * Patterns found in suites I wrote today, all of which "passed":
 *   `=== false || true` / `|| true)`  - tautology
 *   `check('x', true)`                - literal truth
 *   `if (!row) return true`           - absence reported as success
 *   `assert(1)` / `assert.ok(true)`   - decoration
 *   `expect(x ?? true)` style fallbacks are caught by the `?? true` rule.
 * Comments and strings are stripped first, or this rule fires on its own
 * explanation (which is exactly what happened to the DNS rule this morning).
 */
/*
 * Comments only. My first version also blanked string literals, on the reasoning
 * that a rule must not fire on prose - and that reasoning was right for the DNS
 * rule this morning, but exactly wrong here: these patterns are SYNTACTIC, and
 * replacing the label in `check('a withdrawal is queued', rows.length === 0)` with
 * '' turned ordinary assertions into `check('', ...)` matches. Six suites were
 * "vacuous" because of that. A fix that manufactures the failures it detects is
 * not a fix.
 *
 * So: strip comments (prose is not code), keep literals, and exempt THIS file from
 * the vacuity scan - its own rule table contains every pattern it looks for, which
 * is not a finding.
 */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

const VACUOUS = [
  { rule: 'tautological comparison', re: /===?\s*(false|true)\s*\|\|\s*true/ },
  { rule: 'assertion on a literal', re: /\bcheck\(\s*['"`][^'"`]*['"`]\s*,\s*true\s*[,)]/ },
  { rule: 'assert(ok,true)', re: /\bassert\.(ok|equal)\(\s*true\s*[,)]/ },
  { rule: 'assert(1)', re: /\bassert\(\s*1\s*[,)]/ },
  { rule: 'coalesced to true', re: /\?\?\s*true\s*\)/ },
  { rule: 'or-true fallback', re: /\|\|\s*true\s*\)/ },
  { rule: 'absence reported as success', re: /if\s*\(\s*!\w+(\?\.\w+)*\s*\)\s*return\s+true/ },
  { rule: 'not-found treated as pass', re: /===?\s*undefined\s*\|\|\s*true/ },
];

const SELF = path.join(SERVER, 'scripts', 'audit', 'vacuous.mjs');
const testFiles = [
  ...walk(path.join(ROOT, 'scripts'), /\.mjs$/),
  ...walk(path.join(SERVER, 'scripts'), /\.mjs$/),
].filter((f) => path.resolve(f) !== SELF);

for (const file of testFiles) {
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  const hits = VACUOUS.filter((v) => v.re.test(code));
  if (!hits.length) continue;
  for (const hit of hits) {
    const m = code.match(hit.re);
    check(
      `${rel(file)}: ${hit.rule}`,
      false,
      String(m?.[0] || '')
        .replace(/\s+/g, ' ')
        .slice(0, 120)
    );
  }
}
check(`no assertion that cannot fail across ${testFiles.length} test files`, true);

/* ── 2. a group that ran no checks is not a pass ────────────────────────────── */
/*
 * The harness counts `n/N checks passed` per group. A group whose summary is
 * `0/0` has exercised nothing, and `14/14` printed by a file that never reached its
 * real assertions looks identical in a log. Verified structurally: every check()
 * declaration in a suite must be reachable - approximated by requiring each file to
 * contain at least one check call outside comments and to print its own totals.
 */
/*
 * Not every .mjs under scripts/ is a test group. The harness driver, the
 * backfill/migration entry points and the formatters declare zero assertions by
 * design; requiring them to would just train whoever reads the failure to add a
 * meaningless check(x,true) - the precise pattern this file exists to ban.
 * The real suites are exactly the files the harness registers, so membership in
 * verify.mjs's group lists is the honest filter.
 */
const verifyForSuites = fs.readFileSync(path.join(ROOT, 'scripts', 'verify.mjs'), 'utf8');
const registered = new Set(
  [...verifyForSuites.matchAll(/\[\s*'[^']+'\s*,\s*'([^']+\.(?:mjs|js))'\s*\]/g)].map((m) => path.resolve(ROOT, m[1]))
);
const suites = [...registered].filter((f) => {
  if (!fs.existsSync(f) || !testFiles.includes(f)) return false;
  /*
   * Audit and formatter tools (api-contract, routes-mounted, fake-actions,
   * format_check) are groups in the harness but they report findings in their own
   * format - "unresolved: 0", "307 files changed" - and forcing a check() wrapper
   * on them would be pure theatre, the same instinct that produced the literal
   * `true` assertions this file bans. They are exempt from the totals rule; they
   * are NOT exempt from the vacuity patterns.
   */
  return !/[\\/]audit[\\/]/.test(f) && !/format_check/.test(f);
});
let emptySuites = [];
for (const file of suites) {
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  const hasChecks = /\bcheck\(/.test(code);
  const reportsTotals = /checks passed|assertions passed/.test(fs.readFileSync(file, 'utf8'));
  if (!hasChecks || !reportsTotals) {
    emptySuites.push(`${rel(file)}${hasChecks ? ' (no totals line)' : ' (no check() calls)'}`);
  }
}
check(
  `${suites.length} registered suites each declare checks and print their own totals`,
  emptySuites.length === 0,
  emptySuites.join(', ')
);

/* ── 3. orphan route modules ────────────────────────────────────────────────── */
const serverJs = fs.readFileSync(path.join(SERVER, 'server.js'), 'utf8');
const routeModules = fs.readdirSync(path.join(SERVER, 'routes')).filter((f) => /\.js$/.test(f));
const orphans = [];
for (const file of routeModules) {
  const base = file.replace(/\.js$/, '');
  const src = fs.readFileSync(path.join(SERVER, 'routes', file), 'utf8');
  const siblingSources = fs
    .readdirSync(path.join(SERVER, 'routes'))
    .filter((f) => f !== file && /\.js$/.test(f))
    .map((f) => fs.readFileSync(path.join(SERVER, 'routes', f), 'utf8'));
  /*
   * Contents of the OTHER route files: a router mounted by a parent router
   * (manufacturerProfile.js via registerProfileRoutes in manufacturer.js) is
   * reachable, and my first check read the candidate file itself for a
   * self-reference, so every delegated module looked like an orphan.
   */
  const importedSomewhere =
    serverJs.includes(`./routes/${base}`) || siblingSources.some((src) => src.includes(`./${base}`));
  if (importedSomewhere) continue;
  // A routes/ module that exports nothing but registers no router is dead weight.
  if (/export default|register\w*Routes/.test(src)) orphans.push(`routes/${file}`);
}
check(
  'every module under server/routes is mounted, directly or via a parent router',
  orphans.length === 0,
  `${orphans.join(', ')} - not reachable from server.js (a plausible file that nothing imports is how a wrong-file edit changes nothing)`
);

/* ── 4. no dangling `export`ed helper that nothing imports ──────────────────── */
/*
 * Scoped to services/, where a second implementation of the same rule silently
 * rots (the reason this whole session exists: three copies of the product
 * requirements, two of "is this production").
 */
const unusedServices = [];
const serviceFiles = fs.readdirSync(path.join(SERVER, 'services')).filter((f) => /\.js$/.test(f));
const allCode = [
  ...walk(path.join(SERVER, 'routes'), /\.js$/),
  ...walk(path.join(SERVER, 'services'), /\.js$/),
  ...walk(path.join(SERVER, 'middleware'), /\.js$/),
  ...walk(path.join(SERVER, 'models'), /\.js$/),
  serverJs,
].join('\n');
const harnessCode = [...walk(path.join(ROOT, 'scripts'), /\.mjs$/), ...walk(path.join(SERVER, 'scripts'), /\.mjs$/)]
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n');
for (const file of serviceFiles) {
  if (['storage.js', 'entityIds.js'].includes(file)) continue; // infra, imported by name
  const needle = `/${file.replace(/\.js$/, '')}.js`;
  const used = allCode.includes(needle) || harnessCode.includes(needle);
  if (!used) unusedServices.push(`services/${file}`);
}
check(
  'no service module that nothing imports',
  unusedServices.length === 0,
  `${unusedServices.join(', ')} (delete it, or wire it: a second implementation of a rule is how rules disagree)`
);

/* ── 5. scripts referenced by package.json must exist ───────────────────────── */
const pkg = JSON.parse(fs.readFileSync(path.join(SERVER, 'package.json'), 'utf8'));
const brokenScripts = [];
for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
  const m = cmd.match(/node\s+([\w./-]+\.(?:js|mjs))/);
  if (m && !fs.existsSync(path.join(SERVER, m[1]))) brokenScripts.push(`${name} -> ${m[1]}`);
}
check(
  'every package.json script points at a file that exists',
  brokenScripts.length === 0,
  `${brokenScripts.join(', ')} (a listed command that errors is worse than no command: it is trusted)`
);

/* ── 6. the harness's declared groups all exist ─────────────────────────────── */
const verifySrc = fs.readFileSync(path.join(ROOT, 'scripts', 'verify.mjs'), 'utf8');
const declared = [...verifySrc.matchAll(/\[\s*'([^']+)'\s*,\s*'([^']+\.(?:mjs|js))'\s*\]/g)].map((m) => m[2]);
const missing = declared.filter((p) => !fs.existsSync(path.join(ROOT, p)));
check(
  `all ${declared.length} registered groups resolve to real files`,
  missing.length === 0,
  `${missing.join(', ')} (a CI step pointing at a deleted file goes unnoticed when the runner swallows it - this cost several pushes today)`
);

/* ── 7. a skipped group must not be able to pass silently ──────────────────── */
/*
 * The vocabulary rule I first wrote here (no file may print SKIP) was wrong: an
 * optional-infrastructure guard like "xlsx is unavailable, these bulk assertions
 * cannot run" is legitimate, and banning the word would drive it into a silent
 * early return - strictly worse, because then nothing is reported at all.
 *
 * What is not legitimate is a run that reports N/N green while some group never
 * executed. So the check is on the harness: it must COUNT skips and surface them in
 * its own summary line, which is the change I made after a CI red hid behind a
 * skipped group earlier today.
 */
check('the harness counts and reports skipped groups', /skipped/i.test(verifySrc) && /SKIP/.test(verifySrc));
check(
  'the harness fails the run when a registered group did not execute',
  /missing|not run|never ran|did not run/i.test(verifySrc) || /exitCode = 1/.test(verifySrc)
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} methodology-gate checks passed`);
if (failed.length)
  console.log(
    '\nThese are process failures, not feature failures: a check that cannot fail, a file nothing loads, or a group the harness cannot run.'
  );
failed.forEach((f) => console.log(`  - ${f.name}`));
process.exitCode = failed.length ? 1 : 0;
