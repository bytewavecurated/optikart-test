import crypto from 'node:crypto';

/**
 * Request identity and the minimum operational numbers.
 *
 * The server logged `console.error('Unhandled error:', err)` with nothing
 * joining a log line to the customer who saw the failure, so a support
 * conversation could not find the incident. Each request now carries a short id
 * that appears in the response header, in the error body, and in every log line
 * about that request, so "it failed at 14:02 with code 7f3a9c2b" is a searchable
 * statement instead of a guess.
 *
 * The counters are deliberately in-process and approximate: they answer "is this
 * hurting right now" without pretending to be a metrics system, and the endpoint
 * is admin-only because route names, error counts and slow paths are a map of
 * where the application is weak.
 */

const STARTED_AT = Date.now();
const newId = () => crypto.randomUUID().split('-')[0];

export const metrics = {
  startedAt: STARTED_AT,
  requests: 0,
  byStatusClass: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
  byRoute: new Map(),
  slowest: [],
  lastError: null
};

const SLOW_MS = 1500;
const TOP_ROUTES = 12;

const routeLabel = (req) => {
  const mounted = req.baseUrl || '';
  const matched = req.route?.path;
  // The SPA fallback is `app.get('*')`, so every unknown path would otherwise
  // arrive as a single `GET *` bucket and the numbers would say "this route is
  // hot" about a catch-all. Unmatched requests are bucketed by their own path,
  // with the id-like segments collapsed so 404 probing cannot invent a bucket
  // per guessed url.
  if (matched === '*') {
    const collapse = String(req.path).replace(/\/[0-9a-f]{16,}/gi, '/:id').replace(/\/\d+/g, '/:n');
    return `${req.method} ${collapse.slice(0, 60)}`;
  }
  const path = matched !== undefined ? `${mounted}${matched === '/' ? '' : matched}` : req.path;
  return `${req.method} ${String(path).replace(/\/[0-9a-f]{16,}/g, '/:id').replace(/\/\d+/g, '/:n')}`;
};

export const requestContext = (req, res, next) => {
  const incoming = String(req.headers['x-request-id'] || '').trim();
  // A client-supplied id is kept only if it looks like an id; otherwise a caller
  // could forge a log line to point investigations at the wrong request.
  req.id = /^[A-Za-z0-9_-]{6,64}$/.test(incoming) ? incoming : newId();
  res.setHeader('X-Request-Id', req.id);

  const startAt = process.hrtime.bigint();
  metrics.requests += 1;

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startAt) / 1e6;
    const cls = `${Math.floor(res.statusCode / 100)}xx`;
    if (metrics.byStatusClass[cls] !== undefined) metrics.byStatusClass[cls] += 1;

    // Health checks and static asset traffic would otherwise dominate every
    // aggregate and hide the routes that actually matter.
    const quiet = req.path === '/api/health' || req.path.startsWith('/uploads/');
    if (!quiet) {
      const label = routeLabel(req);
      metrics.byRoute.set(label, (metrics.byRoute.get(label) || 0) + 1);
      if (ms > SLOW_MS) {
        metrics.slowest.push({ at: new Date().toISOString(), route: label, ms: Math.round(ms), id: req.id });
        if (metrics.slowest.length > 25) metrics.slowest.shift();
      }
      if (res.statusCode >= 500) {
        console.error(JSON.stringify({ event: 'request', id: req.id, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms) }));
      }
    }
  });

  next();
};

export const snapshot = () => {
  const routes = [...metrics.byRoute.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_ROUTES)
    .map(([route, count]) => ({ route, count }));
  return {
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    requests: metrics.requests,
    byStatusClass: { ...metrics.byStatusClass },
    errorRate: metrics.requests
      ? Number(((metrics.byStatusClass['5xx'] / metrics.requests) * 100).toFixed(2))
      : 0,
    routes,
    slowRequests: metrics.slowest.slice(-10),
    lastError: metrics.lastError
  };
};

/** Called by the error handler so the most recent failure is quotable. */
export const recordError = (req, err) => {
  metrics.lastError = {
    at: new Date().toISOString(),
    id: req?.id || null,
    method: req?.method,
    path: req?.originalUrl || req?.path,
    message: String(err?.message || err).slice(0, 300),
    stack: String(err?.stack || '').split('\n').slice(0, 4).join(' | ').slice(0, 500)
  };
  return metrics.lastError;
};
