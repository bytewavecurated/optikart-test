#!/usr/bin/env node
/**
 * Brand model invariants, against a real database.
 *
 * Lives under server/scripts because that is where the model's own dependencies
 * resolve, and it needs a connection: three of the four rules this file checks
 * are things Mongo enforces, not JS. They cannot be asserted in a unit test, and
 * they are precisely the rules that keep a storefront honest:
 *
 *  1. A brand cannot be approved with no logo. The routes enforce this today, but
 *     a back-office script, a migration, or the admin page's own save path can
 *     set the field directly - and an "approved" brand rendered as a letter tile
 *     is the failure the customer sees.
 *  2. The unique slug blocks the second spelling. This is what makes one brand
 *     name belong to one manufacturer even when two requests race.
 *  3. Ownership of an approved brand only moves through a recorded transfer.
 *     Otherwise a dispute resolves by whoever writes last.
 *  4. Non-Latin names get distinct slugs. Devanagari and CJK brands must not all
 *     land on one empty slug (or, worse, on the *same* slug as each other).
 *
 * It creates no permanent state: every document it touches is deleted at the end,
 * and the probe names are unique per run so a leftover cannot make CI lie.
 */
import mongoose from 'mongoose';
import Brand from '../../models/Brand.js';
import Manufacturer from '../../models/Manufacturer.js';

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.log('SKIP  MONGODB_URI is not set - run this through scripts/verify.mjs or pass MONGODB_URI');
  process.exit(0);
}

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
};
const oid = () => new mongoose.Types.ObjectId();
const stamp = Date.now().toString(36);

