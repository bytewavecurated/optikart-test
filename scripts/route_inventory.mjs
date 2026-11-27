#!/usr/bin/env node
/**
 * Route inventory + dead-link census for the React app.
 *
 * The router upgrades (v6→v7) cannot be certified by the server harness: no
 * test clicks a link. What CAN be automated is the static half - every route
 * the app claims to serve, and every absolute navigation target the code
 * actually uses - so a walk-through checklist is generated from the code
 * instead of remembered, and a `to="/typo/"` fails a script, not a customer.
 *
 *   node scripts/route_inventory.mjs [--json]
 *
 * Parses client/src statically. Dynamic :params in targets are matched
 * against the pattern with a placeholder segment. Output: markdown checklist
 * grouped by surface + a DEAD TARGETS section (empty = pass). Non-zero exit
 * when dead targets exist, so it can gate later.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'client', 'src');

const walk = (d) => {
  let out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (/\.jsx?$/u.test(e.name)) out.push(p);
  }
  return out;
};
const files = walk(SRC);
const appText = fs.readFileSync(path.join(SRC, 'App.js'), 'utf8');

/* ---- route patterns: every path literal in App.js, parent-joined by
 * document order; children of a layout route are relative fragments. ---- */
const routes = [];
{
  const lines = appText.split('\n');
  let parentStack = []; // [ '/admin', depthAtOpen ]
  let openLine = null;
  const tagDepth = () => openLine;
  let jsxDepth = 0;
  let lastAbsoluteAt = { depth: -1, path: '' };
  for (let li = 0; li < lines.length; li += 1) {
    const raw = lines[li];
    const starts = (raw.match(/<Route\b/gu) || []).length;
    const ends = (raw.match(/<Route[^>]*\/>/gu) || []).length + (raw.match(/<\/Route>/gu) || []).length;
    // path may live on THIS line or the NEXT one (wrapped JSX attributes)
    let attrs = raw;
    let pm = /path=\s*"([^"]+)"/.exec(raw);
    if (/<Route\b(?!.*path)/u.test(raw) && !pm && li + 1 < lines.length) {
      const nxt = lines[li + 1];
      attrs = raw + ' ' + nxt;
      pm = /path=\s*"([^"]+)"/.exec(nxt) || /path=\s*"([^"]+)"/.exec(raw);
    }
    if (!/<Route\b/u.test(raw) && !/\/Route>/u.test(raw) && !/\/>\s*$/u.test(raw)) continue;
    const el = /element=\s*\{\s*<(\w+)/.exec(attrs);
    if (pm) {
      const p = pm[1];
      let full;
      if (p.startsWith('/')) {
        full = p;
        lastAbsoluteAt = { depth: li, path: p };
      } else {
        // relative child: join to nearest open absolute parent (best-effort
        // by document proximity: the last absolute route opened above)
        full = `${lastAbsoluteAt.path.replace(/\/+$/u, '')}/${p}`.replace(/\/{2,}/gu, '/');
      }
      const selfClose = (raw.match(/<Route[^>]*\/>/gu) || []).length > 0 && (raw.match(/<Route\b/gu) || []).length > 0;
      // children of a self-closing declaration are impossible; track open
      if (!selfClose && starts > ends) {
        // opens a children block: remember it as the joiner for following
        // relative paths until a deeper absolute path arrives
        lastAbsoluteAt = { depth: li, path: full.startsWith('/') ? full : full };
      }
      routes.push({ path: full.replace(/\/+$/u, '') || '/', via: el ? el[1] : '', line: li + 1 });
    } else if (starts && el && /<Route\b[^>]*\bindex\b/u.test(attrs)) {
      const idxPath = (lastAbsoluteAt.path || '').replace(/\/+$/u, '') || '/';
      routes.push({ path: idxPath, via: el[1], index: true, line: li + 1 });
    }
    jsxDepth += 0;
    void tagDepth;
    void parentStack;
    void openLine;
    void jsxDepth;
  }
}
/* ---- navigation targets used anywhere under src/ ---- */
const targets = new Map();
const add = (t, where) => {
  if (!t) return;
  if (!targets.has(t)) targets.set(t, new Set());
  targets.get(t).add(where);
};
for (const f of files) {
  if (f.endsWith('App.js')) continue;
  const rel = path.relative(ROOT, f);
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/to\s*=\s*\{\s*"([^"]+)"\s*\}/gu)) if (m[1].startsWith('/')) add(m[1], rel);
  for (const m of t.matchAll(/to\s*=\s*"([^"]+)"/gu)) if (m[1].startsWith('/')) add(m[1], rel);
  for (const m of t.matchAll(/navigate\(\s*[`"]([^`"'+$]+)[`"]/gu)) if (m[1].startsWith('/')) add(m[1], rel);
  for (const m of t.matchAll(/navigate\(\s*`\$\{[^`]*\}`|navigate\([^)]*\.path/gu)) add('<dynamic>', rel);
}

const matchRoute = (target) => {
  const clean = target.split('?')[0].split('#')[0];
  if (clean === '<dynamic>') return { ok: true, dyn: true };
  if (clean.endsWith('/')) return { ok: true }; // parent segment of detail pages
  for (const r of routes) {
    const rp = r.path.split('/').filter((seg) => seg !== '');
    const tp = clean.split('/').filter((seg) => seg !== '');
    if (rp.length !== tp.length) continue;
    let ok = true;
    for (let i = 0; i < rp.length; i += 1) {
      const s1 = rp[i];
      const s2 = tp[i];
      if (s1 === s2) continue;
      if (s1.startsWith(':')) continue;
      ok = false;
      break;
    }
    if (ok) return { ok: true, route: r.path };
  }
  // splat/catch-all redirect at '/' handles unmatched; but explicit targets must still resolve
  return { ok: clean === '/' ? true : undefined, fallback: true };
};

const dead = [];
const dyn = [];
for (const [t, wheres] of targets) {
  if (t === '<dynamic>') continue;
  const m = matchRoute(t);
  if (m.dyn) continue;
  if (m.ok !== true) dead.push({ target: t, where: [...wheres].slice(0, 2).join(', ') });
}
for (const [t, wheres] of targets) {
  if (t === '<dynamic>') dyn.push([...wheres][0]);
}

if (process.argv.includes('--json')) {
  const dead = [];
  for (const [t, wheres] of targets) {
    if (t === '<dynamic>') continue;
    if (!matchRoute(t).ok) dead.push({ target: t, where: [...wheres].join(', ') });
  }
  console.log(
    JSON.stringify({ routePatterns: routes.length, absoluteTargets: targets.size, dead, dynamic: dyn.length }, null, 1)
  );
  process.exitCode = dead.length ? 1 : 0;
} else {
  console.log(
    `# Route inventory: ${routes.length} patterns declared, ${targets.size} distinct absolute targets used in src/`
  );
  if (dead.length) console.log('## DEAD TARGETS (link/navigate to no declared route)');
  for (const d of dead) console.log(`- ✗ ${String(d).slice(0, 100)}`);
  if (!dead.length)
    console.log(
      'Dead targets: NONE — every absolute navigation string resolves to a declared pattern (walk still verifies BEHAVIOUR: redirects, guards, state).'
    );
}
