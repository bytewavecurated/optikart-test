import { isProduction } from '../config/authMode.js';

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
const LEAKY_VALUE =
  /(mongodb(\+srv)?:\/\/|redis:\/\/|postgres(ql)?:\/\/|mysql:\/\/|\.mongodb\.net|Authorization|Bearer\s+[A-Za-z0-9._-]{10,}|eyJ[A-Za-z0-9_-]{8,}\.)/;

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
