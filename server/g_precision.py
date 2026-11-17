"""Batch G: make the audit's own rules precise, then fix the thing they report.

Three of my first-run findings were defects in the *detector*, not the code, and
shipping them would have been worse than the bugs:

- the DNS rule matched any file containing the text `dns.setServers(`, which
  included this audit's own explanation of the rule, and prose in a comment;
- the credential-log rule matched the word "password" anywhere in a console call,
  so `console.error('Forgot password error:', error)` - which logs an error
  object - was reported as leaking a password across nine files;
- and the 500-leak rule counted 313 sites without proposing a fix, which is a
  report, not a gate.

So: compare code, not text. Comments and string literals are stripped before a
rule looks at identifiers, and the leaky-response rule is enforced at the one
place that can actually fix all 313 - the response boundary - leaving the call
sites alone rather than making 313 edits I cannot individually review.
"""
import pathlib
import re

# ── audit: precise rule helpers ───────────────────────────────────────────────
SEC = pathlib.Path("scripts/audit/security.mjs")
text = SEC.read_text()

code_only = '''/**
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
    .replace(/\\/\\*[\\s\\S]*?\\*\\//g, " ")
    .replace(/^\\s*\\/\\/.*$/gm, " ")
    .replace(/`(?:\\\\.|[^`\\\\])*`/g, "``")
    .replace(/'(?:\\\\.|[^'\\\\])*'/g, "''")
    .replace(/"(?:\\\\.|[^"\\\\])*"/g, "''");
}

'''
anchor = "const SERVER = path.resolve("
assert anchor in text
text = text.replace(anchor, code_only.rstrip("\n") + "\n\n" + anchor, 1)

# this audit is allowed to mention the rules it enforces
old_dns = """const dnsSite = allServerFiles
  .map((f) => [rel(f), read(f)])
  .filter(([, t]) => /dns\\.setServers\\s*\\(/.test(t) && !/process\\.env\\.(DNS_OVER|SYSTEM_DNS)/.test(t));"""
assert old_dns in text, "dns rule"
text = text.replace(old_dns, """const dnsSite = allServerFiles
  .filter((f) => !/scripts[\\\\/]audit[\\\\/]security\\.mjs$/.test(f))
  .map((f) => [rel(f), codeOnly(read(f))])
  /*
   * The *call* is the finding. An `if (dnsOverride.length) dns.setServers(...)`
   * behind an env check is the sanctioned form, so a gated call is allowed while
   * an unconditional one is not.
   */
  .filter(([, code]) =>
    /dns\\.setServers\\s*\\(/.test(code) && !/if\\s*\\(\\s*dnsOverride\\.length\\s*\\)\\s*dns\\.setServers/.test(code)
  );""", 1)

old_cred = """  // A token or password reaching a log line is a credential in the log store.
  if (/console\\.(log|error|warn)\\([^)]*\\b(password|otp|token|secret|authorization)\\b/i.test(t))
    secretFindings.push(`${f}: logs a credential-bearing value`);"""
assert old_cred in text, "credential rule"
text = text.replace(old_cred, """  /*
   * An actual credential VALUE reaching a log line, judged on comment- and
   * string-stripped code: a bare `otp`/`password`/`token` identifier in the call,
   * a `${otp}` template hole, or a `.password` property read. This deliberately
   * no longer matches the phrase "password" inside a message string like
   * `console.error('Forgot password error:', error)`, which logs an Error and is
   * exactly what you want in a log.
   */
  const code = codeOnly(t);
  for (const m of code.matchAll(/console\\.(?:log|error|warn|info)\\(([\\s\\S]{0,180}?)\\)\\s*;?/g)) {
    const args = m[1] || "";
    const leaksCredential =
      /\\$\\{[^}]*\\b(otp|password|token|secret|authorization|resumeToken)\\b/i.test(args) ||
      /(^|[^.\\w])(otp|password|plainPassword|newPassword|token|accessToken|refreshToken|secret)\\s*[,)]/.test(args) ||
      /\\.\\s*(password|otp|token|secret)\\b/i.test(args);
    if (leaksCredential) {
      const ln = (t.slice(0, m.index).match(/\\n/g) || []).length + 1;
      secretFindings.push(`${f}:${ln} logs a credential value: ${args.replace(/\\s+/g, " ").slice(0, 70)}`);
    }
  }""", 1)

# the credential/secrets loop now needs the raw text and the stripped code
old_loop = "for (const [f, t] of allServerFiles.map((x) => [rel(x), read(x)])) {\n  if (/jwt\\.sign\\([^)]*,\\s*['\"]/"
assert old_loop in text
text = text.replace(old_loop, "for (const [f, t] of allServerFiles.map((x) => [rel(x), read(x)])) {\n  void t;\n  if (/jwt\\.sign\\([^)]*,\\s*['\"]/", 1)

# 500-leak rule becomes: the boundary guard exists and covers >=500, so the 313
# call sites are actually neutralised rather than listed forever.
old_leak = text[text.index("const leaky = [];"):text.index("check('500 responses do not echo internal error text to the client'", text.index("const leaky = [];")) + len(
    "check('500 responses do not echo internal error text to the client', leaky.length === 0, `${leaky.length} site(s): ${leaky.slice(0, 8).join(' | ')}`);")]
