#!/usr/bin/env node
/**
 * Static audit: every state-changing HTTP route must either stand behind an
 * identity middleware in its declared chain, or be explicitly allowlisted
 * with a reason.
 *
 * This audit exists because the category the user handed us - "Direct API
 * access", "Missing function-level authorization", "API authorization
 * inconsistency" (B31/B39/B40) - cannot be argued from prose. Some POST/PUT
 * somewhere always lacks its token check, and it is precisely the route that
 * nobody added to a hand-maintained list. So we enumerate from the server: the
 * mounts parsed out of server.js itself, every router.<verb>() found in every
 * file under server/routes/, chain text extracted by a parenthesis-tracking
 * scanner (not a regex that dies on middleware call sites like
 * upload.single('image')).
 *
 * Classification:
 *   - chain contains any exported `verify*`        -> authenticated
 *   - otherwise it must appear in PUBLIC_ALLOW with a reason comment
 *   - otherwise it is an offender, and CI goes red.
 * A limiter does NOT count as authentication (sign-in routes have limiters
 * BECAUSE they are anonymous). optionalAuth does not count (guests pass).
 * Payment/shiprocket webhooks authenticate INSIDE the handler by verifying
 * signatures; the allowlist lines say so, and scripts/security_attacks_e2e.mjs
 * proves by behavior that an unsigned POST is refused.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const ROUTES = path.join(ROOT, 'server', 'routes');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 240)}` : ''}`);
  return ok;
};

/* ---- mounts: derive the live prefix table from server.js, no hand list ---- */
const serverText = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
const importToFile = new Map();
for (const m of serverText.matchAll(/import\s+(\w+)\s+from\s+'\.\/([\w./-]+)\.js'/gu)) {
  importToFile.set(m[1], `${m[2].split('/').pop()}.js`);
}
const fileToPrefix = new Map();
const MOUNT_RE = /app\.use\(\s*'\/api(?:\/([\w/-]+))?'\s*,\s*(\w+Routes)\s*\)/gu;
for (const m of serverText.matchAll(MOUNT_RE)) {
  const prefix = m[1]; // undefined => the bare '/api' mounts
  const file = importToFile.get(m[2]);
  if (file) fileToPrefix.set(file, prefix || '_root');
}

/* ---------------- route declarations, scanned with a real parser ---------- */
const VERB_RE = /router\.(post|put|patch|delete)\(\s*'([^']+)'/gu;

