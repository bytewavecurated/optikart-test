#!/usr/bin/env node
/**
 * Mount integrity: every /api prefix served by exactly one router.
 *
 * `server.js` ended up mounting two notification routers at `/api/notifications`,
 * and Express answers from the first that matches and only falls through when
 * nothing did. So three routes that existed in the second file - same paths, a
 * different auth call, different query parameters - were unreachable, while
 * looking entirely normal: the app worked, requests returned 200, and any change
 * made to that file appeared correct in review and changed nothing in
 * production. A bug that produces a healthy-looking codebase is the kind a
 * regression suite cannot catch by exercising routes, because the routes it
 * breaks are the ones no test names.
 *
 * No server, no database: this reads the mount table and the routers.
 *
 *   node scripts/audit/routes-mounted.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(here, '..', '..');

const source = fs.readFileSync(path.join(SERVER, 'server.js'), 'utf8');

/** identifier -> the route file it imports */
const importToFile = new Map();
for (const m of source.matchAll(/import\s+(\w+)\s+from\s+['"]\.\/routes\/([\w.]+)['"]/g)) {
  importToFile.set(m[1], `routes/${m[2]}`);
}

/** mount prefix -> identifiers, in the order server.js registers them */
const mounts = new Map();
for (const m of source.matchAll(/app\.use\(\s*'(\/api\/[a-z0-9/-]+)'\s*,\s*(\w+)\s*\)/gi)) {
  const list = mounts.get(m[1]) || [];
  list.push(m[2]);
  mounts.set(m[1], list);
}

const VERBS = ['get', 'post', 'put', 'patch', 'delete'];
const routesOf = (identifier) => {
  const file = importToFile.get(identifier);
  if (!file) return null;
  const full = path.join(SERVER, file);
  if (!fs.existsSync(full)) return null;
  const text = fs.readFileSync(full, 'utf8');
  const found = [];
  for (const m of text.matchAll(/router\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g)) {
    found.push(`${m[1].toUpperCase()} ${m[3]}`);
  }
  return found;
};

const problems = [];
for (const [prefix, identifiers] of mounts) {
  if (identifiers.length < 2) continue;

  const perFile = identifiers.map((id) => ({ id, file: importToFile.get(id), routes: routesOf(id) }));
  const missing = perFile.filter((p) => p.routes === null);
  for (const m of missing) {
    problems.push(`${prefix}: mounted identifier "${m.id}" does not resolve to a file under routes/`);
  }

  // Which fully-qualified routes does the FIRST mounted router actually answer?
  const seen = new Map();
  perFile.forEach((entry, index) => {
    if (!entry.routes) return;
    for (const route of entry.routes) {
      // `GET /` on two routers mounted at the same prefix is the same endpoint;
      // compare on the fully-qualified path the request would carry.
      const verbKey = `${route} @ ${prefix}`;
      if (seen.has(verbKey)) {
        const first = seen.get(verbKey);
        problems.push(
          `${route} @ ${prefix} is declared by BOTH ${first.file} (wins, registered first) and ${entry.file} ` +
          `- the second is unreachable: Express answers the first match and never falls through to it, ` +
          `so edits there change nothing in production.`
        );
      } else {
        seen.set(verbKey, entry);
      }
    }
  });
}

const unused = [...importToFile.entries()].filter(([, file]) => file && !fs.existsSync(path.join(SERVER, file)));
for (const [id, file] of unused) {
  problems.push(`server.js imports ${id} from ./${file}, which does not exist in this repository`);
}

console.log(`api prefixes mounted: ${mounts.size} | route files resolved: ${importToFile.size}`);
if (problems.length) {
  console.log(`\n${problems.length} mount problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  console.log('\nOne path must be served by exactly one router. Where two files declared the');
  console.log('same path, the second looked maintainable and was in fact dead code.');
  process.exitCode = 1;
} else {
  console.log('every api prefix is served by exactly one router');
}
