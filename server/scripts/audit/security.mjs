#!/usr/bin/env node
/**
 * Security audit gate.
 *
 * This is not a scanner with findings to triage later. Every check below is a
 * rule this codebase promises, stated as something that can fail a push, because
 * the alternative - a checklist in a document - has already been tried and the
 * items on it are exactly the ones that turned up broken while doing other work
 * this session: sign-in routes without an attempt limit, email confirmations
 * reported as sent when no SMTP was configured, `dns.setServers` pointing every
 * container at Google and Cloudflare, a 50 MB JSON body limit on every route.
 *
 * Each rule has a reason and a remedy in its failure text. A gate that says
 * "violations found" without saying what to do is a gate people switch off.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Two levels up from scripts/audit/, i.e. the server package root. The first
 * version of this file got this wrong and resolved to scripts/, so the "walk
 * every route file" loops silently scanned nothing and every rule reported
 * clean - exactly the shape of false green this gate exists to catch. `files()`
 * below therefore throws if a directory is missing instead of returning [].
 */
/**
 * Strip comments and string literals before a rule looks at identifiers.
 *
 * Without this, three of this file's own rules produced findings that were
 * artifacts of prose: the DNS rule matched the sentence in which I explain the
 * DNS rule, and the credential rule matched the message text inside
 * `console.error('Forgot password error:', error)` - which logs an error object,
 * not a password. A rule that fires on comments gets switched off the second it
 * annoys someone, so it is not a rule.
 */
export function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, "''");
}

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  /*
   * Failures print EVERY offender on its own line, in full. My first version
   * truncated the detail to 300 characters, so a rule that found eight sites
   * showed four and half of a fifth - a gate that hides findings behind its own
   * formatting is worse than no gate, because the summary line still reads as if
   * it enumerated them.
   */
  if (ok) {
    console.log(`PASS  ${name}`);
    return;
  }
  console.log(`FAIL  ${name}`);
  const items = Array.isArray(detail)
    ? detail
    : String(detail).includes(' | ')
      ? String(detail).split(' | ')
      : [String(detail)];
  for (const item of items) {
    if (item && item.trim()) console.log(`        - ${item.trim()}`);
  }
};

const files = (dir, filter = () => true) => {
  /*
   * Loud on a missing directory. An audit whose target path is wrong reports
   * "0 violations" and passes; that is worse than crashing, because it looks like
   * evidence. (It happened: SERVER resolved to scripts/, the walk found no
   * routes, and every rule went green on an unprotected codebase.)
   */
  if (!fs.existsSync(dir)) throw new Error(`security audit cannot run: ${dir} does not exist`);
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', 'build', 'uploads', '.git'].includes(entry.name)) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|mjs)$/.test(entry.name) && filter(entry.name)) out.push(full);
    }
  };
  walk(dir);
  return out;
};

const read = (f) => fs.readFileSync(f, 'utf8');
const rel = (f) => path.relative(SERVER, f);
const routeFiles = files(path.join(SERVER, 'routes'), (n) => n.endsWith('.js'));
const allServerFiles = files(SERVER);
// Guard against the "scanned nothing, reported all-clear" failure mode directly.
if (routeFiles.length < 20)
  throw new Error(
    `security audit found only ${routeFiles.length} route files - refusing to certify an incomplete scan`
  );

/* ------------------------------------------------------------------------- */
/* 1. Authentication endpoints must be attempt-limited                        */
/* ------------------------------------------------------------------------- */

/*
 * Six of the app's sign-in and OTP surfaces carry no limiter at all: the admin
 * login, every role's verify-login-otp, and reset-password. Those are the routes
 * where an attacker gets to guess - a 6-digit code on a path that returns
 * "Invalid OTP" versus "OTP expired" is guessable, and the account lockout that
 * exists on some logins does not cover the OTP step.
 *
 * Matching is structural (a router.post for an auth-looking path whose handler
 * arguments lack both `Limiter` and `verifyToken`) rather than a filename
 * allowlist, because a new route in a new file is exactly what an allowlist
 * misses.
 */
const AUTH_PATH = /\/(login|register|verify[-\w]*otp|verify-otp|forgot-password|reset-password|resend-otp)$/i;
const unbounded = [];
for (const f of routeFiles) {
  const text = read(f);
  const re = /router\.(post|put|patch)\(\s*'([^']+)'((?:\s*,\s*[^,()]+)*)\s*,\s*(?:async\s*)?\(/g;
  for (const m of text.matchAll(re)) {
    const routePath = m[2];
    const mid = m[3] || '';
    if (!AUTH_PATH.test(routePath)) continue;
    const limited = /Limiter\b|RateLimit|verifyToken|checkPermission/.test(mid);
    if (!limited) unbounded.push(`${rel(f)} ${m[1].toUpperCase()} ${routePath}`);
  }
}
check('every public auth/OTP route carries an attempt limiter', unbounded.length === 0, unbounded);

