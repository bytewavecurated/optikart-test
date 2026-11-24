/**
 * Security event ring (recommendation #6).
 *
 * Guards that refuse and log lines that scroll past are invisible at 3am.
 * This keeps a bounded, newest-first ring of the refusals that MATTER -
 * hostile request shapes, revoked-session use, bad webhook signatures,
 * probe-ceiling hits, PHI refusals - and exposes them ONLY through the
 * admin system endpoint, with an internal counter so a metrics scrape can
 * diff growth without parsing anything.
 *
 * Bounded by construction (never unbounded memory), non-persistent by
 * design (the ring survives one process lifetime; durable alerting belongs
 * to the log pipeline, PRODUCTION-CHECKLIST item 6 - this is the glanceable
 * surface, and its absence from disk is not a missing feature).
 */

const MAX = 200;
const ring = [];
let counted = {};

export const recordSecurityEvent = (type, detail = {}) => {
  if (typeof type !== 'string' || !type) return;
  counted[type] = (counted[type] || 0) + 1;
  ring.unshift({ type, at: new Date().toISOString(), ...detail });
  if (ring.length > MAX) ring.length = MAX;
};

export const securityEvents = () => ({ events: ring.slice(0, 100), counts: { ...counted } });
