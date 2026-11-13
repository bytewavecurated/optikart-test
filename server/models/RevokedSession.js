import mongoose from 'mongoose';

/**
 * A signed-out session, recorded so its token stops working.
 *
 * Access tokens here are plain bearer JWTs: they are valid until they expire,
 * and nothing could take one away. So "Logout" used to mean "the browser
 * forgets the string" - whoever still held it (another tab, a copy, a shared
 * laptop) kept full access to a console for up to 7 days.
 *
 * TTL index: Mongo deletes each row when `expiresAt` passes, which is the token
 * own expiry. A revoked session can never outlive the token it revokes, so this
 * collection cannot grow without bound and needs no cleanup job.
 */
const revokedSessionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    role: { type: String, default: 'user' },
    revokedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
  },
  { versionKey: false }
);

revokedSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('RevokedSession', revokedSessionSchema);
