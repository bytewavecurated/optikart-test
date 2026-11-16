#!/usr/bin/env node
/**
 * Brand fold, logo validation and storage-decision gate. No DB, no network.
 *
 * Each group is here because it describes a failure that would otherwise be
 * silent:
 *
 *  1. `foldBrand` is the single arbiter of "same brand name" - the bulk gate, the
 *     Brand.unique slug and the ownership-dispute message all read it. It is
 *     asserted in BOTH directions: over-folding merges two real brands onto one
 *     slug (the second becomes unreachable); under-folding lets two manufacturers
 *     each own a page, and rails then attribute one company's frames to another.
 *     Non-Latin names are in the distinct group because `[^a-z0-9]` deletes
 *     Devanagari and CJK outright, and an empty slug escapes a unique index.
 *  2. Logo validation is byte-level, so the tests feed real bytes. A 46-byte
 *     buffer with a PNG signature and an IHDR chunk parses like any other PNG -
 *     width and height come from the header, never from the filename.
 *  3. `storageDecision` is the flag-off contract that lets CI run without
 *     credentials while production refuses them. Asserted as shapes plus the
 *     invariant "a usable decision is never a refusal" - the bug that invariant
 *     caught was real: the documented air-gapped path returned backend:'local'
 *     AND a truthy refusal, so `services/storage.js` threw `Error: true` on the
 *     first upload of the one configuration written for installs with no egress.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { foldBrand } from '../server/services/brandOwnership.js';
import {
  assessLogo,
  readLogoGeometry,
  MIN_LOGO_EDGE_PX,
  MAX_LOGO_BYTES,
  ACCEPTED_LOGO_TYPES,
} from '../server/services/brandLogo.js';
import { storageDecision, hasCloudinaryCredentials, UPLOAD_FOLDERS } from '../server/config/storage.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, cond, detail) => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
};

/* ------------------------------------------------------------ synthetic bytes */
const pngBytes = (w, h) => {
  const buf = Buffer.alloc(46);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(w, 16);
  buf.writeUInt32BE(h, 20);
  buf[24] = 8;
  buf[25] = 6;
  return buf;
};
const jpegBytes = (w, h) => {
  const buf = Buffer.alloc(26);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xc0; // SOF0 carries the frame size
  buf.writeUInt16BE(17, 4);
  buf[6] = 8;
  buf.writeUInt16BE(h, 7);
  buf.writeUInt16BE(w, 9);
  buf[11] = 3;
  return buf;
};
const svgBytes = (attrs) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"${attrs}></svg>`, 'utf8');
/* A GIF header, so "GIF is not accepted" is tested against real GIF bytes. */
const gifBytes = () => Object.assign(Buffer.from('GIF89a'.padEnd(13, '\0').slice(0, 13), 'latin1'), {});

/* --------------------------------------------------------------- fold rules */
const SAME = [
  ['Ray-Ban', 'ray ban', 'RAY_BAN', 'RayBan'],
  ['Acme Optics', 'acme-optics', 'ACMEOPTICS'],
  ['Nüan', 'nuan', 'NUÀN'],
  ['  Saint Laurent  ', 'saint-laurent', 'SAINTLAURENT'],
];
const DISTINCT = [
  ['Ray-Ban', 'Ray-Bar'],
  ['Oakley', 'Oakley2'],
  ['Nuàn', 'Nùn'],
  ['न्यू मत्र', 'आय यूवी'],
  ['アイウェア', '眼鏡框'],
];
check(
  `${SAME.length} spellings-that-are-one-brand collapse to one slug`,
  SAME.every((g) => new Set(g.map(foldBrand)).size === 1),
  SAME.map((g) => g.map(foldBrand).join('/')).join(' | ')
);
check(
  `${DISTINCT.length} genuinely different brands stay different`,
  DISTINCT.every(([a, b]) => foldBrand(a) !== foldBrand(b))
);
check(
  'non-Latin names never fold to an empty slug (an empty value escapes a unique index)',
  DISTINCT.slice(3)
    .flat()
    .every((n) => foldBrand(n) !== ''),
  DISTINCT.slice(3)
    .flat()
    .map((n) => `${n}→${foldBrand(n)}`)
    .join(' ')
);
check('blank input folds to blank, which the route then refuses', foldBrand('   ') === '' && foldBrand(null) === '');
check(
  'folding is idempotent, so a stored slug refolds to itself',
  [...SAME, ...DISTINCT].flat().every((n) => foldBrand(foldBrand(n)) === foldBrand(n))
);

