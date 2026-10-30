import rateLimit from 'express-rate-limit';

// Authentication endpoints. Successful attempts are not counted so a normal
// user logging in a few times is never blocked; only failures burn quota.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
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
  skip: (req) => req.method === 'GET' || req.path === '/api/health'
});

export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again after 5 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

export const paymentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many payment requests. Please try again after a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
