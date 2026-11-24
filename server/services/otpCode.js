import crypto from 'node:crypto';

/**
 * OTP codes, stored as keyed digests instead of the code itself.
 *
 * Every principal model carries a six-digit `loginOtp`/`resetOtp` column that
 * used to hold the CODE: any database read - a restore file, a replica with
 * weaker ACLs, a debug dump - handed over a live second factor, and the
 * comparison was a plain `!==`. The column now holds HMAC(code, pepper)
 * scoped to the record id and the field name, so the digest only verifies for
 * that one account and one purpose, and a leaked row cannot be replayed even
 * against the code's own format.
 *
 * Throttling deliberately stays at the ROUTE (otpLimiter is keyed per
 * phone/email via identifyAttempt): the digest protects the at-rest case, the
 * limiter protects the guessing case, and the field's own expiry protects the
 * stale-code case. None of the three is enough alone; together they fail
 * closed.
 */

const pepper = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('OTP digests require JWT_SECRET.');
  return secret;
};

const digest = (code, principalId, field) =>
  crypto
    .createHmac('sha256', pepper())
    .update(`${field}:${String(principalId)}:${String(code)}`)
    .digest('hex');

/** Hash and store a freshly generated code on a mongoose document. */
export const stampOtp = (doc, field, code) => {
  if (!doc?._id) throw new Error('stampOtp needs a persisted document (it has no id yet).');
  doc[field] = digest(code, doc._id, field);
};

/** True when `code` is the still-live value for that document field. */
export const matchOtp = (doc, field, code) => {
  if (!doc) return false;
  const stored = doc[field];
  if (typeof stored !== 'string' || !stored) return false;
  if (typeof code !== 'string' || code.length > 12) return false;
  const mine = Buffer.from(digest(code, doc._id, field), 'hex');
  const theirs = Buffer.from(stored, 'hex');
  return mine.length === theirs.length && crypto.timingSafeEqual(mine, theirs);
};

/** Drop the stored digest (consumed, expired, or delivery failed). */
export const clearOtp = (doc, field) => {
  doc[field] = undefined;
};