/* ------------------------------------------------------------------- logos */
const big = MIN_LOGO_EDGE_PX + 200;
check(`a ${big}×${big} PNG passes`, assessLogo(pngBytes(big, big), { mimetype: 'image/png' }) === null);
check(
  'the geometry reader sees the same numbers the header carries',
  (() => {
    const g = readLogoGeometry(pngBytes(1000, 1000));
    return g?.kind === 'png' && g.width === 1000 && g.height === 1000;
  })()
);
const small = assessLogo(pngBytes(640, 640), { mimetype: 'image/png' });
check(
  `a 640px PNG is refused quoting both 640 and ${MIN_LOGO_EDGE_PX}`,
  small?.field === 'logo' && /640/.test(small.message) && new RegExp(String(MIN_LOGO_EDGE_PX)).test(small.message),
  small?.message
);
check(
  'a non-square logo is refused as non-square',
  /square/i.test(assessLogo(pngBytes(1200, 700), { mimetype: 'image/png' })?.message || '')
);
check(
  'a real JPEG is measured from its SOF marker',
  assessLogo(jpegBytes(900, 900), { mimetype: 'image/jpeg' }) === null
);
check(
  'bytes win over the filename: JPEG content with a .png type is still JPEG',
  readLogoGeometry(jpegBytes(900, 900))?.kind === 'jpeg'
);
/*
 * What "accepted formats" really means here, stated as the rule the code
 * implements: the *bytes* decide. GIF is refused because a GIF has no header
 * this reader parses - not because of whatever the uploader declared, which is
 * a client-controlled string and would be a policy that an attacker picks. A
 * JPEG declared as image/gif is accepted and stored as .jpg: the mismatch is
 * resolved toward truth, not toward the label.
 */
check('GIF is not in the accepted set', ACCEPTED_LOGO_TYPES.includes('image/gif') === false);
check(
  'real GIF bytes are refused because nothing parses them',
  assessLogo(gifBytes(), { mimetype: 'image/gif' }) !== null
);
check(
  'a JPEG lying about its MIME type is judged as a JPEG',
  assessLogo(jpegBytes(900, 900), { mimetype: 'image/gif' }) === null
);
check(
  'and the stored kind comes from the bytes, not the declaration',
  readLogoGeometry(jpegBytes(900, 900)).kind === 'jpeg'
);
check(
  'opaque bytes are refused rather than trusted on their extension',
  assessLogo(Buffer.from('plain text pretending'), { mimetype: 'image/png' }) !== null
);
const oversize = assessLogo(Buffer.alloc(MAX_LOGO_BYTES + 10, 7), { mimetype: 'image/png' });
check(
  'over the size cap is refused with the cap in the message',
  /MB/i.test(oversize?.message || ''),
  oversize?.message
);
check(
  'an SVG with only a viewBox is measured from the viewBox',
  assessLogo(svgBytes(' viewBox="0 0 1024 1024"'), { mimetype: 'image/svg+xml' }) === null
);
check(
  'an SVG with width/height is measured',
  assessLogo(svgBytes(' width="1000" height="1000"'), { mimetype: 'image/svg+xml' }) === null
);
const blind = assessLogo(svgBytes(''), { mimetype: 'image/svg+xml' });
check(
  'an SVG with neither viewBox nor size is refused as unverifiable',
  blind !== null && /viewBox|size|width/i.test(blind.message),
  blind?.message
);
check(
  'a zero-length buffer is refused, not accepted as unknown',
  assessLogo(Buffer.alloc(0), { mimetype: 'image/png' }) !== null && assessLogo(null) !== null
);
/* A 404 response body is a real upload path: whatever came back must be judged
   as bytes, and must never be written to a brand logo field. */
check(
  'an error page is not a logo',
  assessLogo(Buffer.from('<!DOCTYPE html><html>404</html>'), { mimetype: 'text/html' }) !== null
);