new_leak = '''/*
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
const serverText = boot;
check('the error-surface guard exists', fs.existsSync(surface));
let guardText = '';
if (fs.existsSync(surface)) {
  guardText = read(surface);
  check('it strips internals only for server errors (4xx keeps its message)',
        />=\\s*500|statusCode >= 500/.test(guardText) && /\\berror\\b/.test(guardText));
  check('it keeps detail in development (a guard that blinds the developer gets removed)',
        /isProduction|NODE_ENV/.test(guardText));
  check('and it logs what it removed, so the cause is not lost with the response',
        /console\\.(error|warn)/.test(guardText));
  check('the guard is mounted before the routers',
        serverText.indexOf("errorSurface") > -1 &&
          serverText.indexOf('errorSurface') < (serverText.indexOf("app.use('/api'") >= 0 ? serverText.indexOf("app.use('/api'") : serverText.length));
}'''
text = text.replace(old_leak, new_leak, 1)

# `boot` is read at the end of the file; hoist the read above this rule
if "const boot = read(path.join(SERVER, 'server.js'));" in text:
    text = text.replace("const boot = read(path.join(SERVER, 'server.js'));", "const boot = read(path.join(SERVER, 'server.js'));\nvoid boot;", 1)
SEC.write_text(text)
print('audit rules made precise; leak rule now checks the boundary guard')

# ── the boundary guard itself ─────────────────────────────────────────────────
pathlib.Path("middleware/errorSurface.js").write_text('''import { isProduction } from '../config/authMode.js';

/**
 * The one place that decides what an HTTP error body may contain.
 *
 * This codebase has 300+ sites shaped like
 * `res.status(500).json({ success: false, error: error.message })`. Some of them
 * were written this session and were even the right instinct at the time - a
 * silent 500 is useless to the person staring at it. But the text they forward is
 * Mongoose's own grammar: schema paths (`contactLens.baseCurve`), cast failures
 * naming our types, "Path `seller` is required", and occasionally a fragment of a
 * connection string when a driver throws. That is a free map of the database for
 * anyone who asks, and it is the same class of disclosure as a stack trace in a
 * web response, arrived at one route at a time.
 *
 * Fixing 300 call sites by generated patch is not something I will pretend to
 * review, and a mistake there is invisible until a support ticket. So the fix
 * lives here: the response is intercepted on its way out, internal keys are
 * removed for 5xx, and the real detail is logged server-side under the request id
 * that the customer can already quote.
 *
 * Production only. Outside production the detail stays in the body, because a
 * guard that hides the cause from the developer is a guard that gets deleted
 * within a week - and with reason.
 */
const INTERNAL_KEYS = ['error', 'stack', 'stderr', 'errmsg', 'errInfo'];

/** Values that look like connection strings or credentials even when nested. */
const LEAKY_VALUE = /(mongodb(\\+srv)?:\\/\\/|redis:\\/\\/|postgres(ql)?:\\/\\/|mysql:\\/\\/|\\.mongodb\\.net|Authorization|Bearer\\s+[A-Za-z0-9._-]{10,}|eyJ[A-Za-z0-9_-]{8,}\\.)/;

const scrub = (value, depth = 0) => {
  if (depth > 4 || value === null || value === undefined) return value;
  if (typeof value === 'string') return LEAKY_VALUE.test(value) ? '[internal detail redacted]' : value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (INTERNAL_KEYS.includes(key)) continue;
      out[key] = scrub(v, depth + 1);
    }
    return out;
  }
  return value;
};

export function errorSurface(req, res, next) {
  const original = res.json.bind(res);

  res.json = function sendJson(body) {
    const status = res.statusCode || 200;
    /*
     * Only server errors are rewritten. A 400 carries the reason the caller's
     * input was wrong, which they need and which discloses nothing; blanking
     * those would turn a validation failure into a mystery, which is the opposite
     * of what this file is for.
     */
    if (status >= 500 && isProduction() && body && typeof body === 'object') {
      const detail = INTERNAL_KEYS.map((k) => (body[k] ? `${k}=${String(body[k]).slice(0, 300)}` : null))
        .filter(Boolean)
        .join(' ');
      if (detail) {
        /*
         * Logged, not swallowed. The whole argument for a chokepoint is that the
         * cause still reaches whoever has to fix it - through the log and the
         * request id, not through the internet.
         */
        console.error(
          `[redacted 5xx] ${req.method} ${req.originalUrl || req.path} id=${req.id || req.requestId || '-'} ${detail}`
        );
      }
      const cleaned = scrub(body);
      if (!cleaned.message) {
        cleaned.message =
          status === 503
            ? 'The service is temporarily unable to complete this request.'
            : 'Something went wrong on our side. The details were recorded - quote the request id if you contact support.';
      }
      return original(cleaned);
    }
    return original(body);
  };

  next();
}

export default errorSurface;
''')
print('middleware/errorSurface.js written')

# ── mount it before the routers ───────────────────────────────────────────────
srv = pathlib.Path("server.js"); t = srv.read_text()
assert "errorSurface" not in t, "already mounted"
marker = "app.use(requestContext);"
assert marker in t, "requestContext anchor"
mount = marker + """

/*
 * Installed immediately after the request id exists and before any router, so
 * every 5xx response in the app - including ones no one has written yet - passes
 * through it. See middleware/errorSurface.js for why this is a boundary rather
 * than 300 individual edits.
 */
app.use(errorSurface);"""
srv.write_text(t.replace(marker, mount, 1))
imp = re.search(r"^import \{ requestContext[^;]*;$", srv.read_text(), re.M)
assert imp, "requestContext import anchor"
cur = srv.read_text()
srv.write_text(cur[: imp.end()] + "\nimport { errorSurface } from './middleware/errorSurface.js';" + cur[imp.end():])
b = srv.read_text()
assert "app.use(errorSurface);" in b and "from './middleware/errorSurface.js'" in b
assert b.index("app.use(errorSurface)") < (b.index("app.use('/api'") if "app.use('/api'" in b else len(b))
print("guard mounted before routers, import added")
