import rateLimit from 'express-rate-limit';

// The server sets an explicit trusted-hop count (never `true`), so the
// permissive-trust-proxy validation can stay enabled. `xForwardedForHeader` is
// disabled because clients can still send that header in local development,
// which would otherwise log a spurious warning on every request.
const VALIDATE = {
  trustProxy: true,
  xForwardedForHeader: false
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
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').replace(/[^0-9]/g, '');
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return `id:${email}`;
  if (phone.length >= 8) return `id:ph${phone.slice(-10)}`;
  return `ip:${req.ip}`;
};

export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  keyGenerator: identifyAttempt,
  message: {
    success: false,
    message: 'Too many sign-in attempts. Please try again in a few minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: VALIDATE,
  skipSuccessfulRequests: true
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
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: VALIDATE,
  skip: (req) => req.method === 'GET' || req.path === '/api/health'
});

export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  // Same reasoning as the sign-in limiter: an OTP quota shared by an entire
  // apartment block or office is not a per-person limit at all, and one curious
  // neighbour stops everyone else receiving their code.
  keyGenerator: identifyAttempt,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again after 5 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: VALIDATE,
  skipSuccessfulRequests: true
});

export const paymentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  // Payment intents are keyed by the signed-in account where one exists, so a
  // busy shared address cannot throttle a shopper mid-checkout.
  keyGenerator: (req) => (req.user ? `id:${req.user._id || req.user.id}` : identifyAttempt(req)),
  message: {
    success: false,
    message: 'Too many payment requests. Please try again after a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