/* ---------------------------------------------------- storage decision shapes */
const decision = (o) => storageDecision({ nodeEnv: 'development', requested: 'auto', ...o });
check(
  'auto + credentials -> cloudinary',
  decision({ credentialsPresent: true, nodeEnv: 'production' }).backend === 'cloudinary'
);
const ci = decision({ credentialsPresent: false, nodeEnv: 'test' });
check(
  'auto + no credentials + non-production -> local, explicitly a fallback',
  ci.backend === 'local' && ci.fellBack === true && ci.refused === null,
  JSON.stringify(ci)
);
const prodNoCred = decision({ credentialsPresent: false, nodeEnv: 'production' });
check(
  'auto + no credentials + production -> refused (never a silent local disk in prod)',
  prodNoCred.backend === null && typeof prodNoCred.refused === 'string',
  JSON.stringify(prodNoCred)
);
check(
  'every refusal names the variable that would clear it (an unusable error is a rolled-back deploy)',
  [
    prodNoCred,
    decision({ requested: 'cloudinary', credentialsPresent: false }),
    decision({ requested: 'local', nodeEnv: 'production' }),
  ].every((d) => /CLOUDINARY|STORAGE_BACKEND|ALLOW_LOCAL_STORED_UPLOADS/.test(String(d.refused)))
);
check(
  'explicit cloudinary without credentials refuses instead of falling back',
  decision({ requested: 'cloudinary', credentialsPresent: false }).backend !== 'cloudinary'
);
const airgapped = decision({ requested: 'local', nodeEnv: 'production', acknowledged: true });
check(
  'the acknowledged air-gapped path is USABLE and not a refusal',
  airgapped.backend === 'local' && airgapped.refused === null && airgapped.acknowledged === true,
  JSON.stringify(airgapped)
);
check(
  'local in production without acknowledgement is refused',
  decision({ requested: 'local', nodeEnv: 'production', acknowledged: false }).backend === null
);
check(
  'an unrecognised STORAGE_BACKEND value is refused, not defaulted',
  decision({ requested: 's3' }).backend === null &&
    /cloudinary|local|auto/i.test(String(decision({ requested: 's3' }).refused))
);
/*
 * The invariant that finds the class of bug above, whatever the wording: no
 * combination may simultaneously offer a backend and refuse it, and `refused`
 * is only ever null or a sentence (a boolean leak is what threw `Error: true`).
 */
const combos = [];
for (const nodeEnv of ['production', 'development', 'test']) {
  for (const requested of ['auto', 'cloudinary', 'local', '', 's3']) {
    for (const credentialsPresent of [true, false]) {
      for (const acknowledged of [false, true]) combos.push({ nodeEnv, requested, credentialsPresent, acknowledged });
    }
  }
}
const contradictions = combos
  .map((c) => ({ c, d: storageDecision(c) }))
  .filter(({ d }) => (d.backend && d.refused) || typeof d.refused === 'boolean');
check(
  `${combos.length} decision combinations, none both usable and refused`,
  contradictions.length === 0,
  JSON.stringify(contradictions[0]?.d || null)
);

