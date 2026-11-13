import { isRevoked } from '../services/session.js';

/**
 * One place that rejects signed-out tokens.
 *
 * This is mounted before every /api route rather than inside each role
 * middleware, and the difference matters: the role checks are eleven separate
 * functions, two routes already call `jwt.verify` themselves, and any new route
 * could forget either one. A revoked token that slips through such a gap is
 * invisible - it still looks and behaves exactly like the session it replaced.
 *
 * Requests without a bearer token pass straight through; whether one is
 * required is each route decision, and the messages there are already tuned per
 * role ("This area is for seller accounts...").
 */
const sessionGuard = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) return next();

  try {
    if (await isRevoked(authorization)) {
      return res.status(401).json({
        success: false,
        message: 'This session has been signed out. Please sign in again.',
        code: 'SESSION_REVOKED'
      });
    }
  } catch (error) {
    // If the revocation store cannot be read, requests are not blocked. That is
    // deliberate: a Mongo blip would otherwise 500 the whole storefront, worse
    // than letting an already-signed-out token finish its own in-flight calls.
    // The token is still checked again on the next request.
    console.error(JSON.stringify({ event: 'session_guard_error', id: req.id || null, message: String(error.message).slice(0, 200) }));
  }
  return next();
};

export default sessionGuard;