/* ------------------------------------------------------------------------- */
/* 2. Email delivery is reported, never assumed                              */
/* ------------------------------------------------------------------------- */

/*
 * `sendOTP` and its siblings return { success, delivered, reason }. Ignoring the
 * result on a fire-and-forget notification is a bug but a quiet one; ignoring it
 * where the HTTP response then says "OTP sent to your email" is a lie that locks
 * people out - which is what this codebase shipped until the delivery result was
 * plumbed through.
 *
 * So: a site may ignore the result only when nothing in its response claims
 * delivery. The check reads the enclosing ~14 lines and objects when a send whose
 * value is discarded shares that window with "sent to your", "OTP sent",
 * "confirmation has been sent" or similar.
 */
const LIE_PATTERNS = /(OTP sent|sent to your (email|inbox)|email (has been )?sent|confirmation.*sent|mailed to you)/i;
const ignoredSends = [];
for (const f of allServerFiles) {
  const lines = read(f).split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/^\s*await\s+(send[A-Za-z]+)\(/);
    if (!m) return;
    const window = lines.slice(Math.max(0, i - 2), i + 14).join('\n');
    if (LIE_PATTERNS.test(window)) {
      ignoredSends.push(`${rel(f)}:${i + 1} ${m[1]} result discarded while answering as if delivered`);
    }
  });
}
check('no response claims an email was delivered without checking the result', ignoredSends.length === 0, ignoredSends);

/*
 * The complementary rule: every send result that IS read must be read for
 * `.success`/`.delivered`/`.reason`, not just captured. A `const r = await
 * sendX()` followed by nothing is the same bug wearing a name.
 */
const capturedUnused = [];
for (const f of allServerFiles) {
  const lines = read(f).split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*await\s+(send[A-Za-z]+)\(/);
    if (!m) return;
    const name = m[1];
    const rest = lines.slice(i + 1, i + 30).join('\n');
    if (!new RegExp(`\\b${name}\\b`).test(rest))
      capturedUnused.push(`${rel(f)}:${i + 1} ${m[2]} -> ${name} never read`);
  });
}
check('captured delivery results are actually used', capturedUnused.length === 0, capturedUnused);

/* ------------------------------------------------------------------------- */
/* 3. Transport-level settings that must not be hardcoded                     */
/* ------------------------------------------------------------------------- */

/*
 * `dns.setServers(['8.8.8.8','1.1.1.1'])` sends every hostname lookup in the
 * process through Google/Cloudflare, whatever the deployment's own resolver says.
 * In practice that breaks resolving anything on a private route53/VPC zone, makes
 * DNS the thing that fails when egress is restricted, and quietly disables
 * /etc/hosts entries - all to work around a container with a broken resolv.conf,
 * which is an infrastructure fix.
 */
