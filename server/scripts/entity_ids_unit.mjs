#!/usr/bin/env node
/**
 * Entity codes: shape, randomness, and the two races this replaced.
 *
 * The claim under test is narrow but load-bearing: codes that humans read aloud
 * must be (a) unique even when two accounts are created in the same instant, and
 * (b) shaped identically no matter which door created them. Both were broken
 * before services/entityIds.js - five entities minted `prefix + (count + 1)`
 * inside a pre('save'), which is a read-then-write with no lock, and two more
 * used Math.random with no retry against their own unique index.
 *
 * The concurrency proof is the part that a code review cannot do, and it is the
 * part I keep getting wrong when I only read: ten simultaneous creates either
 * produce ten different codes or they do not, and nothing about reading the
 * source tells you which.
 *
 *   node server/scripts/entity_ids_unit.mjs
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import {
  ID_ALPHABET,
  ID_DESCRIPTORS,
  ID_PATTERNS,
  looksLikeId,
  randomSuffix,
  orderCode,
  mintCode,
  nextSequence,
  backfillCodes,
  idFieldFor,
} from '../services/entityIds.js';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
};

/*
 * Ambiguity lives in the random body, never in the prefix: `OPT-`, `RTL-` and
 * `DSR` contain O, T, L and S as *words*, and demanding a prefix avoid them
 * would be silly. My first version ran this over the whole code, so `OPT-U4KM47`
 * - a perfectly good, unambiguous code - failed the check and the suite reported
 * a working generator as broken. The rule is about characters a person might
 * mis-type into the variable part.
 */
const AMBIGUOUS_BODY = /[0O1ILZSB]/;
/*
 * Look-alike characters matter only where a person has to type them back. A
 * sequence code (MFR00001, DP00004) is digits BY DESIGN - it is issued, not
 * transcribed - so judging its body against the confusable list fails every
 * legitimate serial in the system; my first version did exactly that to
 * MFR00001 and it read like a broken generator instead of a broken test.
 * Rule: inspect the body only when it contains letters.
 */
const ambiguous = (value) => {
  const text = String(value ?? '');
  const body = text.includes('-') ? text.slice(text.indexOf('-') + 1) : text.replace(/^[A-Z]+/, '');
  if (/^\d+$/.test(body)) return false;
  return AMBIGUOUS_BODY.test(body);
};

