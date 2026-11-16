import mongoose from 'mongoose';
import crypto from 'node:crypto';

/**
 * Human-readable unique IDs for every account, catalogue entity and reference.
 *
 * Before this module the project had six dialects, which is how it got three
 * defects a user can hit:
 *
 *  1. `MFR`/`DP`/`MFRS`/`EXEC`/`RET` codes were minted as `prefix + (count + 1)`.
 *     Two sign-ups in the same instant read the same count, so they generated the
 *     same ID. `manufacturerId`/`deliveryPartnerId` carry a unique index, so one
 *     of the two registrations died with a duplicate-key error while the person
 *     watching the form saw a generic failure; `executiveId`'s and
 *     `returnId`'s indexes are looser, which is worse - two entities can share an
 *     ID, and support cannot tell which one a quoted code names.
 *  2. `USR-`/`OPT-` used `Math.random().toString(36)` and never retried, with a
 *     look-alike alphabet (0/O, 1/I/L) - these are codes read aloud on the phone.
 *  3. Nothing retried anything. A generated code colliding is rare and
 *     recoverable; a generated code colliding *and reported as a server error* is
 *     what actually happened, because no code path checked for E11000.
 *
 * What is preserved deliberately: every prefix and shape (USR-, OPT-, MFR00001,
 * DP00001, MFRS00001, EXEC00001, RET000001, OK261116ABCDE). Those strings appear
 * in screens, exports and in the tickets people have already filed. Only how they
 * are produced changes.
 *
 * A code is not a credential: it is printed on dashboards and read aloud, so
 * anything that authorises must keep checking the token and `_id`.
 */

/** No 0/O, 1/I/L, 2/Z, 5/S, 8/B - the pairs that die on a phone call. */
export const ID_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';

const BODY_RANDOM = { user: 6, seller: 6, product: 6 };
/*
 * Widths read off the code formats already stored, not chosen here:
 * ManufacturerService.js documents a real `MFRS00001`, so a retailer's width is
 * 5. A pattern that does not match the data it is supposed to describe is a
 * validator that refuses legitimate rows - mine said 6+ for retailers and, if I
 * had left it, every existing shop code would have started failing on save.
 */
const SEQUENCE_WIDTH = { manufacturer: 5, partner: 5, retailer: 5, executive: 5, returns: 6 };

/**
 * One descriptor per entity: which field holds the code, which prefix it uses,
 * and whether the code is a random suffix or an increasing sequence.
 *
 * `field` is the entity's EXISTING field, so no model ends up with two readable
 * identifiers (`uniqueId` beside `userId`), which would mean two answers to
 * "what's your code?" and an argument about which one the screens show.
 */
export const ID_DESCRIPTORS = {
  user: { field: 'userId', prefix: 'USR-', style: 'random' },
  seller: { field: 'sellerId', prefix: 'OPT-', style: 'random' },
  product: { field: 'itemCode', prefix: 'ITM-', style: 'random' },
  manufacturer: { field: 'manufacturerId', prefix: 'MFR', style: 'sequence' },
  partner: { field: 'deliveryPartnerId', prefix: 'DP', style: 'sequence' },
  retailer: { field: 'manufacturerSellerId', prefix: 'MFRS', style: 'sequence' }, // pads to 5 like the codes already in use
  executive: { field: 'executiveId', prefix: 'EXEC', style: 'sequence' },
  returns: { field: 'returnId', prefix: 'RET', style: 'sequence' },
  order: { field: 'orderNumber', prefix: 'OK', style: 'order' },
};

const bytes = (n) => crypto.randomBytes(n);

