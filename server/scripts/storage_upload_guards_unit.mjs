#!/usr/bin/env node
/**
 * Two things this file refuses to let happen again.
 *
 * 1. An inventory that reports zero because its field list drifted from the
 *    schema. `storageInventory()` counts the fields in ASSET_FIELDS; if a field
 *    is renamed or a model loses it, the query returns nothing and the page says
 *    "no assets on local disk" with complete confidence. Four of the thirteen
 *    entries in the first draft of that list did not exist
 *    (`ReturnRequest.evidence.images`, `Order.invoiceUrl`,
 *    `PrescriptionVerification.fileUrl`, `LensConfiguration.fileUrl`) and the
 *    only reason I know is that the checker was run against the real schemas
 *    instead of believed. So the map is asserted here, path by path, on every
 *    CI run.
 *
 * 2. A file-naming rule that is enforced in one place and bypassed in another.
 *    Writes used to happen in four places outside the storage service: multer's
 *    disk engine, the returns portal (`${returnId}_${Date.now()}_${originalname}`
 *    - attacker-controlled name, evidence overwrites), the sheet importer (a
 *    temp copy of a manufacturer's price list left in the served directory
 *    forever), the remote-image downloaders (`path.extname(imageUrl) || '.jpg'`
 *    straight from a spreadsheet cell into a directory the browser can reach).
 *    Each is now checked here rather than in prose, because these are exactly the
 *    rules that quietly reappear when someone copies an old handler.
 */
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ASSET_FIELDS, validateAssetFieldMap, classifyAsset, storageInventory } from '../services/storageInventory.js';
import { isDisallowedHost, ownUploadsPath } from '../routes/manufacturer.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'entity-and-storage-unit-secret-value-1234567890';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 170)}` : ''}`);
};

const serverRoot = path.resolve(new URL(import.meta.url).pathname, '..', '..');

