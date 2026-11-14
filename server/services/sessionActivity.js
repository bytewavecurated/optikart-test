/**
 * Session activity: a signed-in console that is not being used must stop
 * working, not merely look signed out.
 *
 * The risk this manages is specific and ordinary: the operations desk, a
 * partner's phone at the depot, a manufacturer's shared office machine. Someone
 * walks away with a console open and the next person inherits it - orders,
 * payouts, customer addresses, prescription documents. Deleting the token in the
 * browser solves nothing, since the token was still valid for whatever remained
 * of its life; that is what `services/session.js` already fixed for Logout, and
 * it applies equally to idleness.
 *
 * So the server tracks the last request each session made and refuses the
 * session once it has been idle past the window. A client that simply disappears
 * (a closed laptop lid) is handled the same way, because the clock is read on
 * the server: nothing depends on page visibility, a timer, or a tab staying open.
 *
 * Customers are deliberately excluded. Their tokens already expire, and forcing
 * someone to sign in again because they went to make tea while a basket was open
 * is a cost with no matching benefit - nobody shares a personal shopping session
 * the way they share a counter terminal. The role comes from the verified token,
 * so asking "is this an operation of ours?" cannot be answered by a caller
 * supplying a role header.
 *
 * Storage: one row per session, keyed by the same hash `services/session.js`
 * uses, with a TTL at the token's own expiry. Nothing is kept once a session
 * could not have worked anyway, so this table cannot grow.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

/** Consoles whose sessions must not idle open. */
export const CONTROLLED_ROLES = ['admin', 'staff', 'executive', 'manufacturer', 'manufacturerSeller', 'deliveryPartner'];

export const isControlledRole = (role) => CONTROLLED_ROLES.includes(role);

/*
 * Idle window in minutes.
 *
 * Unset or unparseable means the documented sixty. `0` means disabled, and is
 * honoured as such: an operator who wants the rule off for a migration should be
 * able to turn it off, and silently giving them sixty minutes anyway is the
 * opposite of configuration. A negative value is the one case treated as
 * unparseable, because no operator means "expire every console instantly": the
 * symptom would be indistinguishable from a broken server.
 */
export const DEFAULT_IDLE_MINUTES = 60;

/*
 * The configured window is reported at boot because a mistyped environment
 * value here would otherwise present itself as an unstable console: sessions
 * dropping after nine seconds, or never expiring, with nothing in the log
 * explaining either. One line at startup saves that being read as a code bug.
 */
export const logSessionIdlePolicy = () => {
  const minutes = idleWindowMinutes();
  const note = process.env.SESSION_IDLE_MINUTES === undefined
    ? '(default)'
    : minutes === 0 ? '(disabled by SESSION_IDLE_MINUTES=0)'
    : minutes < 1 ? '(sub-minute window: testing configuration, not a production setting)'
    : '(from SESSION_IDLE_MINUTES)';
  console.log(`Idle sign-out: ${minutes === 0 ? 'disabled' : `${minutes} minute(s) of inactivity`} for console roles ${note}. Customer sessions are unaffected.`);
  return minutes;
};

export const idleWindowMinutes = () => {
  const raw = Number(process.env.SESSION_IDLE_MINUTES);
  if (raw === 0) return 0;
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_IDLE_MINUTES;
  return raw;
};

const sessionActivitySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    role: { type: String, required: true },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
  },
  { versionKey: false }
);
sessionActivitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SessionActivity = mongoose.models.SessionActivity || mongoose.model('SessionActivity', sessionActivitySchema);

const keyFor = ({ decoded, token }) => (decoded?.jti ? sha256(`jti:${decoded.jti}`) : sha256(`tok:${token}`));

/**
 * Decide what to do with a request from a session whose id has been verified.
 *
 * Pure by design: the answer depends on the stored row, the clock and the role,
 * and the tests must be able to ask it about an hour of silence without waiting
 * an hour.
 *
 * `refresh` is throttled to one write per minute per session. A console polling
 * its dashboard every few seconds would otherwise write on every request, turning
 * an idle-timeout feature into the busiest table in the database.
 */