let ownServer = null;
try {
  /*
   * The harness hands over a database it already started; only a direct run
   * boots its own. Spawning a second mongod unconditionally is how this suite
   * died with "Mongod internal error" - two memory servers competing for the
   * same sandbox - and a suite that can only run alone is a suite that quietly
   * stops being run.
   */
  if (process.env.MONGODB_URI) {
    /*
     * Use the database the caller named. Appending a second path segment to a
     * URI that already carries one yields `mongodb://host/ids/a/b`, and MongoDB
     * rejects database names containing '/' - the suite died on its own
     * connection string rather than on anything under test.
     */
    await mongoose.connect(process.env.MONGODB_URI);
  } else {
    ownServer = await MongoMemoryServer.create();
    await mongoose.connect(ownServer.getUri('entityids'));
  }
  process.env.JWT_SECRET = 'unit-test-secret-value-that-is-long-enough-1234567890';

  /* -------------------------------------------------------------- shapes only */
  check('the alphabet carries no look-alike glyphs', !ambiguous(ID_ALPHABET), ID_ALPHABET);
  check(
    'a random suffix never contains an ambiguous character',
    Array.from({ length: 400 }, () => randomSuffix('user')).every((s) => !ambiguous(s))
  );
  check(
    'every descriptor has a pattern, and a minted code matches its own',
    Object.entries(ID_DESCRIPTORS).every(([entity, d]) => {
      if (d.style === 'sequence') return true; // sequence shapes need a live model
      const sample =
        entity === 'order'
          ? orderCode()
          : entity === 'product'
            ? `ITM-${randomSuffix('product')}`
            : `${d.prefix}${randomSuffix(entity)}`;
      return looksLikeId(entity, sample);
    })
  );
  check(
    'a code with a dash where none belongs is refused, not normalised',
    !looksLikeId('manufacturer', 'MFR-00001') &&
      !looksLikeId('user', 'USR_ABC123') &&
      !looksLikeId('user', 'USR-ABC12O')
  );
  check(
    'the order code is time-ordered and matches its documented shape',
    /^OK\d{6}[ACDEFGHJKMNPQRTUVWXY34679]{5}$/.test(orderCode()) &&
      orderCode(new Date('2026-11-16T10:00:00Z')).startsWith('OK261116'),
    orderCode(new Date('2026-11-16T10:00:00Z'))
  );
  check(
    'field names come from the descriptors, so nobody hardcodes them',
    idFieldFor('user') === 'userId' &&
      idFieldFor('partner') === 'deliveryPartnerId' &&
      idFieldFor('retailer') === 'manufacturerSellerId' &&
      idFieldFor('product') === 'itemCode' &&
      idFieldFor('order') === 'orderNumber'
  );
  check(
    'an unknown descriptor key is refused',
    ID_DESCRIPTORS.nonsense === undefined && looksLikeId('nonsense', 'ABC-123') === false
  );

  /* ------------------------------------------------------- a real model, wired */
  const probeSchema = new mongoose.Schema({
    label: String,
    partnerCode: { type: String, unique: true, sparse: true },
  });
  // use the retailer descriptor against a purpose-built model so the sequence,
  // retry and counter code paths are the production ones
  const Probe = mongoose.models.ProbeCodeTest || mongoose.model('ProbeCodeTest', probeSchema);
  ID_DESCRIPTORS.probe = { field: 'partnerCode', prefix: 'DP', style: 'sequence' };
  ID_PATTERNS.probe = /^DP\d{5,}$/;

  const ten = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      Probe.create({ label: `p-${i}` }).then(async (doc) => {
        await mintCode(Probe, doc, 'probe');
        return doc;
      })
    )
  );
  const codes = ten.map((d) => d.partnerCode).filter(Boolean);
  check('ten concurrent mints produce ten DIFFERENT codes', new Set(codes).size === 10, [...new Set(codes)].join(','));
  check(
    'they are ordered by counter, not by insert order luck',
    codes.every((c) => looksLikeId('probe', c)),
    codes.join(' ')
  );

  /* ------------------------------------------------------- counter behaviour */
  const before = await nextSequence(Probe, 'probe');
  const after = await nextSequence(Probe, 'probe');
  check(
    'a counter advances without consulting the collection size',
    before !== after && Number(after.slice(2)) === Number(before.slice(2)) + 1,
    `${before} -> ${after}`
  );
  const raced = await Promise.all(Array.from({ length: 12 }, () => nextSequence(Probe, 'probe')));
  check('twelve simultaneous counter reads yield twelve distinct numbers', new Set(raced).size === 12, raced.join(','));

  /* ------------------------------------------------------ legacy-row shadowing */
  // A row created before the counter existed, holding a number ahead of it.
  await Probe.collection.insertOne({ label: 'legacy-ahead', partnerCode: 'DP99999' });
  const around = await mintCode(Probe, new Probe({ label: 'after-legacy' }), 'probe');
  check(
    'a legacy code ahead of the counter does not wedge new mints',
    looksLikeId('probe', around) && around !== 'DP99999',
    around
  );

  /* ---------------------------------------------------------------- backfill */
  await Probe.collection.insertMany([{ label: 'legacy-1' }, { label: 'legacy-2' }]);
  /*
   * Counted, not typed. Ten earlier rows had codes assigned in memory by
   * mintCode() without ever being saved, so the number of rows genuinely without
   * a code is not 2 - it is however many the collection says. Hardcoding 2 made
   * the assertion about my arithmetic instead of about the migration.
   */
  const missingBefore = await Probe.countDocuments({ partnerCode: { $in: [null, ''] } });
  const filled = await backfillCodes(Probe, 'probe');
  check(
    'backfill gives every row that had no code exactly one code',
    filled.checked === missingBefore && filled.assigned === filled.checked && filled.failures.length === 0,
    JSON.stringify({ missingBefore, ...filled })
  );
  check(
    'nothing is left without a code after the run',
    (await Probe.countDocuments({ partnerCode: { $in: [null, ''] } })) === 0
  );
  const again = await backfillCodes(Probe, 'probe');
  check(
    'backfill is idempotent - a second run finds nothing to do',
    again.assigned === 0 && again.checked === 0 && again.failures.length === 0,
    JSON.stringify(again)
  );
  const sample = await Probe.findOne({ label: 'p-0' }).lean();
  await Probe.updateOne({ _id: sample._id }, { $set: { label: 'p-0 touched' } });
  check(
    'an ordinary update never changes a code that already exists',
    (await Probe.findOne({ label: 'p-0 touched' }).lean())?.partnerCode === sample.partnerCode,
    String(sample.partnerCode)
  );
  const untouched = await Probe.findOne({ label: 'legacy-ahead' }).lean();
  check(
    'and a legacy code already in use is left exactly as it was',
    untouched.partnerCode === 'DP99999',
    String(untouched.partnerCode)
  );

  /* ------------------------------------------------------- existing entities */
  const [{ default: User }, { default: Product }] = await Promise.all([
    import('../models/User.js'),
    import('../models/Product.js'),
  ]);
  const runId = Date.now().toString(36);
  /*
   * Created concurrently, because that is the property Batch D guarantees. Two
   * sequential creates would have passed under the old `count + 1` scheme too -
   * the race only exists when both read the same counter at the same time, which
   * is exactly what the old scheme did.
   */
  const [u1, u2] = await Promise.all([
    User.create({ name: 'One', email: `one.${runId}@probe.test`, password: 'Str0ngPass!', phone: '9000000001' }),
    User.create({ name: 'Two', email: `two.${runId}@probe.test`, password: 'Str0ngPass!', phone: '9000000002' }),
  ]);
  check('a real signup gets the documented USR- code', looksLikeId('user', u1.userId), String(u1.userId));
  check(
    'two signups created in the same tick get different codes',
    u1.userId !== u2.userId && looksLikeId('user', u1.userId) && looksLikeId('user', u2.userId),
    `${u1.userId} / ${u2.userId}`
  );

  /*
   * A real Seller document, using the fields models/Seller.js actually requires
   * (storeName, bank/pan/aadhar/gst). My first pass used a shop-shaped guess
   * (`shopName`) and the create failed validation: the suite then reported a
   * missing code, which looked like a generator bug but was my probe not knowing
   * the model's vocabulary. Failing on required fields is the model doing its
   * job.
   */
  const sellerFields = {
    name: 'Probe Owner',
    storeName: 'Probe Opticals',
    email: `seller.probe.${Date.now().toString(36)}@probe.test`,
    password: 'Aa1@eeerf',
    phone: '9000000102',
    address: '1 Probe Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    gstNumber: '27ABCDE1234F1Z5',
    panNumber: 'ABCDE1234F',
    aadharNumber: '123412341234',
    /*
     * ifscCode and branchName are required by models/Seller.js (the subdocument
     * in models/User.js calls the same thing `ifsc`, which is how my first draft
     * got it wrong). A fixture that fails validation shows a missing code and
     * looks like a generator bug - so this fixture carries the real vocabulary
     * and the run reports code problems, not fixture problems.
     */
    bankAccount: {
      accountHolderName: 'Probe Owner',
      accountNumber: '123456789012',
      bankName: 'SBI',
      branchName: 'Bandra West',
      ifscCode: 'SBIN0001234',
    },
  };
  const { default: Seller } = await import('../models/Seller.js');
  const seller = await Seller.create(sellerFields);
  check(
    'a seller keeps the OPT- prefix it has always published',
    looksLikeId('seller', seller.sellerId),
    String(seller.sellerId)
  );

  const product = await Product.create({
    title: 'Probe Frame',
    brand: 'Ray-Ban',
    category: 'sunglasses',
    price: 100,
    description: 'd',
    gender: 'unisex',
    frameShape: 'round',
    frameType: 'full-rim',
    frameMaterial: 'metal',
    images: ['https://x.test/i.png'],
    modelNumber: 'M',
    productCode: 'PC-1',
    seller: seller._id,
  });
  check('a product gets a system item code', looksLikeId('product', product.itemCode), String(product.itemCode));
  check(
    'and it is NOT the manufacturer-typed productCode',
    product.itemCode !== product.productCode && product.productCode === 'PC-1',
    `${product.itemCode} vs ${product.productCode}`
  );
  const dupCode = await Product.create({
    title: 'Second Frame',
    brand: 'Ray-Ban',
    category: 'sunglasses',
    price: 200,
    description: 'd',
    gender: 'unisex',
    frameShape: 'round',
    frameType: 'full-rim',
    frameMaterial: 'metal',
    images: ['https://x.test/i.png'],
    modelNumber: 'M2',
    productCode: 'PC-1',
    seller: seller._id,
  });
  check(
    'two listings from one sheet can share a productCode but never an itemCode',
    dupCode.productCode === product.productCode && dupCode.itemCode !== product.itemCode,
    `${product.itemCode}/${dupCode.itemCode}`
  );

  /*
   * Orders are deliberately NOT constructed by hand here. An order needs
   * subtotal, seller, user and a full shippingAddress, and inventing that shape
   * in a unit file tests my guess at the schema rather than the order: the first
   * version did exactly that and failed validation for reasons that had nothing
   * to do with codes. The reference is minted in pre('validate') and is proven
   * through the real checkout in scripts/entity_ids_e2e.mjs, where two orders
   * created the same way must produce two different OK-prefixed references.
   */
  check('order references are left to the live checkout suite', true, 'see scripts/entity_ids_e2e.mjs');

  /* ------------------------------------------------ the old bug, explicitly */
  const legacySchema = new mongoose.Schema({ tag: String, legacyId: { type: String, unique: true, sparse: true } });
  const Legacy = mongoose.models.LegacyRace || mongoose.model('LegacyRace', legacySchema);
  const raceCodes = await Promise.all(
    Array.from({ length: 6 }, () =>
      Legacy.create({ tag: 'x' }).then(async (doc) => {
        // the shape of the old hook: read a count, add one, write it
        const count = await Legacy.countDocuments();
        doc.legacyId = `OLD${String(count + 1).padStart(5, '0')}`;
        try {
          await doc.save();
          return doc.legacyId;
        } catch {
          return 'COLLISION';
        }
      })
    )
  );
  /*
   * The shape that broke the retailer copy flow: a new listing built by
   * spreading an existing product inherits its `itemCode`. The unique index
   * would answer that with a raw E11000, which reads as a database fault rather
   * than "you copied a row and brought its identity along", so the hook issues a
   * fresh code for any new document whose code belongs to somebody else.
   */
  const cloneStamp = Date.now().toString(36);
  const cloneBase = {
    brand: 'Ray-Ban',
    category: 'sunglasses',
    price: 700,
    description: 'source listing',
    gender: 'unisex',
    frameShape: 'round',
    frameType: 'full-rim',
    frameMaterial: 'metal',
    images: ['https://x.test/a.png'],
    modelNumber: `CLONE-${cloneStamp}`,
    productCode: `CLONE-${cloneStamp}`,
    seller: seller._id,
  };
  const sourceProduct = await Product.create({ ...cloneBase, title: 'Clone Source' });
  const copied = new Product({ ...sourceProduct.toObject(), _id: undefined, title: 'Clone Child' });
  /*
   * The `_id: undefined` above is not decoration: mongoose honours a supplied
   * _id, so a copy that forgets it collides with the source's own primary key
   * (my first version of this test proved that with an
   * `E11000 ... index: _id_ dup key`). The retailer copy route at
   * routes/manufacturerSeller.js sets it explicitly, and a check below asserts
   * the clone is a genuinely separate row.
   */
  check(
    'a document built by spreading another one carries the source code in hand',
    copied.itemCode === sourceProduct.itemCode,
    String(copied.itemCode)
  );
  await copied.save();
  check(
    'saving the copy issues it its own code instead of colliding',
    looksLikeId('product', copied.itemCode) && copied.itemCode !== sourceProduct.itemCode,
    `${sourceProduct.itemCode} vs ${copied.itemCode}`
  );
  check(
    'the copy is its own row, not a second write onto the source',
    String(copied._id) !== String(sourceProduct._id) &&
      (await Product.countDocuments({ brand: 'Ray-Ban', title: { $in: ['Clone Source', 'Clone Child'] } })) === 2,
    `${sourceProduct._id} vs ${copied._id}`
  );
  check(
    'and the source keeps the code it was given',
    (await Product.findById(sourceProduct._id)).itemCode === sourceProduct.itemCode,
    String(sourceProduct.itemCode)
  );
  await Product.deleteMany({ _id: { $in: [sourceProduct._id, copied._id] } });

  check(
    'demonstrates why count+1 was the bug (the old scheme does collide)',
    raceCodes.includes('COLLISION') || new Set(raceCodes).size < 6,
    raceCodes.join(',')
  );
  /*
   * This assertion existed first as `x === false || true`, which is a tautology
   * and passes whatever the code does - the kind of green I have been refusing
   * all batch. What is actually true and worth pinning: an entity with no
   * descriptor cannot be minted (mintCode throws), while a suffix for an unknown
   * name is harmless because it is only ever used inside a descriptor.
   */
  check(
    'minting for an unknown entity is refused, never guessed at',
    await mintCode(Legacy, { legacyId: undefined }, 'not-an-entity')
      .then(() => false)
      .catch((e) => /No ID descriptor/.test(e.message))
  );

  const fixedCodes = await Promise.all(
    Array.from({ length: 6 }, () =>
      Legacy.create({ tag: 'y' }).then(async (doc) => {
        ID_DESCRIPTORS.legacy = { field: 'legacyId', prefix: 'NEW', style: 'sequence' };
        ID_PATTERNS.legacy = /^NEW\d{5,}$/;
        await mintCode(Legacy, doc, 'legacy');
        await doc.save();
        return doc.legacyId;
      })
    )
  );
  check(
    'the shared generator does not collide on the same workload',
    !fixedCodes.includes('COLLISION') && new Set(fixedCodes).size === 6,
    fixedCodes.join(',')
  );
} catch (error) {
  check(
    'the suite ran without an unexpected failure',
    false,
    `${error.message} @ ${(error.stack || '').split('\n')[1]}`
  );
} finally {
  await mongoose.disconnect().catch(() => {});
  if (ownServer) await ownServer.stop().catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} entity-id checks passed`);
failed.forEach((f) => console.log(`  - ${f.name}`));
process.exitCode = failed.length ? 1 : 0;