try {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 8000 });

  const owners = [];
  for (const label of ['Probe A', 'Probe B']) {
    /*
     * Manufacturer requires companyName/phone/password. A fixture that omits them
     * fails validation, and the audit's catch-all then reports one uninformative
     * failure instead of thirteen useful ones. The probe has to look like a real
     * account.
     */
    owners.push(
      await Manufacturer.create({
        name: `${label} ${stamp}`,
        email: `${stamp}.${label.replace(/[^a-z0-9]/gi, '')}@probe.test`,
        password: 'ProbeAudit123@',
        phone: '9000000000',
        companyName: `Probe Audit ${label} ${stamp}`,
        brands: [],
      })
    );
  }

  /* 1 ------------------------------------------------ approval needs a mark */
  let noLogoErr = null;
  try {
    await Brand.create({ name: `Unmarked ${stamp}`, ownerManufacturer: owners[0]._id, status: 'approved' });
  } catch (e) {
    noLogoErr = e;
  }
  check(
    'an approved brand with no logo is refused at the model',
    noLogoErr !== null && /logo/i.test(String(noLogoErr.message)),
    String(noLogoErr?.message).slice(0, 120)
  );
  check(
    'and the refusal is a rule, not a 500 (no write happened)',
    (await Brand.countDocuments({ name: `Unmarked ${stamp}` })) === 0
  );

  /* 2 --------------------------------------------- the unique slug blocks */
  const marked = {
    url: '/uploads/brands/whatever.png',
    provider: 'local',
    publicId: 'brands/whatever',
    bytes: 1234,
    width: 1000,
    height: 1000,
    kind: 'png',
  };
  const first = await Brand.create({
    name: `Collide ${stamp}`,
    ownerManufacturer: owners[0]._id,
    logo: marked,
    status: 'pending',
  });
  let secondErr = null;
  try {
    await Brand.create({ name: `collide-${stamp}`, ownerManufacturer: owners[1]._id, logo: marked, status: 'pending' });
  } catch (e) {
    secondErr = e;
  }
  check(
    'a second spelling that folds to the same slug is blocked by the index',
    secondErr !== null && /duplicate key/i.test(String(secondErr.message)),
    String(secondErr?.message).slice(0, 120)
  );
  check(
    'the blocked insert left exactly one record for that name',
    (await Brand.countDocuments({ slug: first.slug })) === 1
  );

  const distinct = await Brand.create({
    name: `Not The Same ${stamp}`,
    ownerManufacturer: owners[1]._id,
    logo: marked,
    status: 'pending',
  });
  check('a genuinely different brand name still gets through', !!distinct._id);

  /* 3 --------------------------------- ownership moves only via a transfer */
  let stealErr = null;
  try {
    const claim = await Brand.findOne({ slug: first.slug });
    claim.ownerManufacturer = owners[1]._id;
    await claim.save();
  } catch (e) {
    stealErr = e;
  }
  check(
    'moving an existing brand to another manufacturer without a record is refused',
    stealErr !== null && /ownership|history/i.test(String(stealErr.message)),
    String(stealErr?.message).slice(0, 140)
  );
  check(
    'and ownership is actually unchanged after the refusal',
    String((await Brand.findOne({ slug: first.slug })).ownerManufacturer) === String(owners[0]._id)
  );

  const approvedNoLogo = new Brand({ name: `Pending ${stamp}`, ownerManufacturer: owners[0]._id, status: 'pending' });
  await approvedNoLogo.save();
  check(
    'a *pending* brand may legitimately have no logo yet (that is what review is for)',
    (await Brand.countDocuments({ slug: approvedNoLogo.slug })) === 1
  );

  /* 4 ------------------------------------------------- non-Latin names */
  const deva = await Brand.create({
    name: 'न्यू मत्र',
    ownerManufacturer: owners[0]._id,
    logo: marked,
    status: 'pending',
  });
  const cjk = await Brand.create({
    name: 'アイウェア',
    ownerManufacturer: owners[0]._id,
    logo: marked,
    status: 'pending',
  });
  check(
    'a Devanagari brand name is stored on its own slug (never blank)',
    deva.slug.length > 0 && deva.slug === 'न्यू मत्र',
    JSON.stringify(deva.slug)
  );
  check(
    'a Japanese brand name keeps its own slug, distinct from the Devanagari one',
    cjk.slug.length > 0 && cjk.slug !== deva.slug,
    JSON.stringify(cjk.slug)
  );
  const latinFold = await Brand.create({
    name: 'NÜAN',
    ownerManufacturer: owners[0]._id,
    logo: marked,
    status: 'pending',
  });
  check(
    'accents fold into their base letters so "NÜAN"/"nuan" are one brand',
    latinFold.slug === 'nuan',
    latinFold.slug
  );
  let nuanAgain = null;
  try {
    await Brand.create({ name: 'nuan', ownerManufacturer: owners[0]._id, logo: marked, status: 'pending' });
  } catch (e) {
    nuanAgain = e;
  }
  check(
    'and the second spelling is the duplicate the index says it is',
    nuanAgain !== null && /duplicate key/i.test(String(nuanAgain.message))
  );

  /*
   * Cleanup is scoped to what this run created, by id. An earlier version ended
   * with `Brand.deleteMany({})`, which is harmless on the harness's isolated
   * database and catastrophic the first time somebody thinks this is a handy
   * script to run against staging. Verification tooling must not be the thing
   * that destroys data.
   */
  const createdIds = [first._id, distinct._id, approvedNoLogo._id, deva._id, cjk._id, latinFold._id].filter(Boolean);
  const removedBrands = await Brand.deleteMany({ _id: { $in: createdIds } });
  const removedOwners = await Manufacturer.deleteMany({ _id: { $in: owners.map((o) => o._id) } });
  check(
    'the audit removes exactly the documents it created',
    removedBrands.deletedCount === createdIds.length && removedOwners.deletedCount === owners.length,
    `brands=${removedBrands.deletedCount}/${createdIds.length} owners=${removedOwners.deletedCount}`
  );
  check('no probe brand survives the run', (await Brand.countDocuments({ slug: { $in: [first.slug, 'nuan'] } })) === 0);
} catch (fatal) {
  check('the invariants audit ran without an unexpected failure', false, fatal.message);
} finally {
  await mongoose.disconnect().catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} brand-model invariant checks passed`);
failed.forEach((f) => console.log(`  - ${f.name}`));
process.exitCode = failed.length ? 1 : 0;