/** `USR-` + six unambiguous characters. CSPRNG, not Math.random. */
export function randomSuffix(entity) {
  const size = BODY_RANDOM[entity] ?? 6;
  const picks = bytes(size);
  let out = '';
  for (const b of picks) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

/**
 * Codes per entity, for the shape tests and for anything validating an input.
 * USR/OPT/ITM are prefixed with a dash, the sequences and OK have no dash, and
 * OK carries a six-digit date - so there is no single pattern to guess at.
 */
export const ID_PATTERNS = {
  user: /^USR-[ACDEFGHJKMNPQRTUVWXY34679]{6}$/,
  seller: /^OPT-[ACDEFGHJKMNPQRTUVWXY34679]{6}$/,
  product: /^ITM-[ACDEFGHJKMNPQRTUVWXY34679]{6}$/,
  manufacturer: /^MFR\d{5,}$/,
  partner: /^DP\d{5,}$/,
  retailer: /^MFRS\d{5,}$/,
  executive: /^EXEC\d{5,}$/,
  returns: /^RET\d{6,}$/,
  order: /^OK\d{6}[ACDEFGHJKMNPQRTUVWXY34679]{5}$/,
};

export function looksLikeId(entity, value) {
  const pattern = ID_PATTERNS[entity];
  return pattern ? pattern.test(String(value || '')) : false;
}

/**
 * `OK` + yymmdd + five characters, keeping the existing shape: time-sortable
 * references that customers quote, with the sequence-free half doing the
 * collision work. Date stays first because ops read these off a list.
 */
export function orderCode(at = new Date()) {
  const d = at instanceof Date ? at : new Date(at);
  const stamp = [
    String(d.getFullYear()).slice(2),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
  return `OK${stamp}${randomSuffix('order').slice(0, 5)}`;
}

const isDuplicateKey = (error) =>
  error?.code === 11000 ||
  (error?.name === 'MongoServerError' && /duplicate key/i.test(String(error.message))) ||
  /duplicate key/i.test(String(error?.message || ''));

/** Field name for an entity, so routes and tests never hardcode it. */
export const idFieldFor = (entity) => ID_DESCRIPTORS[entity]?.field;

/**
 * The next value of an entity's own counter, atomically.
 *
 * This is the fix for `count + 1`. A document count is a *snapshot* taken before
 * the write, so with two concurrent sign-ups it is the same number twice. A
 * findOneAndUpdate with $inc on a per-model counter document is one atomic
 * operation, which is what makes the sequence race-free without a transaction.
 *
 * It is intentionally durable-but-separate: if a code is generated and the
 * document insert then fails, the number is skipped. A gap in a sequence is a
 * cosmetic cost; a duplicate in one is a support failure. (Re-deriving the
 * counter from `countDocuments()` would reintroduce the race it replaces.)
 */
export async function nextSequence(Model, entity) {
  const counters = Model.db.collection('entityCounters');
  const width = SEQUENCE_WIDTH[entity] ?? 5;
  const raw = await counters.findOneAndUpdate(
    { _id: entity },
    { $inc: { value: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  /*
   * The counter must be read from the operation's result, and the result shape
   * differs by driver: mongoose 7.8 (what this project runs) returns
   * `{ lastErrorObject, value: <document>, ok: 1 }` - so the number is
   * `raw.value.value` - while driver 6 returns the document itself as `raw`.
   *
   * My first version wrote `Number(updated?.value ?? ... ?? 1) || 1`, which read
   * the *document* as a number, produced NaN, and defaulted to 1 - so every
   * entity in the system got `DP00001`, `MFR00001`, ... The harness caught it as
   * twelve identical codes, which is the value of testing the property rather
   * than the example.
   *
   * There is deliberately no default any more. An unreadable counter throws: a
   * sequence that silently restarts at 1 is a duplicate-code machine, and that
   * is precisely the bug this function was written to remove.
   */
  const after = raw && typeof raw === 'object' && raw.value && typeof raw.value === 'object' ? raw.value : raw;
  const value = Number(after?.value);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(
      `entity counter for "${entity}" returned an unreadable value: ${JSON.stringify(raw)?.slice(0, 160)}`
    );
  }
  return `${ID_DESCRIPTORS[entity].prefix}${String(value).padStart(width, '0')}`;
}

/**
 * Mint the entity's code, retrying on collision.
 *
 * Mutates the document in place (Mongoose hooks get the document, not a copy);
 * returns the code. `style` picks the strategy, and both strategies end in the
 * same guarantee: the code assigned is not one that already exists *as this
 * document last tried*, and a collision costs a retry rather than a failed
 * registration. Sequence collisions can still happen if a legacy row already
 * holds a number ahead of the counter, so the loop is shared.
 */
export async function mintCode(Model, doc, entity, { attempts = 8 } = {}) {
  const descriptor = ID_DESCRIPTORS[entity];
  if (!descriptor) throw new Error(`No ID descriptor for entity "${entity}".`);
  const { field, style, prefix } = descriptor;
  if (doc[field]) return doc[field];

  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate =
      style === 'sequence'
        ? await nextSequence(Model, entity)
        : style === 'order'
          ? orderCode()
          : `${prefix}${randomSuffix(entity)}`;

    // Cheap pre-check for the collision that is actually likely (a re-run, a
    // retry after a failed write) - the unique index below is still the
    // authority when two writers pass this line together.
    const taken = await Model.exists({ [field]: candidate });
    if (taken) {
      if (style !== 'sequence') continue;
      // A sequence value shadowed by an older row: take the next number rather
      // than reporting a duplicate, so legacy data cannot wedge new sign-ups.
      const maxNumber = await highestSequenceValue(Model, entity);
      await Model.db
        .collection('entityCounters')
        .updateOne({ _id: entity }, { $set: { value: maxNumber } }, { upsert: true });
      continue;
    }
    doc[field] = candidate;
    return candidate;
  }
  throw new Error(
    `${Model.modelName}: could not allocate a unique ${field} after ${attempts} attempts${lastError ? ` (last: ${lastError})` : ''}.`
  );
}

/** Largest number already in use, so a counter can jump past legacy rows. */
async function highestSequenceValue(Model, entity) {
  const { field, prefix } = ID_DESCRIPTORS[entity];
  const rows = await Model.find({ [field]: { $regex: `^${prefix}\\d+$` } })
    .select(field)
    .lean();
  let max = 0;
  for (const row of rows) {
    const n = Number(String(row[field]).replace(prefix, ''));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/**
 * Install the code hooks on a schema.
 *
 * `pre('validate')` and create-only, and the two choices matter:
 *  - validate (not save), because paths that persist without tripping save hooks
 *    (`insertMany`, `bulkWrite`, partial updates) must still be able to check the
 *    shape of a code that is already set; and the entity's `required`-ish needs
 *    are asserted at validation time, so filling the field after validation would
 *    be too late for any rule that depends on it;
 *  - only for new documents, because an update that finds its code missing would
 *    otherwise mint a second identity mid-flight - and then the code a
 *    manufacturer quoted last month stops naming them. Legacy rows are filled by
 *    backfillCodes() explicitly, which is a decision, not a side effect.
 */
export function installCodes(schema, entity, modelName) {
  /*
   * The model is looked up by name inside the hooks instead of being passed in.
   * That is not style: every registration shape in this repo has to work, and
   * `export default mongoose.models.X || mongoose.model('X', schema)` creates no
   * `X` binding at all - passing a const that does not exist threw
   * "ReferenceError: Manufacturer is not defined" at import time, which killed
   * the process before it could serve a single request.
   */
  const model = () => mongoose.model(modelName);
  const { field } = ID_DESCRIPTORS[entity];
  schema.pre('validate', async function mintOnCreate(next) {
    /*
     * A new document always ends up owning a code of its own. Two cases, not one:
     *  - it has no code at all (the ordinary signup), so we issue one;
     *  - it arrives already carrying a code (a document cloned with
     *    `...other.toObject()`), and that code belongs to the row it was copied
     *    from - issuing a fresh one here is what stops a duplicate reaching the
     *    unique index and surfacing as an E11000 the caller cannot interpret.
     * An existing document being *updated* is never touched, so a code cannot
     * change under a person who quoted it.
     */
    if (!this.isNew) return next();
    const takenByAnother = this[field] ? await model().exists({ _id: { $ne: this._id }, [field]: this[field] }) : null;
    if (!this[field] || takenByAnother) {
      try {
        if (this[field] && takenByAnother) this[field] = undefined;
        await mintCode(model(), this, entity, { force: true });
      } catch (error) {
        return next(error);
      }
    }
    next();
  });

  // Shape only, on any write that has a code: a bad one is refused rather than
  // stored for someone else to discover as a duplicate later.
  schema.pre('validate', async function checkShape(next) {
    const value = this[field];
    if (value && !looksLikeId(entity, value)) {
      return next(
        new Error(
          `${model().modelName}.${field} "${value}" is not a valid ${entity} code (expected shape ${ID_PATTERNS[entity]}).`
        )
      );
    }
    next();
  });
}

/**
 * Backfill codes for documents created before their code existed.
 *
 * Idempotent (the filter selects rows still missing the field), and it reports
 * collisions and failures rather than pretending a partial run succeeded - a
 * legacy entity left with no code is the thing an operator needs to see.
 */
export async function backfillCodes(Model, entity, { limit = 1000 } = {}) {
  const { field } = ID_DESCRIPTORS[entity];
  const missing = await Model.find({ [field]: { $in: [null, ''] } })
    .select('_id')
    .limit(limit)
    .lean();
  let assigned = 0;
  const failures = [];
  for (const row of missing) {
    const doc = await Model.findById(row._id);
    if (!doc) continue;
    try {
      await mintCode(Model, doc, entity);
      // save() would re-run every hook and validator on a legacy row that may be
      // invalid today; $set touches the one field and cannot rewrite history.
      await Model.updateOne({ _id: doc._id }, { $set: { [field]: doc[field] } });
      assigned += 1;
    } catch (error) {
      failures.push({ id: String(doc._id), reason: String(error.message).slice(0, 120) });
    }
  }
  return { checked: missing.length, assigned, failures };
}
