import rateLimit from 'express-rate-limit';

// The server sets an explicit trusted-hop count (never `true`), so the
// permissive-trust-proxy validation can stay enabled. `xForwardedForHeader` is
// disabled because clients can still send that header in local development,
// which would otherwise log a spurious warning on every request.
const VALIDATE = {
  trustProxy: true,
  xForwardedForHeader: false,
};

// Authentication endpoints. Successful attempts are not counted so a normal
// user logging in a few times is never blocked; only failures burn quota.
/*
 * Attempts are counted against the account being attacked, not the address they
 * came from. Behind an office NAT, a campus or a mobile carrier, an IP-only key
 * lets one person's failed logins block a whole building, and an attacker with
 * many addresses spreads their attempts so no single bucket ever fills.
 *
 * The identifier comes from the request body - nothing else exists at login time.
 * The IP stays as the fall back so a flood that never names an account is still
 * limited.
 */
export const identifyAttempt = (req) => {
  const body = req.body || {};
  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  const phone = String(body.phone || '').replace(/[^0-9]/g, '');
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return `id:${email}`;
  if (phone.length >= 8) return `id:ph${phone.slice(-10)}`;
  return `ip:${req.ip}`;
};

/*
 * Cross-replica counting, on a flag.
 *
 * The limiters are, by default, per-process in-memory. That is CORRECT until
 * someone deploys a second replica, at which point it is quietly WRONG:
 * `max` and every login attempt budget become per-pod, the limits advertises
 * are multiplied by the pod count, and nothing fails loudly to say so - the
 * only symptom is abuse that keeps getting under the threshold.
 *
 * `REDIS_URL` switches every limiter in this file to a shared store. The
 * store CANNOT half-work: if the package is missing or the server is
 * unreachable, construction itself throws with the reason, so booting
 * continues and per-process counting silently replaces what an operator
 * asked for is impossible. Scripts/redis_limiter_store_e2e.mjs pins both
 * failure sentences by driving a live limiter pair through the store the
 * same way express-rate-limit will at request time.
 */
export function redisLimiterStore() {
  const url = process.env.REDIS_URL;
  if (!url) return undefined;
  if (!redisLimiterStore._p) {
    redisLimiterStore._p = (async () => {
      const clientMod = await import('redis').catch(() => {
        throw Object.assign(
          new Error(
            'REDIS_URL is set but the optional `redis` package is not installed: npm i redis, or unset REDIS_URL. The limiter will not quietly run per-process while a shared store was asked for.'
          )
        );
      });
      const { RedisStore } = await import('rate-limit-redis');
      const client = clientMod.createClient({ url });
      await client.connect().catch((e) => {
        throw Object.assign(
          new Error(`limiters refused to boot: REDIS_URL unreachable (${e.message}) - fail-fast by design`),
          { cause: e }
        );
      });
      return new RedisStore({ sendCommand: (...args) => client.sendCommand(args) });
    })();
  }
  return redisLimiterStore._p;
}

export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  store: redisLimiterStore(),
  keyGenerator: identifyAttempt,
  message: {
    success: false,
    message: 'Too many sign-in attempts. Please try again in a few minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: VALIDATE,
  skipSuccessfulRequests: true,
});

// Global API limiter.
//
// A single page view of this app fires dozens of read requests (products per
// section, banners, brands, filters, ...). Counting only non-GET requests and
// using a generous window keeps the protection against abuse without locking
// real users out of browsing the catalogue.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  store: redisLimiterStore(),
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: VALIDATE,
  skip: (req) => req.method === 'GET' || req.path === '/api/health',
});

export const otpLimiter = rateLimit({
  store: redisLimiterStore(),
  windowMs: 5 * 60 * 1000,
  max: 10,
  // Same reasoning as the sign-in limiter: an OTP quota shared by an entire
  // apartment block or office is not a per-person limit at all, and one curious
  // neighbour stops everyone else receiving their code.
  keyGenerator: identifyAttempt,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again after 5 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: VALIDATE,
  skipSuccessfulRequests: true,
});

export const paymentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  // Payment intents are keyed by the signed-in account where one exists, so a
  // busy shared address cannot throttle a shopper mid-checkout.
  keyGenerator: (req) => (req.user ? `id:${req.user._id || req.user.id}` : identifyAttempt(req)),
  message: {
    success: false,
    message: 'Too many payment requests. Please try again after a minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
