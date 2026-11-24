/**
 * Request-shape guard: NoSQL operator injection, prototype pollution, nested
 * query objects.
 *
 * Three related attacks share one root: JSON and `qs` are happy to deliver
 * STRUCTURES where the handler expects scalars.
 *
 *  - `{ "email": { "$ne": "" } }` in a login body reaches
 *    `User.findOne({ email })` as an operator object and matches everybody.
 *    (Validation blocks the paths that validate; this blocks the paths that
 *    forgot to.)
 *  - `?limit[$gt]=1` arrives through the query-string parser as the SAME kind
 *    of object - list routes never validate query strings and many pass
 *    pieces of `req.query` straight into `find()`.
 *  - `{"__proto__": {...}}` is the qs prototype-pollution family; JSON bodies
 *    die at the parser, but urlencoded bodies go through `qs`.
 *
 * The rule is mechanical and total: no key starting with `$`, no
 * `__proto__`/`constructor`/`prototype` at ANY depth, in `req.body` or
 * `req.query`. A handler that expected `{email}` gets `{}` and answers its
 * own honest "email is required" - refusal, not reinterpretation. Raw-buffer
 * bodies (the payment webhook) are untouched: those bytes belong to Razorpay
 * and are signature-checked at the route.
 *
 * Why `req.query` is REDEFINED rather than mutated: in Express 4 and 5 it is
 * a GETTER that re-parses the query string on every property access, so
 * deleting keys from the object a handler would never see it again. The
 * guard parses once, scrubs the result, and replaces the accessor with the
 * fixed value on this single request. Handlers downstream cannot tell the
 * difference except that hostile shapes are gone.
 */

const FORBIDDEN_KEY = /^\$|^(?:__proto__|constructor|prototype)$/iu;

let droppedTotal = 0;
export const guardStats = () => ({ droppedTotal });

function scrubValue(value, tally, dropObjects) {
  if (value === null || typeof value !== 'object') return value;
  if (dropObjects && !Array.isArray(value)) {
    tally.dropped += 1;
    return undefined; // query mode: a structure where a scalar belongs is hostile wholesale
  }
  if (Array.isArray(value)) {
    const kept = [];
    for (const item of value) {
      const cleaned = scrubValue(item, tally, dropObjects);
      if (cleaned !== undefined) kept.push(cleaned);
    }
    return kept;
  }
  const out = {};
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEY.test(key)) {
      tally.dropped += 1;
      continue;
    }
    const cleaned = scrubValue(value[key], tally, dropObjects);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

/** Clean copy of one parsed map (used by the e2e suite's direct assertions). */
export const scrubbed = (target) => {
  const tally = { dropped: 0 };
  if (!target || typeof target !== 'object' || Buffer.isBuffer(target) || target instanceof Uint8Array)
    return { value: target, ...tally };
  const value = scrubValue(target, tally, false);
  return { value, dropped: tally.dropped };
};

export const mongoGuard = (req, _res, next) => {
  const tally = { dropped: 0 };

  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && !(req.body instanceof Uint8Array)) {
    const cleaned = scrubValue(req.body, tally);
    // body-parser gives a plain writable property: in-place replace keys so
    // anything already holding the reference sees the cleaned shape
    for (const key of Object.keys(req.body)) delete req.body[key];
    Object.assign(req.body, cleaned);
  }

  // eslint-disable-next-line no-unused-vars
  const parsed = req.query; // fire the parser once
  // query strings are scalar plumbing: any object/structure is hostile shape, so
  // (unlike JSON bodies where nested objects are legitimate) whole values go away
  const fixed = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (FORBIDDEN_KEY.test(k)) {
      tally.dropped += 1;
      continue;
    }
    const cleaned = scrubValue(v, tally, true);
    if (cleaned !== undefined) fixed[k] = cleaned;
  }
  Object.defineProperty(req, 'query', { value: fixed, configurable: true, enumerable: true, writable: true });

  if (tally.dropped) {
    droppedTotal += tally.dropped;
    // one structured line per guarded request that actually saw a hostile
    // shape: enough to spot probing, cheap enough to keep forever
    console.warn(
      JSON.stringify({
        event: 'mongo_guard_drop',
        id: req.id || null,
        method: req.method,
        path: req.path,
        keys: tally.dropped,
      })
    );
  }
  return next();
};

export default mongoGuard;
