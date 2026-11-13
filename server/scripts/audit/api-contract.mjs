#!/usr/bin/env node
/**
 * Contract check between the client and the API.
 *
 * A page that calls a route which does not exist fails in one predictable way:
 * the server answers 404 "API route not found", the client catches it, and the
 * operator sees an empty list or a generic "failed to load" with no hint that the
 * path was simply wrong. Several bugs in this project were exactly that shape,
 * and a green build cannot see them because both halves are valid JavaScript.
 *
 * This resolves every client call against the mounted routers - using the
 * actual import graph, not name guessing - and reports the calls that cannot be
 * answered. No database, browser or running server required.
 *
 *   node scripts/audit/api-contract.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Lives in server/scripts/audit/
const SERVER = path.resolve(here, '..', '..');
const CLIENT = path.resolve(SERVER, '..', 'client', 'src');

const VERBS = { get: 'GET', post: 'POST', put: 'PUT', delete: 'DELETE', patch: 'PATCH' };

const listFiles = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, out);
    else if (/\.jsx?$/.test(entry.name)) out.push(full);
  }
  return out;
};

/* ------------------------------------------------------------------ server */
const serverSource = fs.readFileSync(path.join(SERVER, 'server.js'), 'utf8');

// identifier -> the route file it actually imports
const importToFile = new Map();
for (const m of serverSource.matchAll(/import\s+(\w+)\s+from\s+['"]\.\/routes\/([\w.]+)['"]/g)) {
  importToFile.set(m[1], `routes/${m[2]}`);
}

// mount base -> identifier
const mounts = [];
// The base may have more than one segment ('/api/admin/auth'), which the
// single-segment version of this pattern silently dropped - so those mounts
// looked like they did not exist and their routes were reported unreachable.
for (const m of serverSource.matchAll(/app\.use\(\s*'(\/api\/[a-z0-9\/-]+)'\s*,\s*(\w+)\s*\)/gi)) {
  mounts.push({ base: m[1].replace(/^\/api\//, ''), identifier: m[2] });
}

/**
 * A route path becomes a matcher over the remaining segments. Parameters and a
 * trailing '*' accept anything, and the leading slash is normalised away so
 * '/products/:id' still matches a call to '/products/68ab...'.
 */
const toMatcher = (routePath) => {
  const parts = routePath.split('?')[0].replace(/^\/+/, '').split('/').filter(Boolean);
  return (rest) => {
    const call = String(rest || '').split('?')[0].replace(/^\/+/, '').split('/').filter(Boolean);
    if (parts.length && parts[parts.length - 1] === '*') {
      const head = parts.slice(0, -1);
      return call.length >= head.length && head.every((seg, i) => seg.startsWith(':') || seg === call[i]);
    }
    if (call.length !== parts.length) return false;
    return parts.every((seg, i) => seg.startsWith(':') || seg === call[i]);
  };
};

const registry = [];
for (const file of listFiles(path.join(SERVER, 'routes'))) {
  const relative = `${path.basename(path.dirname(file))}/${path.basename(file)}`;
  const text = fs.readFileSync(file, 'utf8');
  for (const mount of mounts) {
    if (importToFile.get(mount.identifier) !== relative) continue;
    for (const m of text.matchAll(/router\.(get|post|put|delete|patch)\(\s*(['"`])([^'"`]+)\2/g)) {
      registry.push({
        method: VERBS[m[1]],
        base: mount.base,
        path: m[3],
        match: toMatcher(m[3]),
        where: relative
      });
    }
  }
}

/* ------------------------------------------------------------------ client */
const calls = [];
for (const file of listFiles(CLIENT)) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(path.resolve(SERVER, '..'), file);
  for (const m of text.matchAll(/\.(get|post|put|delete|patch)\(\s*(['"`])((?:[^'"`\\]|\\.)*)\2/g)) {
    let raw = m[3];
    if (!raw.startsWith('/')) continue;                     // relative to an axios baseURL
    if (/\.(js|css|svg|png|json|html)/.test(raw) || raw.startsWith('/uploads')) continue;
    raw = raw.replace(/^\/api\//, '').replace(/^\/+/, '');
    raw = raw.replace(/\$\{[^}]*\}/g, ':x');                // template interpolation = a parameter
    calls.push({
      method: VERBS[m[1]],
      target: raw,
      file: rel,
      line: text.slice(0, m.index).split('\n').length
    });
  }
}

/* ------------------------------------------------------------------ resolve */
const problems = [];
for (const call of calls) {
  const atSamePath = registry.filter((r) => call.target === r.base
    || (call.target.startsWith(`${r.base}/`) && r.match(call.target.slice(r.base.length)))
    || (call.target === r.base && r.match('')));
  if (!atSamePath.length) {
    problems.push({ ...call, kind: 'no route at this path' });
  } else if (!atSamePath.some((r) => r.method === call.method)) {
    problems.push({ ...call, kind: `route exists but for ${atSamePath.map((r) => r.method).join('/')}` });
  }
}

// Static pages and health are served by server.js directly.
const noise = /^(health|sitemap\.xml|robots\.txt)/;
const real = problems.filter((p) => !noise.test(p.target));

console.log(`routes registered: ${registry.length} | client calls: ${calls.length} | unresolved: ${real.length}`);
if (real.length) {
  console.log('');
  for (const p of real) console.log(`  ${p.method} ${p.target}  ->  ${p.file}:${p.line}  (${p.kind})`);
  console.log('\nEach of these is a control that cannot work: the server has nothing to answer');
  console.log('it, whatever the button, form or dashboard then chooses to say.');
  process.exitCode = 1;
}
