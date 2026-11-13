import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import RevokedSession from '../models/RevokedSession.js';

/**
 * Sessions that can actually be ended.
 *
 * Three rules hold this together:
 *
 * 1. Every token carries a `jti`, so there is something to point at when a
 *    session is signed out. Tokens minted before this change have no `jti`;
 *    they are identified by a hash of the token itself, so signing out works
 *    for them too instead of grandfathering an un-revocable credential.
 *
 * 2. Only a hash is stored. The row says "this session is dead", never what it
 *    could say, so a database leak cannot hand anyone a working token.
 *
 * 3. Records disappear at the token expiry (TTL index on RevokedSession). A
 *    revocation list cannot grow forever and an expired token needs no entry.
 */

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

/** Stable identity for a session, preferring the minted `jti`. */
export const sessionKey = ({ decoded, token }) => {
  if (decoded && decoded.jti) return sha256(`jti:${decoded.jti}`);
  return sha256(`tok:${token}`);
};

/**
 * Replace for `jwt.sign` at every login. Keeps the payload the routes already
 * build and adds the session id.
 */
export const signSession = (payload, options = {}) =>
  jwt.sign({ ...payload, jti: crypto.randomUUID() }, process.env.JWT_SECRET, options);

/**
 * True when this bearer token has been signed out.
 *
 * Returns false for anything that is not a verifiable token: that is not this
 * function concern, and the route own middleware already answers 401 for a bad
 * signature. Being conservative here means a malformed header cannot be turned
 * into a way to skip the check.
 */
export const isRevoked = async (authorization) => {
  if (!authorization || !authorization.startsWith('Bearer ')) return false;
  const token = authorization.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return !!(await RevokedSession.findOne({ key: sessionKey({ decoded, token }) }).lean());
  } catch {
    return false;
  }
};

/**
 * Sign the caller of this request out, server-side.
 *
 * Resolves false when there was no usable token. Callers still report success:
 * a logout with nothing to revoke has achieved its goal, and refusing there
 * would leave a client unable to finish signing out.
 */
export const revokeAuthorization = async (authorization, role = 'user') => {
  if (!authorization || !authorization.startsWith('Bearer ')) return false;
  const token = authorization.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return false;
  }

  const key = sessionKey({ decoded, token });
  const expiresAt = new Date((decoded.exp || Math.floor(Date.now() / 1000) + 3600) * 1000);

  // The unique index on `key` makes this insert its own deduplication, so a
  // double logout cannot fail on a duplicate row.
  try {
    await RevokedSession.create({ key, role, expiresAt });
  } catch (error) {
    if (error && (error.code === 11000 || error.name === 'MongoBulkWriteError' || error.name === 'MongoServerError')) {
      await RevokedSession.updateOne({ key }, { $set: { role, revokedAt: new Date(), expiresAt } }).catch(() => {});
    } else {
      throw error;
    }
  }
  return true;
};

/**
 * The response every console expects from `POST .../logout`.
 *
 * Shared because admin, executive, manufacturer, retailer and partner consoles
 * each had their own idea of what signing out means - and four of them had no
 * route at all, so the client called a path that answered 404 and swallowed the
 * error. A logout with nothing to revoke still reports success: the caller has
 * achieved its goal, and failing there would leave a UI unable to finish.
 */
export const logoutHandler = (role) => async (req, res) => {
  try {
    await revokeAuthorization(req.headers.authorization, role);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error(JSON.stringify({ event: 'logout_error', role, message: String(error.message).slice(0, 200) }));
    res.status(500).json({ success: false, message: 'Server error during logout.', error: error.message });
  }
};