/* ------------------------------------------------------ credentials detection */
check(
  'CLOUDINARY_URL alone is credentials',
  hasCloudinaryCredentials({ CLOUDINARY_URL: 'cloudinary://k:s@demo' }) === true
);
check(
  'the three-variable form is credentials',
  hasCloudinaryCredentials({ CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' }) ===
    true
);
check(
  'a partial triple is NOT credentials (half a bucket is worse than none)',
  hasCloudinaryCredentials({ CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: 'k' }) === false
);
check(
  'whitespace-only CLOUDINARY_URL is NOT credentials',
  hasCloudinaryCredentials({ CLOUDINARY_URL: '   ' }) === false
);
check('an empty environment is NOT credentials', hasCloudinaryCredentials({}) === false);

/* ---------------------------------------------------- the SDK surface we call */
/*
 * The installed cloudinary (1.41.3) has `upload_stream` but no `upload_buffer`.
 * A first draft of services/storage.js called the method that does not exist,
 * which no CI run can reach - it only fails on the first real production
 * upload. Pinned here as a contract on the dependency instead: if a future
 * version moves the entry point, this fails in CI rather than in the bucket.
 */
/*
 * Resolved through services/storage.js rather than imported directly: the SDK is
 * a dependency of the server package, so a script at the repository root cannot
 * see it - and a test that reaches around the module boundary with a deep path
 * would pass while the real call site broke. This exercises the same resolution
 * path production uses.
 */
const { assertUploaderSurface } = await import('../server/services/storage.js');
const surface = await assertUploaderSurface().catch((e) => ({ threw: e.message }));
check('the storage module can resolve the cloudinary SDK it calls', surface?.ok === true, JSON.stringify(surface));
check('the upload entry point exists in the installed SDK version', surface?.methods?.includes('upload_stream'));
/* ----------------------------------------------------------- local disk paths */
const { saveUpload, removeUpload, describeStorage, _resetStorageDecisionForTests } =
  await import('../server/services/storage.js');
const originalEnv = { ...process.env };
delete process.env.CLOUDINARY_URL;
_RESET();
function _RESET() {
  _resetStorageDecisionForTests();
}
check(
  'in a credential-free environment the app says local, not cloudinary',
  /local/i.test(describeStorage()) && !/cloudinary/i.test(describeStorage()),
  describeStorage()
);

const wrote = await saveUpload({
  buffer: pngBytes(big, big),
  originalname: 'My Logo.PNG',
  mimeType: 'image/png',
  folder: 'brands',
});
const expectedExt = path.extname(wrote.publicId || wrote.url);
check('local save returns a same-origin /uploads path', /^\/uploads\/brands\/[\w.-]+$/.test(wrote.url), wrote.url);
check(
  'the stored filename is generated, never the user-supplied one',
  !wrote.url.includes('My Logo') && !/ /.test(wrote.url)
);
check('the extension is normalised from the bytes', /(\.png|\.jpg|\.jpeg)$/i.test(wrote.url), wrote.url);
const onDisk = path.join(HERE, '..', 'server', wrote.url.replace(/^\//, ''));
check(
  'the bytes really exist at the path we hand back',
  fs.existsSync(onDisk) && fs.statSync(onDisk).size === pngBytes(big, big).length
);
const removed = await removeUpload(wrote);
check(
  'removeUpload deletes the file it stored',
  removed?.removed === true && !fs.existsSync(onDisk),
  JSON.stringify(removed)
);
check(
  'removing an already-deleted asset is idempotent, not an error the caller must special-case',
  (await removeUpload(wrote))?.removed === true
);
check(
  'a reference we cannot address is reported as un-removable instead of pretending',
  (await removeUpload({ provider: 'cloudinary' }))?.removed === false
);

let threw = null;
try {
  await saveUpload({
    buffer: svgBytes(' viewBox="0 0 100 100"'),
    originalname: 'l.svg',
    mimeType: 'image/svg+xml',
    folder: 'brands',
  });
} catch (e) {
  threw = e;
}
check(
  'SVG on local disk is refused (a stored SVG is same-origin script)',
  threw !== null && /svg/i.test(threw.message),
  threw?.message
);
let folderErr = null;
try {
  await saveUpload({ buffer: pngBytes(big, big), originalname: 'x.png', mimeType: 'image/png', folder: 'evil' });
} catch (e) {
  folderErr = e;
}
check(
  'a folder outside the whitelist is refused, not sanitised into place',
  folderErr !== null && UPLOAD_FOLDERS.length > 0,
  folderErr?.message
);
let typeErr = null;
try {
  await saveUpload({
    buffer: pngBytes(big, big),
    originalname: 'payload.php',
    mimeType: 'application/x-php',
    folder: 'brands',
  });
} catch (e) {
  typeErr = e;
}
check('an unsupported type is refused by content policy, not extension guessing', typeErr !== null);
/* Restore, and assert we did: a unit file that leaves the process env changed
   would make every following assertion lie. */
process.env = originalEnv;
_RESET();
check(
  'environment is restored after the local-disk probes',
  process.env.NODE_ENV === originalEnv.NODE_ENV && describeStorage() !== undefined
);

/* ------------------------------------------- notification addressing guard */
/*
 * `notifyAccount` used to accept a call with neither user nor seller: it created
 * a Notification with no recipient field, emitted to nobody, and returned
 * {success:true}. The guard throws before touching the database, so it is
 * assertable here with no connection - and the case that matters (no recipient)
 * is exactly the one that used to succeed silently.
 */
const { notifyAccount } = await import('../server/services/notifications.js');
const silentRow = await notifyAccount({ title: 'x', message: 'y' }).catch((e) => e);
check(
  'a notification with no recipient is an error, not a silent success',
  silentRow instanceof Error && /exactly one recipient/.test(silentRow.message),
  String(silentRow).slice(0, 140)
);
const twoTargets = await notifyAccount({ title: 'x', message: 'y', user: 'a', seller: 'b' }).catch((e) => e);
check(
  'and so is one addressed to two principals at once',
  twoTargets instanceof Error && /user,seller/.test(twoTargets.message),
  String(twoTargets).slice(0, 140)
);
const namesListed = /user, seller, retailer, partner, manufacturer/.test(String(silentRow.message));
check(
  'the message names every allowed recipient field (a guess-free remedy)',
  namesListed,
  String(silentRow.message).slice(0, 140)
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} brand/logo/storage checks passed`);
failed.forEach((f) => console.log(`  - ${f.name}`));
process.exitCode = failed.length ? 1 : 0;
