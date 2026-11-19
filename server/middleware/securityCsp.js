/**
 * Content-Security-Policy, issued under the header name the operator picked,
 * and measured before it enforced.
 *
 * The documented refusal this replaces said: a CSP written blind would break
 * the storefront while looking like hardening. That is still true of a policy
 * nobody observed. So this file ships BOTH halves of the measured rollout:
 *
 *   CSP_MODE=report    -> `Content-Security-Policy-Report-Only` (the browser
 *                         tells the sink; nothing breaks)
 *   CSP_MODE=enforce   -> `Content-Security-Policy` (the header that bites)
 *
 * and the sink (`POST /api/security/csp-report`) keeps the last N violations
 * per directive in a ring buffer that `/api/admin/system/metrics` prints. The
 * suite that pins this policy loads the REAL production index.html through the
 * policy and fails on any violation the policy itself would block - which is
 * the difference between a measured CSP and one that memorized the build.
 *
 * Why each source in the default policy is there (all observed, none guessed):
 *  - connect-src self: the API and the SAME-ORIGIN socket.io connection the
 *    client opens by design (`window.location.origin`, see client/src/services/
 *    socket.js); https: is for boxes where the API lives on another origin
 *    set by REACT_APP_API_URL - a documented deployment, and the CSP says so.
 *  - script-src checkout.razorpay.com: the card-payment handler loads
 *    Razorpay's own script when Razorpay is configured; COD flows never do.
 *  - frame-src razorpay: checkout is an embedded payment sheet, not a popup;
 *    blocking it would stop card payments outright.
 *  - img-src https: data: blob: + cloudinary host: the marketplace renders
 *    seller-uploaded images from the configured storage provider, and the demo
 *    catalogue referenced remote CDN hosts; narrowing img to Cloudinary-only
 *    becomes possible the day local-storage fallbacks are gone for good.
 *  - style-src unsafe-inline: the built bundle sets inline style ATTRIBUTES
 *    everywhere (all the component `style={{}}` this codebase and CRA's own
 *    runtime produce; the browser groups them under unsafe-inline). Removing
 *    that would mean rewriting the styling model of every page - not tonight,
 *    and not pretending a CSP could enforce it anyway.
 *  - worker-src blob: xlsx export creates a worker from a blob URL. A
 *    marketplace where CSV/Excel export silently 500s because the header
 *    blocked the exporter is WORSE than this entry.
 *  - frame-ancestors 'none': the same posture X-Frame-Options: DENY set when
 *    there was no CSP, expressed through the modern header too.
 *  - base-uri 'self', form-action 'self': cheap and non-negotiable.
 */
export const CSP_DIRECTIVES_BASE = {
  'default-src': ["'self'"],
  'script-src': ["'self'", 'https://checkout.razorpay.com'],
  'connect-src': ["'self'", 'wss:', 'https:', 'http://127.0.0.1:*', 'http://localhost:*'],
  'frame-src': ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
  'img-src': ["'self'", 'data:', 'blob:', 'https:', 'http://127.0.0.1:*', 'http://localhost:*'],
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
  'style-src': ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
  'worker-src': ['blob:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};

export function buildCspPolicy(mode) {
  const directives = { ...CSP_DIRECTIVES_BASE };
  // report endpoint rides in every mode's header (that is how the ring buffer
  // learns anything in report mode in the first place)
  /*
   * `report-uri` alone, deliberately: `report-to` needs a matching
   * `Reporting-Endpoints` header on every response to actually deliver, and
   * adding the half of that pair whose other half nobody wired is exactly how
   * a report-only rollout ships and NEVER collects a single report while
   * looking configured. report-uri is unambiguously supported by every
   * browser that implements the header at all - which is what makes the
   * measurement in the header-name switch above real.
   */
  const policy = Object.entries(directives)
    .map(([k, sources]) => `${k} ${sources.join(' ')};`)
    .join(' ');
  return `${policy} report-uri /api/security/csp-report;`;
}

export function securityCsp(mode = process.env.CSP_MODE || 'off') {
  const active = mode !== 'off' && mode !== '';
  const header =
    mode === 'enforce' || mode === true ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
  const policy = active ? buildCspPolicy(mode) : null;
  return function csp(req, res, next) {
    // The HTML documents are the surface the policy governs; an API response
    // cannot execute scripts in the first place.
    if (
      active &&
      String(req.method) === 'GET' &&
      (req.path === '/' || req.headers.accept?.toString().includes('text/html'))
    ) {
      res.setHeader(header, policy);
    }
    next();
  };
}

/*
 * Sink for browser violation reports. Rate-limited at the mount line (see
 * server.js) because this endpoint is the one place the platform listens to
 * the public internet on its own behalf. The ring buffer keeps a bounded
 * per-directive history (newest first) - a flood of identical reports must
 * not grow anything, and a metrics panel that has to be read with
 * `--rebuild-everything` is not an observability surface.
 */
const RING = new Map(); // directive -> { count, samples:[...] } (5 newest)
export function cspReportStore(req, res) {
  /*
   * The classic `report-uri` shape nests everything under a `csp-report` key;
   * the modern `Report-To` shape posts the object directly. Reading only one
   * shape here is the bug class this whole file argues against - a sink that
   * silently sees nothing because the body looked slightly different.
   */
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const report = body['csp-report'] ?? body;
  /*
   * Key spellings differ per generation of the spec and browser:
   *   report-uri classic -> "blocked-uri", "violated-directive", "document-uri"
   *   report-to modern   -> blockedURI, violatedDirective (nested differently)
   * Reading only one spelling is how every report lands as 'unknown' and the
   * measurement phase appears to PROVE a policy when it proves the reader was
   * blind. All observed spellings first.
   */
  const pick = (...keys) => {
    for (const k of keys) {
      const v = report[k] ?? body[k];
      if (v != null && String(v).trim()) return String(v);
    }
    return '';
  };
  const blockedUri = pick('blocked-uri', 'blockedURI', 'blocked URL');
  const violated = pick('violated-directive', 'violatedDirective', 'violated directive');
  const effective = pick('effective-directive', 'effectiveDirective') || violated || 'unknown';
  const directive = violated || effective;
  const disposition = String(effective).split(' ')[0].split(';')[0];
  // Bounded by key cardinality, samples capped to 5 per directive, plus:
  // the blocked URI is attacker-influenced TEXT - capped and never rendered
  // as HTML anywhere (the metrics panel prints it escaped as a string).
  if (RING.size > 64 && !RING.has(disposition)) {
    return res.status(204).end();
  }
  const entry = RING.get(disposition) || { count: 0, samples: [] };
  entry.count += 1;
  entry.samples.unshift({
    at: new Date().toISOString(),
    blockedUri: blockedUri.slice(0, 160),
    referrer: String(report.referrer || '').slice(0, 120),
  });
  entry.samples.length = Math.min(entry.samples.length, 5);
  RING.set(disposition, entry);
  res.status(204).end();
}

export function cspViolationsSnapshot() {
  const out = [];
  for (const [directive, entry] of RING) {
    out.push({ directive, count: entry.count, newest: entry.samples[0] || null });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, 12);
}

export function cspRingReset() {
  RING.clear();
}