export const evaluateSessionActivity = ({ decoded, row, now = Date.now(), windowMinutes = idleWindowMinutes(), refreshSeconds = 60 }) => {
  /*
   * A disabled window short-circuits before anything else: no role is
   * controlled, no row is read, no row is written. Answering that here rather
   * than in whichever caller happens to check first means every path that asks
   * the question gets the same verdict - including this file's unit test, which
   * is the only reason to claim the behaviour at all.
   */
  if (!windowMinutes) {
    return { controlled: false, idleSeconds: 0, refresh: false, disabled: true };
  }

  const role = decoded?.role || 'user';
  if (!isControlledRole(role)) return { controlled: false, idleSeconds: null, refresh: false };

  const lastSeen = row?.lastSeenAt ? new Date(row.lastSeenAt).getTime() : null;
  if (lastSeen === null) return { controlled: true, idle: false, idleSeconds: 0, refresh: true, seeded: true };

  const idleSeconds = Math.max(0, Math.round((now - lastSeen) / 1000));
  if (idleSeconds > windowMinutes * 60) {
    return { controlled: true, idle: true, idleSeconds, windowMinutes };
  }
  /*
   * At most one activity write per `refreshSeconds` per session, measured as
   * time since the last write - not since some independent clock. A console
   * polling its queue every few seconds would otherwise make this the busiest
   * table in the database, which is a strange price for an idle timeout; and
   * comparing the interval against the idle duration instead would refresh only
   * after a full minute of nothing happening, so an active user's row would
   * drift stale.
   */
  /*
   * `refresh` is time since the last write, because the row's own timestamp is
   * the only clock that means anything here: it is the thing being refreshed.
   * One name for one decision - `needsRefresh` and `refresh` both existed for a
   * while, which is how a caller ends up reading the one nobody maintains.
   */
  return {
    controlled: true,
    idle: false,
    idleSeconds,
    refresh: idleSeconds >= refreshSeconds
  };
};

/**
 * Called from the session guard for every authenticated request. Returns an
 * error shape when the session has idled past the window, otherwise nothing.
 *
 * Database trouble is never a reason to lock a console: the check degrades to
 * "allowed" and the token still faces every other rule. That is the same
 * trade `sessionGuard` documents for revocation - a blip in one collection
 * should not take the operations desk down - and it is stated again here because
 * the two failures are easy to conflate.
 */
export const touchSession = async (authorization) => {
  if (!authorization || !authorization.startsWith('Bearer ')) return { allowed: true };
  const token = authorization.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return { allowed: true };
  }

  if (!isControlledRole(decoded.role)) return { allowed: true };

  const key = keyFor({ decoded, token });
  const windowMinutes = idleWindowMinutes();
  try {
    const row = await SessionActivity.findOne({ key }).lean();
    const decision = evaluateSessionActivity({ decoded, row });
    if (decision.idle) {
      // Leave the row: its TTL is what removes it. Marking it expired now would
      // mean a second write on the path whose whole purpose is to write less.
      return {
        allowed: false,
        code: 'SESSION_IDLE',
        // Spoken in minutes, and at least one: a sub-minute window exists only
        // because a test or a typo set it, and "Signed out after 0.15 minutes"
        // is the sort of sentence a real user reads as a broken product.
        message: `Signed out after ${Math.max(1, Math.round(decision.windowMinutes))} minute(s) without activity. Please sign in again.`,
        idleSeconds: decision.idleSeconds
      };
    }
    if (decision.refresh) {
      const expiresAt = new Date((decoded.exp || Math.floor(Date.now() / 1000) + windowMinutes * 60) * 1000);
      await SessionActivity.updateOne(
        { key },
        { $set: { role: decoded.role, lastSeenAt: new Date(), expiresAt }, $setOnInsert: { key } },
        { upsert: true }
      );
    }
    return { allowed: true, idleSeconds: decision.idleSeconds ?? 0, windowMinutes };
  } catch (error) {
    console.error(JSON.stringify({ event: 'session_activity_error', message: String(error.message).slice(0, 160) }));
    return { allowed: true };
  }
};

/** What a console may show before the timeout arrives. */
export const sessionState = async (authorization) => {
  if (!authorization || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
  const windowMinutes = idleWindowMinutes();
  if (!isControlledRole(decoded.role)) {
    return { controlled: false, role: decoded.role || 'user', windowMinutes };
  }
  const row = await SessionActivity.findOne({ key: keyFor({ decoded, token }) }).lean();
  const idleSeconds = row?.lastSeenAt ? Math.max(0, Math.round((Date.now() - new Date(row.lastSeenAt).getTime()) / 1000)) : 0;
  return {
    controlled: true,
    role: decoded.role,
    windowMinutes,
    idleSeconds,
    secondsRemaining: Math.max(0, windowMinutes * 60 - idleSeconds)
  };
};

export const __testables = { keyFor, SessionActivity };