/* ------------------------------------------------ 1. the field map matches truth */
let mongo = null;
try {
  /*
   * When the harness hands us a URI, use it exactly as given. Appending a
   * database name to it - which is what this line did - turns
   * `mongodb://localhost:27017/eyewear-platform` into
   * `.../eyewear-platform/storage-guard-unit`, and MongoDB rejects a database
   * name containing '/'. CI caught it in seconds because CI is the one place
   that hands a URI with a path; locally the variable is empty and this file
   * brought up its own server, so the bug was invisible to every run I made
   * before pushing. `entity_ids_unit.mjs` already had the right convention.
   */
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
  } else {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri('storage-guard'));
  }

  const drift = await validateAssetFieldMap();
  check(
    `every one of the ${ASSET_FIELDS.length} inventory fields is a real schema path`,
    drift.length === 0,
    drift.join(' | ') || 'all matched'
  );

  // A deliberately wrong entry must be caught by the same checker, or the
  // passing test above means nothing.
  const { ASSET_FIELDS: live } = await import('../services/storageInventory.js');
  const bogus = { model: 'Product', field: 'documentsThatDoNotExist', kind: 'array', label: 'x' };
  live.push(bogus);
  const caught = await validateAssetFieldMap();
  live.pop();
  check(
    'the checker reports a field that does not exist instead of counting zero',
    caught.some((c) => /documentsThatDoNotExist/.test(c)),
    String(caught[0] || 'NOTHING REPORTED')
  );
  check('and the map is clean again once the bogus entry is removed', (await validateAssetFieldMap()).length === 0);

  /* ---------------------------------------------------- 2. classification */
  const cases = [
    ['/uploads/products/a.png', 'local'],
    ['/uploads/', 'local'],
    ['https://res.cloudinary.com/demo/image/upload/x.jpg', 'remote'],
    ['https://cdn.example.com/img.png', 'remote'],
    ['data:image/png;base64,AAA', 'dataUrl'],
    ['/var/www/private/x.png', 'relative'],
    ['uploads/products/a.png', 'suspect'],
    ['IMG_0001.PNG', 'suspect'],
    ['', 'absent'],
    ['   ', 'absent'],
    ['undefined', 'absent'],
    ['N/A', 'absent'],
  ];
  for (const [value, expected] of cases) {
    const counts = classifyAsset(value).counts;
    check(`classify(${JSON.stringify(value)}) -> ${expected}`, counts[expected] === 1, JSON.stringify(counts));
  }
  const mixed = classifyAsset(['', 'undefined', 'https://cdn/x.png', '/uploads/products/a.png']);
  check(
    'a mixed list is counted per reference, not per row',
    mixed.counts.remote === 1 && mixed.counts.local === 1 && mixed.counts.absent === 2,
    JSON.stringify(mixed.counts)
  );

  /* ------------------------------------------ 3. an inventory that can be run */
  const { default: Product } = await import('../models/Product.js');
  const { default: Brand } = await import('../models/Brand.js');
  const probe = `guard-${Date.now().toString(36)}`;
  await Product.create({
    title: `${probe} frame`,
    brand: 'Ray-Ban',
    category: 'sunglasses',
    price: 100,
    description: 'd',
    gender: 'unisex',
    frameShape: 'round',
    frameType: 'full-rim',
    frameMaterial: 'metal',
    images: [`/uploads/products/${probe}.png`, 'https://cdn.example.com/x.png', 'undefined'],
    productCode: probe,
    modelNumber: probe,
    // Product requires a seller ref; the inventory does not care who owns the
    // row, only what its images point at, so an anonymous ObjectId is honest.
    seller: new mongoose.Types.ObjectId(),
  });
  await Brand.create({
    name: `${probe} Brands`,
    ownerManufacturer: new mongoose.Types.ObjectId(),
    logo: { url: `/uploads/brands/${probe}.png`, provider: 'local', width: 1000, height: 1000, kind: 'png' },
    status: 'pending',
  });
  const inv = await storageInventory({ sampleLimit: 5 });
  const productRow = inv.byField.find((f) => f.model === 'Product' && f.field === 'images');
  check(
    'the inventory finds a local product image we know is there',
    productRow?.references.local >= 1,
    JSON.stringify(productRow?.references)
  );
  check(
    'a bare "undefined" in an image array is absent, not a broken asset',
    (productRow?.references.absent ?? 0) >= 1,
    JSON.stringify(productRow?.references)
  );
  check(
    'every entry of a multi-image row is counted, not just the first (the flattening bug)',
    productRow?.references.remote >= 1 &&
      productRow?.references.local >= 1 &&
      productRow?.references.absent >= 1 &&
      productRow?.references.local + productRow?.references.remote + productRow?.references.absent >= 3,
    JSON.stringify(productRow?.references)
  );
  const three = classifyAsset(['/uploads/a.png', 'https://cdn/b.png', 'undefined']);
  check(
    'three references in one field produce three counts',
    three.counts.local + three.counts.remote + three.counts.absent === 3,
    JSON.stringify(three.counts)
  );
  const brandRow = inv.byField.find((f) => f.field === 'logo.url');
  check(
    'nested sub-document paths are walked, not reported as missing',
    brandRow?.references.local >= 1,
    JSON.stringify(brandRow?.references)
  );
  check(
    'samples identify rows so an operator can act on them',
    inv.samples.length > 0 && inv.samples.every((s) => s.model && s.field && s.id && Array.isArray(s.references)),
    JSON.stringify(inv.samples[0] || null)
  );
  check(
    'totals add up across fields (no double counting, no dropped field)',
    inv.totals.local === inv.byField.reduce((n, f) => n + f.references.local, 0) &&
      inv.totals.remote === inv.byField.reduce((n, f) => n + f.references.remote, 0),
    JSON.stringify(inv.totals)
  );
  check(
    'the page explains what each bucket means before asking for action',
    /lost when the container is replaced/.test(inv.reading.local) && /broken/.test(inv.reading.relative)
  );

  await Product.deleteMany({ title: new RegExp(probe) });
  await Brand.deleteMany({ name: new RegExp(probe) });

  /* -------------------------------------- 4. no module writes user files itself */
  const offenders = [];
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'build', 'uploads', '.git'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(full);
        continue;
      }
      if (!/\.(js|mjs)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, 'utf8');
      if (/\bmulter\s*\(\s*\{[^}]*diskStorage/.test(text))
        offenders.push(`${path.relative(serverRoot, full)}: multer diskStorage`);
      if (/multer\s*\(\s*\{\s*dest/.test(text))
        offenders.push(`${path.relative(serverRoot, full)}: multer dest (writes a temp file)`);
      if (/xlsx\.readFile\s*\(\s*req\.file\.path/.test(text))
        offenders.push(`${path.relative(serverRoot, full)}: reads the sheet from disk`);
      if (/uploads\/\$\{[^\}]*\.filename\}/.test(text))
        offenders.push(`${path.relative(serverRoot, full)}: builds an asset URL from a multer filename`);
      // the service itself is the one place allowed to write; everything else is a leak
      const isStorageModule = /services\/storage\.js$/.test(full);
      if (
        !isStorageModule &&
        /fs\.(writeFileSync| Promises\.writeFile|appendFileSync|createWriteStream)/.test(text.replace(/\s+/g, ' '))
      ) {
        offenders.push(`${path.relative(serverRoot, full)}: writes bytes to disk`);
      }
      if (!isStorageModule && /fs\.writeFileSync\(/.test(text))
        offenders.push(`${path.relative(serverRoot, full)}: fs.writeFileSync`);
    }
  };
  scan(path.join(serverRoot, 'routes'));
  scan(path.join(serverRoot, 'middleware'));
  scan(path.join(serverRoot, 'services'));
  check(
    'no route, middleware or service writes user files to disk any more',
    offenders.length === 0,
    offenders.slice(0, 6).join(' | ')
  );
  check(
    'saveUpload has no default folder, so a mis-wired caller cannot choose the location',
    /function saveUpload\(\{ buffer, originalname, mimeType, folder \}\)/.test(
      fs.readFileSync(path.join(serverRoot, 'services/storage.js'), 'utf8')
    )
  );
  check(
    'the storage service is the single writer',
    /fs\.promises\.writeFile/.test(fs.readFileSync(path.join(serverRoot, 'services/storage.js'), 'utf8'))
  );

  /* --------------------------------------------------- 5. the guards reject */
  const badHosts = [
    ['127.0.0.1', true],
    ['localhost', true],
    ['10.0.0.5', true],
    ['192.168.1.1', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['169.254.169.254', true],
    ['metadata.google.internal', true],
    ['host.docker.internal', true],
    ['0.0.0.0', true],
    ['[::1]', true],
    ['2130706433', true], // decimal 127.0.0.1
    ['intranet.local', true],
    ['images.example.com', false],
    ['cdn.cloudinary.com', false],
    ['8.8.8.8', false],
    ['172.15.0.1', false],
    ['100.64.0.1', true],
    ['example.com', false],
    ['1.1.1.1', false],
  ];
  for (const [host, expected] of badHosts) {
    const got = isDisallowedHost(host);
    check(`host guard ${expected ? 'blocks' : 'allows'} ${host}`, got === expected, `isDisallowedHost=${got}`);
  }

  const { saveUpload, StoragePolicyError } = await import('../services/storage.js');
  const png = (() => {
    const b = Buffer.alloc(46);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
    b.writeUInt32BE(13, 8);
    b.write('IHDR', 12, 'ascii');
    b.writeUInt32BE(900, 16);
    b.writeUInt32BE(900, 20);
    return b;
  })();
  const wrote = await saveUpload({
    buffer: png,
    originalname: '../../etc/passwd.png',
    mimeType: 'image/png',
    folder: 'products',
  });
  check(
    'a traversal filename cannot escape the upload folder',
    /^\/uploads\/products\/[a-f0-9-]+\.png$/i.test(wrote.url),
    wrote.url
  );
  const onDisk = path.join(serverRoot, 'uploads', 'products', path.basename(wrote.url));
  check('the bytes landed at exactly the path returned', fs.existsSync(onDisk));
  /*
   * The self-host case. A bulk sheet is allowed to point at a file this app
   * already stores, and the manifest export hands out absolute URLs such as
   * http://127.0.0.1:3111/uploads/products/x.png - which my first SSRF guard
   * refused, breaking three rows the suites had passing. Loopback is only
   * allowed when the path *is* the uploads directory; every other path on our
   * own host must still be refused, because a guard that stops guarding to make
   * a case pass is decoration.
   */
  process.env.FRONTEND_URL = 'http://localhost:3000';
  const selfCases = [
    ['/uploads/products/a.png', '/uploads/products/a.png', 'relative own file'],
    ['http://127.0.0.1:3111/uploads/products/a.png', '/uploads/products/a.png', 'absolute own host + uploads path'],
    ['http://localhost:3000/uploads/brands/x.png', '/uploads/brands/x.png', 'configured FRONTEND_URL'],
    ['http://example.com/uploads/a.png', null, "someone else's /uploads path is not ours"],
    ['http://127.0.0.1.evil.test/uploads/a.png', null, 'a hostname that only looks like loopback'],
    ['http://127.0.0.1:3111/api/admin/users', 'THROWS', 'our own host, but not an uploaded file'],
    ['http://[::1]:3000/uploads/x.png', '/uploads/x.png', 'IPv6 loopback, bracketed'],
    ['https://cdn.example.com/x.png', null, 'a normal remote image falls through to the fetch path'],
  ];
  for (const [url, expected, why] of selfCases) {
    let got;
    let threw = false;
    try {
      got = ownUploadsPath(url);
    } catch (e) {
      threw = true;
      got = 'THROWS';
    }
    check(`self-upload recognition: ${why}`, got === expected, `${url} -> ${String(got)}${threw ? ' (threw)' : ''}`);
  }

  /*
   * Exhaustive against the whitelist, because `assertFolder` trims leading and
   * trailing slashes before comparing - which is what makes '/products' a
   * legitimate spelling rather than a traversal. Probed directly: 'products',
   * '/products' accepted; '../../etc', 'products/../../secrets', '../uploads',
   * 'products/sub', 'PRODUCTS', '', undefined and null all refused. Case is
   * significant, which is deliberate: the directory names on disk are lowercase,
   * and accepting 'PRODUCTS' would create a second directory that an inventory
   * then reads as an unknown location.
   */
  for (const folder of [
    '../../etc',
    'products/../../secrets',
    '../uploads',
    'products/sub',
    'PRODUCTS',
    'evil',
    '',
    undefined,
  ]) {
    let err = null;
    try {
      await saveUpload({ buffer: png, originalname: 'a.png', mimeType: 'image/png', folder });
    } catch (e) {
      err = e;
    }
    check(
      `folder ${JSON.stringify(folder)} is refused rather than sanitised`,
      err instanceof StoragePolicyError || (err && /folder/i.test(err.message)),
      String(err?.message).slice(0, 90)
    );
  }
  for (const [name, mime] of [
    ['shell.php', 'application/x-php'],
    ['page.html', 'text/html'],
    ['note.txt', 'text/plain'],
    ['x.svg', 'image/svg+xml'],
  ]) {
    let err = null;
    try {
      await saveUpload({ buffer: png, originalname: name, mimeType: mime, folder: 'products' });
    } catch (e) {
      err = e;
    }
    check(
      `${name} is refused while uploads are local`,
      err !== null && (err instanceof StoragePolicyError || /svg|type|origin/i.test(String(err.message))),
      String(err?.message).slice(0, 110)
    );
  }
  await fs.promises.rm(onDisk, { force: true });
  check('cleanup removed the probe file', !fs.existsSync(onDisk));
} catch (error) {
  check(
    'the guard suite ran without an unexpected failure',
    false,
    `${error.message} @ ${(error.stack || '').split('\n')[1] || ''}`
  );
} finally {
  await mongoose.disconnect().catch(() => {});
  if (mongo) await mongo.stop().catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} storage + inventory guard checks passed`);
failed.forEach((f) => console.log(`  - ${f.name}`));
process.exitCode = failed.length ? 1 : 0;