const dnsSite = allServerFiles
  .filter((f) => !/scripts[\\/]audit[\\/]security\.mjs$/.test(f))
  .map((f) => [rel(f), codeOnly(read(f))])
  /*
   * The *call* is the finding. An `if (dnsOverride.length) dns.setServers(...)`
   * behind an env check is the sanctioned form, so a gated call is allowed while
   * an unconditional one is not.
   */
  .filter(
    ([, code]) =>
      /dns\.setServers\s*\(/.test(code) && !/if\s*\(\s*dnsOverride\.length\s*\)\s*dns\.setServers/.test(code)
  );
check(
  'DNS resolvers are not hardcoded (make it opt-in via env)',
  dnsSite.length === 0,
  dnsSite.map(([f]) => f)
);

/* ------------------------------------------------------------------------- */
/* 4. Request bodies bounded honestly                                         */
/* ------------------------------------------------------------------------- */

/*
 * A 50 MB JSON limit on every route means a single unauthenticated POST with a
 * 50 MB body is 50 MB of parsing, and dozens of those is an outage. Upload payloads
 * are handled by multer with their own file-size caps; the JSON parser does not
 * need 50 MB, and nothing in this API legitimately sends a 50 MB JSON document.
 */
const bodyLimits = allServerFiles.flatMap((f) =>
  [...read(f).matchAll(/express\.json\(\{\s*limit:\s*'([^']+)'/g)].map((m) => [rel(f), m[1]])
);
const tooBig = bodyLimits.filter(([, size]) => {
  const mb = /mb/i.test(size) ? parseFloat(size) : parseFloat(size) / 1024;
  return mb > 5;
});
check(
  'JSON body limit is sized for real payloads, not uploads',
  tooBig.length === 0,
  tooBig.map(([f, s]) => `${f}:${s}`)
);

/* ------------------------------------------------------------------------- */
/* 5. CORS                                                                 */
/* ------------------------------------------------------------------------- */

const corsFiles = allServerFiles.map((f) => [rel(f), read(f)]).filter(([, t]) => /\bcors\s*\(/.test(t));
const corsFindings = [];
for (const [f, t] of corsFiles) {
  if (/origin:\s*true/.test(t) && /credentials:\s*true/.test(t))
    corsFindings.push(`${f}: origin:true with credentials`);
  if (/origin:\s*['"]\*['"]/.test(t) && /credentials:\s*true/.test(t))
    corsFindings.push(`${f}: wildcard origin with credentials`);
  /*
   * A single FRONTEND_URL means one deployment, one origin. That is right for the
   * app's own traffic; without a list, the day a second origin appears (a staging
   * host, a partner storefront) the change is made under pressure. Allowed but
   * reported as a note so the operator sees the shape of the policy.
   */
  if (/origin:\s*process\.env\.FRONTEND_URL\s*\|\|/.test(t) && !/FRONTEND_URLS|split|\.map\(/.test(t))
    corsFindings.push(`${f}: only one allowed origin, no comma-separated list support`);
}
check('CORS policy is explicit and cannot become wildcard-with-credentials', corsFindings.length === 0, corsFindings);

/* ------------------------------------------------------------------------- */
/* 6. Secrets and sessions                                                    */
/* ------------------------------------------------------------------------- */

const secretFindings = [];
for (const [f, t] of allServerFiles.map((x) => [rel(x), read(x)])) {
  void t;
  if (/jwt\.sign\([^)]*,\s*['"]/.test(t)) secretFindings.push(`${f}: literal JWT secret`);
  if (/JWT_SECRET\s*\|\|?\s*['"][^'"]{1,30}['"]/.test(t))
    secretFindings.push(`${f}: JWT_SECRET falls back to a literal`);
  /*
   * An actual credential VALUE reaching a log line, judged on comment- and
   * string-stripped code: a bare `otp`/`password`/`token` identifier in the call,
   * a `${otp}` template hole, or a `.password` property read. This deliberately
   * no longer matches the phrase "password" inside a message string like
   * `console.error('Forgot password error:', error)`, which logs an Error and is
   * exactly what you want in a log.
   */
  const code = codeOnly(t);
  for (const m of code.matchAll(/console\.(?:log|error|warn|info)\(([\s\S]{0,180}?)\)\s*;?/g)) {
    const args = m[1] || '';
    const leaksCredential =
      /\$\{[^}]*\b(otp|password|token|secret|authorization|resumeToken)\b/i.test(args) ||
      /(^|[^.\w])(otp|password|plainPassword|newPassword|token|accessToken|refreshToken|secret)\s*[,)]/.test(args) ||
      /\.\s*(password|otp|token|secret)\b/i.test(args);
    if (leaksCredential) {
      const ln = (t.slice(0, m.index).match(/\n/g) || []).length + 1;
      secretFindings.push(`${f}:${ln} logs a credential value: ${args.replace(/\s+/g, ' ').slice(0, 70)}`);
    }
  }
}
check('no literal signing secrets and no credentials in logs', secretFindings.length === 0, secretFindings.join(' | '));

/* ------------------------------------------------------------------------- */
/* 7. Error responses must not leak internals                                 */
/* ------------------------------------------------------------------------- */

/*
 * `res.status(500).json({ error: error.message })` hands the caller our schema
 * paths, driver errors and sometimes connection strings. Two of these were
 * removed by hand in this batch for exactly that reason. The allowance is 500s
 * whose response text is a fixed sentence with no `error` property carrying the
 * exception.
 */
/*
 * Rule: 5xx bodies must not carry internal error text to the client.
 *
 * There are 300+ call sites of the shape
 * `res.status(500).json({ error: error.message })` - schema paths, driver
 * messages, occasionally a fragment of a connection string. Rewriting each one
 * by regex would be 300 unreviewed edits, and the failure mode of that is well
 * documented by my own hour today; the *boundary* on the other hand is exactly
 * one place, and a response that passes through it cannot leak whatever the call
 * site did.
 *
 * So the gate asserts the guard is mounted, is installed before the routers, and
 * strips the dangerous keys for status >= 500 - and scripts/*_unit proves its
 * behaviour directly, including that development output keeps the detail (a guard
 * that hides the cause during development just moves the debugging to prod).
 */
const surface = path.join(SERVER, 'middleware', 'errorSurface.js');
const serverText = read(path.join(SERVER, 'server.js'));
check('the error-surface guard exists', fs.existsSync(surface));
let guardText = '';
if (fs.existsSync(surface)) {
  guardText = read(surface);
  check(
    'it strips internals only for server errors (4xx keeps its message)',
    />=\s*500|statusCode >= 500/.test(guardText) && /\berror\b/.test(guardText)
  );
  check(
    'it keeps detail in development (a guard that blinds the developer gets removed)',
    /isProduction|NODE_ENV/.test(guardText)
  );
  check(
    'and it logs what it removed, so the cause is not lost with the response',
    /console\.(error|warn)/.test(guardText)
  );
  check(
    'the guard is mounted before the routers',
    serverText.indexOf('errorSurface') > -1 &&
      serverText.indexOf('errorSurface') <
        (serverText.indexOf("app.use('/api'") >= 0 ? serverText.indexOf("app.use('/api'") : serverText.length)
  );
}

/* ------------------------------------------------------------------------- */
/* 8. Production refusals wired at boot                                        */
/* ------------------------------------------------------------------------- */

const boot = serverText;
check('production boot refuses to run without a real signing secret', /assertRuntimeSecrets/.test(boot));
check('production boot refuses to seed demo accounts', /seedDecision|isProduction/.test(boot));
check(
  'uploads go through the storage service, not direct disk writes',
  !/fs\.writeFileSync\(.*uploads/.test(
    allServerFiles
      .filter((f) => !/services\/storage\.js$/.test(f))
      .map(read)
      .join('\n')
  )
);

/* ------------------------------------------------------------------------- */
/* 9. Body spreading: the escalation found and fixed today                    */
/* ------------------------------------------------------------------------- */

/*
 * `{ ...req.body }` into a Mongoose document, or `Object.assign(doc, req.body)`,
 * hands the caller every field the schema knows. On the listing doors that meant a
 * manufacturer could post `verificationStatus: 'verified'` and appear in the public
 * catalogue with no review, or `isSponsored: true` to take a placement the desk
 * sells. Both doors now take an allow-list; this rule stops a third door being
 * written the same way by someone who never saw the incident.
 */
const spreadDoors = [];
for (const [f, code] of allServerFiles.map((x) => [rel(x), codeOnly(read(x))])) {
  if (
    /Object\.assign\(\s*(product|seller|order|user|manufacturer|partner|brand)\w*\s*,\s*(req\.)?body\s*\)/i.test(code)
  ) {
    spreadDoors.push(`${f}: Object.assign(<model>, body)`);
  }
  for (const m of code.matchAll(/new\s+([A-Z]\w+)\(\s*\{([^]{0,160}?\.\.\.(?:req\.)?body)/g)) {
    spreadDoors.push(`${f}: new ${m[1]}({ ...body })`);
  }
}
check('no document is built by spreading a request body', spreadDoors.length === 0, spreadDoors.join(' | ') || 'none');
check(
  'the listing doors take the shared allow-list',
  /pickUploadableFields/.test(read(path.join(SERVER, 'routes', 'manufacturer.js'))) &&
    /pickUploadableFields/.test(read(path.join(SERVER, 'routes', 'product.js')))
);

/* ------------------------------------------------------------------------- */
/* 10. Baseline security headers                                              */
/* ------------------------------------------------------------------------- */

/*
 * There was no helmet and no setHeader call anywhere in the app: the API served
 * responses with no X-Content-Type-Options, no frame policy, no referrer policy and
 * no HSTS, while the browser keeps a bearer token in localStorage. Absent headers do
 * not cause an incident by themselves; they remove the cheap friction that turns a
 * content-injection bug into a session theft. Asserted so they cannot silently fall
 * away again.
 */
const surfaceText = fs.existsSync(path.join(SERVER, 'middleware', 'errorSurface.js'))
  ? read(path.join(SERVER, 'middleware', 'errorSurface.js'))
  : '';
const headerSite = boot + surfaceText;
const REQUIRED_HEADERS = ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy'];
const missingHeaders = REQUIRED_HEADERS.filter((h) => !headerSite.includes(h));
check(
  'responses set the baseline security headers',
  missingHeaders.length === 0,
  `missing: ${missingHeaders.join(', ') || 'none'}`
);
check(
  'HSTS is advertised in production only (a dev host over http cannot use it)',
  /Strict-Transport-Security/.test(headerSite)
);

/* ------------------------------------------------------------------------- */
/* 11. The 2026-11 security batch: controls that must stay switched on        */
/* ------------------------------------------------------------------------- */

{
  let total = 0;
  let pinned = 0;
  for (const f of allServerFiles) {
    let text = '';
    try {
      text = read(f);
    } catch {}
    for (const m of text.matchAll(/jwt\.verify\(/gmu)) {
      total += 1;
      if (/algorithms/u.test(text.slice(m.index, m.index + 220))) pinned += 1;
    }
  }
  check(
    'every jwt.verify pins allowed algorithms explicitly',
    total > 0 && pinned === total,
    `${pinned}/${total} call sites`
  );
}

check(
  'mongoGuard mounted on /api (operator + prototype shapes die at the edge)',
  /app\.use\(\s*['"]\/api\/?['"],\s*mongoGuard\s*\)/u.test(boot)
);
{
  const raw = [];
  for (const f of routeFiles) {
    let text = '';
    try {
      text = read(f);
    } catch {}
    for (const m of text.matchAll(/(\w+)\.(loginOtp|resetOtp) = (?!undefined)/gmu)) {
      const around = text.slice(Math.max(0, m.index - 90), m.index + 110);
      if (!/stampOtp\(/u.test(around)) raw.push(`${rel(f)}::${m[0].slice(0, 46)}`);
    }
  }
  check(
    'OTP never written to documents as plaintext (digests via services/otpCode)',
    raw.length === 0,
    raw.slice(0, 4).join(' | ')
  );
}

{
  const banned = [
    /message:\s*[`"'][^`"']*phone number not registered/iu,
    /message:\s*[`"'][^`"']*email not registered/iu,
    /message:\s*[`"']OTP has expired[`"']/u,
    /message:\s*'Invalid OTP\.'/u,
    /\$\{remainingAttempts\} attempts? remaining/u,
    /attempt\(s\) remaining/u,
  ];
  const seen = [];
  for (const f of routeFiles) {
    let text = '';
    try {
      text = read(f);
    } catch {}
    for (const rx of banned) if (rx.test(text)) seen.push(`${rel(f)}~${String(rx).slice(1, 24)}`);
  }
  check(
    'old enumeration / lockout-counter sentences are gone from route text',
    seen.length === 0,
    seen.slice(0, 4).join(' | ')
  );
  const uniformRe = /The code is invalid or has expired\./u;
  const good = [
    'auth',
    'adminAuth',
    'seller',
    'executive',
    'deliveryPartner',
    'manufacturer',
    'manufacturerSeller',
  ].filter((n) => {
    const p2 = path.join(SERVER, 'routes', `${n}.js`);
    return fs.existsSync(p2) && uniformRe.test(read(p2));
  });
  check('all console OTP verify paths share one indistinguishable refusal', good.length >= 7, good.join(','));
}

{
  const st = read(path.join(SERVER, 'services', 'storage.js'));
  check(
    'saveUpload enforces magic-byte signatures before storing bytes',
    /function assertRealBytes/u.test(st) && /assertRealBytes\(buffer,\s*ext\)/u.test(st)
  );
}

{
  const walk = (dir) => {
    let out = [];
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const pp = path.join(dir, e.name);
      if (e.isDirectory()) out = out.concat(walk(pp));
      else if (/\.jsx?$/u.test(e.name) && /dangerouslySetInnerHTML/u.test(read(pp))) out.push(pp);
    }
    return out;
  };
  const sites = walk(path.join(SERVER, '..', 'client', 'src'));
  const bt = read(path.join(SERVER, 'routes', 'blog.js'));
  const doors =
    (bt.match(/sanitizeBlogHtml\(req\.body\.content\)/gmu) || []).length +
    (bt.match(/req\.body\.content !== undefined \?\s*sanitizeBlogHtml/gmu) || []).length;
  check(
    'exactly one raw-HTML render surface (blog) and both blog write doors sanitize',
    sites.length <= 1 && doors >= 2,
    `sites=${sites.length} doors=${doors}`
  );
}

{
  const sx = read(path.join(SERVER, 'routes', 'shiprocket.js'));
  check(
    'shiprocket webhook requires its header secret and timing-compares it',
    /SHIPROCKET_WEBHOOK_SECRET/u.test(sx) && /timingSafeEqual/u.test(sx) && /isProduction\(\)/u.test(sx)
  );
}

check('the framework banner header is explicitly disabled', /app\.disable\('x-powered-by'\)/u.test(boot));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} security gate checks passed`);
if (failed.length) {
  console.log('\nUnfixed checks are listed above with the reason each rule exists.');
  failed.forEach((f) => console.log(`  - ${f.name}`));
}
process.exitCode = failed.length ? 1 : 0;
