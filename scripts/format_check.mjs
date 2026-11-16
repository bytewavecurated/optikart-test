#!/usr/bin/env node
/**
 * Formatting gate.
 *
 * A style rule nobody enforces is a suggestion, and this codebase has hand-tuned
 * comment blocks that explain decisions - which is exactly the content that gets
 * mangled when someone runs an editor with different settings on save. So the
 * same glob list is formatted locally and checked in CI, using the prettier that
 * lives in server/package.json (CI already installs there, which is why there is
 * no second lockfile at the repository root).
 *
 * Generated output is not formatted. `server/build` is served from disk by the
 * API, so churning thousands of minified lines would hide every real diff.
 *
 *   node scripts/format_check.mjs [--write]
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'server', 'node_modules', 'prettier', 'bin', 'prettier.cjs');
/*
 * Every pattern here must match at least one tracked file, or prettier exits
 * with "No files matching the pattern were found" and the gate reports a style
 * failure that is really a stale path. Patterns are filtered against the tree
 * below so the list can drift as directories are renamed without breaking CI.
 */
const TARGETS = [
  'client/src/**/*.{js,jsx}',
  'server/**/*.js',
  'server/**/*.mjs',
  'server/scripts/**/*.{js,mjs}',
  'scripts/**/*.mjs',
  '*.md',
];

if (!fs.existsSync(BIN)) {
  /*
   * This fails rather than skipping. prettier is a declared devDependency of
   * server, and CI installs there, so a missing binary means a broken install -
   * and a gate that reports SKIP when its own tooling is absent is a gate that
   * quietly stops existing. (We have been burned by exactly that shape.)
   */
  console.log('FAIL  prettier is not installed. The formatting gate is mandatory; run: npm install --prefix server');
  process.exit(1);
}

const mode = process.argv.includes('--write') ? 'write' : 'check';
/*
 * `--list-different` rather than `--check`: check writes its warnings to stderr
 * in whatever chunk boundaries the stream happens to produce, so counting lines
 * that start with "[warn]" reported two offenders when there was one. Listing
 * names one path per line on stdout, which is both countable and readable.
 */
const args = [mode === 'write' ? '--write' : '--list-different', ...TARGETS];
const out = [];
const err = [];
const child = spawn(process.execPath, [BIN, ...args], { cwd: ROOT });
child.stdout.on('data', (b) => {
  out.push(b.toString());
  process.stdout.write(b);
});
child.stderr.on('data', (b) => {
  err.push(b.toString());
  process.stderr.write(b);
});
child.on('close', (code) => {
  if (mode === 'write') {
    console.log(code === 0 ? 'formatted the authored source tree' : 'formatting pass reported errors');
    process.exitCode = code;
    return;
  }
  const files = [
    ...new Set(
      out
        .join('')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    ),
  ];
  if (code === 0) {
    console.log(`prettier clean across ${TARGETS.length} glob patterns (nothing to reformat)`);
  } else if (err.join('').includes('No files matching')) {
    console.log("FAIL  a formatting target matches no files - fix the glob list, don't widen the ignore file");
  } else {
    /*
     * Print the remedy, not just the complaint: half the value of a gate is that
     * a contributor can fix it without asking what the bot wants.
     */
    console.log(`${files.length} file(s) need formatting - run: node scripts/format_check.mjs --write`);
    files.slice(0, 15).forEach((f) => console.log(`  - ${f}`));
  }
  process.exitCode = code;
});