function chainAfter(text, m) {
  // We are positioned INSIDE router.<verb>( ... ): depth starts at 1.
  let i = m.index + m[0].length;
  let depth = 1;
  let inStr = null;
  const parts = [];
  let cur = '';
  while (i < text.length) {
    const c = text[i];
    if (inStr) {
      cur += c;
      if (c === '\\' && inStr !== '\\' && text[i + 1]) {
        cur += text[++i];
      } else if (c === inStr) inStr = null;
      i += 1;
      continue;
    }
    if (c === "'" || c === '`' || c === '\\"') {
      inStr = c;
      cur += c;
      i += 1;
      continue;
    }
    if (c === '(') {
      depth += 1;
      cur += c;
      i += 1;
      continue;
    }
    if (c === ')') {
      depth -= 1;
      if (depth === 0) {
        if (cur.trim()) parts.push(cur.trim());
        break; // reached the end of the call; last arg WAS the handler
      }
      cur += c;
      i += 1;
      continue;
    }
    if (c === ',' && depth === 1) {
      if (cur.trim()) parts.push(cur.trim());
      cur = '';
      i += 1;
      continue;
    }
    if (
      depth === 1 &&
      /^(async|function|[a-zA-Z_$][\w$]*\s*$)/u.test(text.slice(i, i + 12).trim()) &&
      /(?:async\s+)?\(\s*req/u.test(text.slice(i, i + 16))
    ) {
      // beginning of the handler itself
      break;
    }
    if (depth > 1) cur += c;
    else cur += c;
    i += 1;
  }
  // drop the final trailing arg if it turned out to be the handler body
  const cleaned = parts.filter((x) => !/(=>|async \(|function \()/u.test(x) || /^[a-zA-Z_$][\w$.]*$/u.test(x));
  return cleaned.join(', ');
}

/*
 * Public by design. One line each saying WHY an anonymous caller is allowed -
 * the point of writing the reason is that someone reviewing this file can
 * disagree with a reason, which is not possible with a bare list.
 */
const PUBLIC_ALLOW = new Set([
  /*
   * Generated from the code, then reviewed by hand, on 2026-11-20. These 35
   * mutating routes are anonymous BY DESIGN and each group says why; the
   * behavioral suite scripts/security_attacks_e2e.mjs proves the ones that
   * authenticate inside the handler (OTP stages, webhook signature checks,
   * capability tokens) really refuse without their credential. Adding a route
   * here is a decision a reviewer sees in the diff.
   */
  // sign-in & password machinery: credential/OTP steps verified in-handler,
  // attempt-limited at the route
  '/api/admin/auth/login',
  '/api/admin/auth/verify-otp',
  '/api/auth/forgot-password',
  '/api/auth/login',
  '/api/auth/reset-password',
  '/api/auth/send-otp',
  '/api/auth/verify-login-otp',
  '/api/auth/verify-otp',
  '/api/delivery-partner/login',
  '/api/delivery-partner/verify-login-otp',
  '/api/executive/login',
  '/api/executive/verify-login-otp',
  '/api/manufacturer-seller/login',
  '/api/manufacturer-seller/verify-login-otp',

  '/api/manufacturer/login',
  '/api/manufacturer/onboarding/:token/otp',
  '/api/manufacturer/verify-login-otp',
  '/api/seller/login',
  '/api/seller/verify-login-otp',
  '/api/seller/verify-phone',
  // third-party callbacks: signature / shared-secret checked IN the handler
  '/api/payment/webhook',
  '/api/shiprocket/webhook',
  // capability URLs: the server-generated random token IS the credential
  '/api/manufacturer/onboarding/:token/otp',
  '/api/manufacturer/onboarding/:token/update',
  '/api/manufacturer/onboarding/:token/verify',
  '/api/seller-stock/public/price-changes/:stockId/decide',
  // guest storefront helpers that return server-computed numbers only, or
  // paid-provider features (limiter-keyed, results public-safe)
  '/api/auth/register',
  '/api/chatbot/message',
  '/api/chatbot/suggestions',
  '/api/comparison/compare-categories',
  '/api/face-detection/detect',
  '/api/help/contact',
  '/api/orders/quote',
  '/api/seller/register',
  '/api/seller/verify-phone',
  '/api/speech/search',
  '/api/speech/transcribe',
]);

const AUTH_IN_CHAIN = /\bverify[A-Za-z]*\b/u;

let scanned = 0;
const offenders = [];
let filesWithoutMount = 0;
for (const file of fs.readdirSync(ROUTES).sort()) {
  if (!file.endsWith('.js')) continue;
  const prefix = fileToPrefix.get(file);
  if (!prefix) {
    filesWithoutMount += 1;
    continue; // helper-only module or mounted elsewhere; next check counts these
  }
  const text = fs.readFileSync(path.join(ROUTES, file), 'utf8');
  /*
   * A file-level `router.use(verifyToken, ...)` gates every route BELOW it,
   * and those routes' own chains read as bare handlers. Register the gate at
   * its byte offset; a route index is covered if an earlier unconditional
   * router.use(gate) exists, or one with a path prefix that the relPath
   * starts with.
   */
  const FILE_GATE = /router\.use\(\s*(?:'([^']*)'\s*,\s*)?((?:[^,'()]|\([^)]*\))*)\)/gu;
  const gates = [];
  for (const g of text.matchAll(FILE_GATE)) {
    const args = g[2] || '';
    if (!AUTH_IN_CHAIN.test(args)) continue;
    gates.push({ at: g.index, prefix: g[1] || null });
  }
  const coveredByFileGate = (routeIndex, relPath) =>
    gates.some((g) => g.at < routeIndex && (g.prefix === null || relPath.startsWith(g.prefix)));
  for (const m of text.matchAll(VERB_RE)) {
    const verb = m[1].toUpperCase();
    const relPath = m[2].startsWith('/') ? m[2] : `/${m[2]}`;
    const chain = chainAfter(text, m);
    scanned += 1;
    const full = prefix === '_root' ? `/api${relPath}` : `/api/${prefix}${relPath === '/' ? '' : relPath}`;
    if (AUTH_IN_CHAIN.test(chain) || coveredByFileGate(m.index, relPath)) continue;
    if (PUBLIC_ALLOW.has(full)) continue;
    offenders.push(`${file} ${verb} ${full}`);
  }
}

check(
  'mount table resolved most route files',
  filesWithoutMount <= 3,
  `${filesWithoutMount} file(s) not mounted: cross-check server.js imports`
);
check(
  'route scanner actually saw the surface',
  scanned > 150,
  `${scanned} mutating routes across ${fileToPrefix.size} mounted files`
);
check(
  'every mutating route is gated or explicitly allowlisted',
  offenders.length === 0,
  offenders.slice(0, 24).join(' | ')
);

const knownPaths = new Set(); // re-collect for allowlist-staleness (non-fatal report)
for (const file of fs.readdirSync(ROUTES)) {
  if (!file.endsWith('.js')) continue;
  const prefix = fileToPrefix.get(file);
  if (!prefix) continue;
  const text = fs.readFileSync(path.join(ROUTES, file), 'utf8');
  for (const m of text.matchAll(VERB_RE)) {
    const relPath = m[2].startsWith('/') ? m[2] : `/${m[2]}`;
    knownPaths.add(prefix === '_root' ? `/api${relPath}` : `/api/${prefix}${relPath === '/' ? '' : relPath}`);
  }
}
const stale = [...PUBLIC_ALLOW].filter((p) => !knownPaths.has(p));
console.log(
  stale.length
    ? `note: ${stale.length} allowlist entries match no current route (dev/renamed): ${stale.slice(0, 8).join(', ')}`
    : 'allowlist entries all reference live routes'
);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} mutation-authz checks passed`);
process.exitCode = failed ? 1 : 0;
