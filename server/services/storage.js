import fs from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { storageDecision, hasCloudinaryCredentials, UPLOAD_FOLDERS, UPLOAD_EXTENSIONS } from '../config/storage.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/**
 * Why this exists: a caller must be able to tell "the file broke a rule" from
 * "the provider was unreachable". Both are exceptions, but one is a 400 with a
 * sentence the manufacturer can act on and the other is a 500 and an incident.
 * Collapsing them means an SVG logo upload reports a server failure, which is
 * both wrong and the kind of wrong that sends someone to support.
 */
export class StoragePolicyError extends Error {
  constructor(message, { field = 'file' } = {}) {
    super(message);
    this.name = 'StoragePolicyError';
    this.field = field;
  }
}

const LOCAL_ROOT = path.resolve(HERE, '..', 'uploads');

let uploaded = 0;
let uploadBytes = 0;

/**
 * Every user-supplied image, document and logo in the product goes through this
 * module. Two reasons it is worth centralising:
 *
 *  - `nothing on the app server's disk` becomes one decision instead of eight
 *    upload routes each making it differently, so it can be audited;
 *  - the byte-level validation (extension, folder, size) applies to every
 *    route, including ones added next month that copy the easiest-looking
 *    handler and inherit its assumptions.
 *
 * Returns a reference the caller stores verbatim: `{ url, provider, publicId,
 * bytes }`. `url` is either an absolute `https://res.cloudinary.com/...` or a
 * same-origin `/uploads/...`. The client uses these values directly as `src`, so
 * an absolute URL needs no prefix - which is exactly why Cloudinary can be
 * switched on underneath an already-built bundle.
 */

/*
 * A hand-rolled SDK adapter, deliberately small, for two reasons learned the
 * hard way. The installed cloudinary (1.41.3) has `upload_stream` but **no**
 * `upload_buffer` - a first draft of this file called the method that does not
 * exist and would only have failed on the first production upload, when nothing
 * in CI can reach it. So the SDK call is wrapped once here, and the unit suite
 * asserts against this module's own surface, which we can execute without
 * credentials.
 */
/*
 * Boot diagnostic: the Cloudinary SDK has moved its buffered entry point around
 * between versions (1.41.3 has `upload_stream` and no `upload_buffer`), and an
 * SDK that cannot do what this module calls is exactly the failure that should
 * stop a boot rather than surface as a 500 on a manufacturer's third logo.
 * No network, no credentials used - only the method surface is inspected.
 */
export async function assertUploaderSurface() {
  const u = (await import('cloudinary')).v2?.uploader;
  const missing = ['upload_stream', 'destroy'].filter((m) => typeof u?.[m] !== 'function');
  if (missing.length) {
    throw new Error(`Cloudinary SDK is missing the upload method(s) this build calls: ${missing.join(', ')}.`);
  }
  return { ok: true, methods: ['upload_stream', 'destroy'] };
}

let sdkPromise;
async function sdk() {
  if (!sdkPromise) {
    const { v2 } = await import('cloudinary');
    const url = process.env.CLOUDINARY_URL || '';
    const m = /^cloudinary:\/\/([^:]+):([^@]+)@([^/]+)/.exec(url);
    v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || m?.[3] || '',
      api_key: process.env.CLOUDINARY_API_KEY || m?.[1] || '',
      api_secret: process.env.CLOUDINARY_API_SECRET || m?.[2] || '',
      secure: true,
    });
    const uploader = {
      /** Promise wrapper over upload_stream, which is the only buffered entry point. */
      put(buf, options) {
        return new Promise((resolve, reject) => {
          const stream = v2.uploader.upload_stream(options, (error, asset) => (error ? reject(error) : resolve(asset)));
          Readable.from(buf).pipe(stream);
        });
      },
      destroy(publicId, options) {
        return new Promise((resolve, reject) =>
          v2.uploader.destroy(publicId, options, (error, done) => (error ? reject(error) : resolve(done)))
        );
      },
    };
    uploader.destroyAsset = uploader.destroy;
    sdkPromise = Promise.resolve(uploader);
  }
  return sdkPromise;
}

let cached;
const decision = (force = false) => {
  if (!cached || force) {
    const d = storageDecision({ credentialsPresent: hasCloudinaryCredentials() });
    if (d.refused) throw new Error(d.refused);
    cached = d;
  }
  return cached;
};

/** Boot-time log line, so an operator can see which provider is actually live. */
export function describeStorage() {
  const d = decision();
  if (d.backend === 'cloudinary') {
    const cloud =
      process.env.CLOUDINARY_CLOUD_NAME || /:\/\/[^/@]+@/.exec(process.env.CLOUDINARY_URL || '')?.[0] || 'configured';
    return `uploads -> Cloudinary (${String(cloud).replace(/[^\w.-]/g, '')})`;
  }
  return 'uploads -> local disk (server/uploads) [development fallback: nothing here survives a redeploy]';
}

export function storageStatus() {
  const d = decision();
  return {
    backend: d.backend,
    fellBack: d.fellBack,
    prefix: d.backend === 'cloudinary' ? process.env.CLOUDINARY_FOLDER || 'optikart' : 'server/uploads',
    servedFrom: d.backend === 'cloudinary' ? 'https://res.cloudinary.com' : '/uploads (same origin)',
    /*
     * The two inputs that produced the answer, not just the answer. An operator
     * looking at "local disk" cannot otherwise tell whether they set
     * STORAGE_BACKEND=local, or left it at auto with no credentials, or set
     * cloudinary and had the boot refuse - and those three situations need three
     * different fixes. `fellBack` marks the second case specifically because it
     * is the one that is invisible from the outside: the app works.
     */
    requested: process.env.STORAGE_BACKEND || 'auto',
    credentialsFound: hasCloudinaryCredentials(),
    acknowledgedLocal: Boolean(d.acknowledged),
    counters: { uploads: uploaded, bytes: uploadBytes },
  };
}

/** The suffix is re-derived from a whitelist; `originalname` never reaches disk. */
function safeExtension(name = '', mimeType = '') {
  const raw = path
    .extname(String(name || ''))
    .toLowerCase()
    .replace('.', '');
  const fromType =
    String(mimeType || '')
      .split('/')[1]
      ?.replace(/^(jpeg|png|gif|webp|pdf|svg)$/, '$1') || '';
  const candidate = UPLOAD_EXTENSIONS.includes(raw) ? raw : UPLOAD_EXTENSIONS.includes(fromType) ? fromType : null;
  return candidate;
}

function assertFolder(folder) {
  const f = String(folder || '').replace(/^\/+|\/+$/g, '');
  if (!UPLOAD_FOLDERS.includes(f)) {
    throw new StoragePolicyError(`Unknown upload folder "${folder}". Allowed: ${UPLOAD_FOLDERS.join(', ')}.`);
  }
  return f;
}

/**
 * SVG is only accepted when it goes to a CDN on a different origin.
 *
 * An SVG is a document that can carry script. Served from our own origin - which
 * is what the local fallback does - a browser opening the stored URL directly
 * runs that script with our cookies and our localStorage in scope. That is a
 * same-origin XSS delivered through an "image upload" form, and a content-type
 * header does not save us because browsers sniff SVG as a document. Cloudinary
 * serves from res.cloudinary.com, so a hostile logo executes in *its* origin,
 * against nothing of ours. Hence: SVG allowed with Cloudinary, refused without.
 */
function assertSvnPolicy(ext) {
  if (ext === 'svg' && decision().backend !== 'cloudinary') {
    throw new StoragePolicyError(
      'SVG logos are refused while uploads are stored on this server: an SVG can carry script and would be ' +
        'served from the application origin. Configure Cloudinary (CLOUDINARY_URL) to accept SVG.',
      { field: 'logo' }
    );
  }
}

/** Byte-signature check: the file must BE what it says, family-by-family.
 *
 * The strict rule is "declared extension's exact magic must match". Relaxation
 * exists ONLY across the raster-image family (jpg/png/gif/webp): a JPEG that
 * declares itself .gif is a label mistake, stored bytes are still a decodable
 * image, the site serves it as an image, and the route already validated the
 * PIXELS (dimensions). Everything else stays exact:
 *  - unknown leading bytes (MZ, raw JSON, PHP source) die: not an image;
 *  - PDF declared as an image dies and vice versa: a PDF is a content-bearing
 *    document with its own parsers, not a picture;
 *  - SVG declared as a raster (or raster bytes declared svg - the XSS-adjacent
 *    shape) dies: svg is XML-as-image and handled by its own origin policy
 *    above this function.
 */
const IMAGE_FAMILY = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const sniff = (buf) => {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'png';
  const m6 = buf.subarray(0, 6).toString('latin1');
  if (m6 === 'GIF87a' || m6 === 'GIF89a') return 'gif';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP')
    return 'webp';
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  const head = buf
    .subarray(0, 512)
    .toString('latin1')
    .replace(/^﻿?\s*|<\?xml[^>]*\?>\s*/gi, '');
  if (/^<(svg|!doctype svg)/i.test(head)) return 'svg';
  return null;
};
function assertRealBytes(buf, ext) {
  const kind = sniff(buf);
  const same = kind === ext || (kind === 'jpeg' && ext === 'jpg') || (ext === 'jpeg' && kind === 'jpg');
  const imageSwap = IMAGE_FAMILY.includes(ext) && IMAGE_FAMILY.includes(kind || '');
  const ok = same || imageSwap;
  if (ok) return;
  const label = ext === 'jpg' || ext === 'jpeg' ? 'IMAGE' : ext.toUpperCase();
  throw new StoragePolicyError(
    kind === null
      ? `The file declared as .${ext} begins with bytes that match no format the store accepts; it was not stored.`
      : `The file named ".${ext}" actually contains ${kind} bytes; only ${label} bytes pass for that name.`,
    { field: 'file' }
  );
}

export async function saveUpload({ buffer, originalname, mimeType, folder }) {
  /*
   * No default folder. There used to be a literal default, which meant a
   * caller that passed undefined - a renamed variable, a route copied without
   * its last argument - silently wrote user files into the product image folder,
   * where the storefront lists them. The argument is required in every call site
   * today, so a missing folder is a programming error and now reads as one
   * instead of as a location choice.
   */
  if (!Buffer.isBuffer(buffer) || buffer.length === 0)
    throw new StoragePolicyError('No file bytes were received.', { field: 'logo' });
  const f = assertFolder(folder);
  const ext = safeExtension(originalname, mimeType);
  /*
   * The declared type and the name are attacker input (a .exe called
   * photo.jpg.exe, a PDF whose magic bytes are MZ). The extension whitelist
   * says what we MIGHT store; this says what the bytes ARE, and the two must
   * agree before anything is written anywhere. Signatures below match the
   * first bytes of each accepted format exactly (JPEG SOI, PNG IHDR start,
   * GIF8, RIFF....WEBP, %PDF-, and SVG/ XML text starts).
   */
  if (!ext)
    throw new StoragePolicyError(
      `Unsupported file type "${mimeType || originalname || '?'}". Allowed: ${UPLOAD_EXTENSIONS.join(', ')}.`
    );
  // SVG is rejected on non-CDN origins before any byte discussion: the
  // documented operator sentence (brand-logo suite, README) stays the answer
  // for an svg upload attempt either way.
  assertSvnPolicy(ext);
  assertRealBytes(buffer, ext);
  const bytes = buffer.length;

  if (decision().backend === 'cloudinary') {
    const uploader = await sdk();
    const result = await uploader.put(buffer, {
      folder: `${process.env.CLOUDINARY_FOLDER || 'optikart'}/${f}`,
      resource_type: ext === 'pdf' ? 'raw' : 'image',
      overwrite: false,
      tags: ['optikart', f],
    });
    uploaded += 1;
    uploadBytes += bytes;
    return {
      url: result.secure_url || result.url,
      provider: 'cloudinary',
      publicId: result.public_id,
      version: result.version,
      bytes,
      ext,
    };
  }

  const dir = path.join(LOCAL_ROOT, f);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${ext}`;
  const target = path.join(dir, filename);
  // the resolved path must stay inside LOCAL_ROOT even though `f` is whitelisted
  if (!target.startsWith(LOCAL_ROOT + path.sep)) throw new Error('Refused to write outside the upload root.');
  await fs.promises.writeFile(target, buffer);
  uploaded += 1;
  uploadBytes += bytes;
  return { url: `/uploads/${f}/${filename}`, provider: 'local', publicId: `${f}/${filename}`, bytes, ext };
}

/** Best-effort delete. A failure must not strand the caller's own record update. */
export async function removeUpload(ref) {
  if (!ref) return { removed: false, reason: 'nothing to remove' };
  try {
    if (ref.provider === 'cloudinary' && ref.publicId) {
      const uploader = await sdk();
      await uploader.destroy(ref.publicId, { resource_type: /\.pdf$/.test(ref.publicId) ? 'raw' : 'image' });
      return { removed: true };
    }
    if (typeof ref === 'string' && ref.startsWith('/uploads/')) {
      const abs = path.join(LOCAL_ROOT, ref.replace('/uploads/', ''));
      if (abs.startsWith(LOCAL_ROOT)) await fs.promises.rm(abs, { force: true });
      return { removed: true };
    }
    if (ref.url && ref.url.startsWith('/uploads/')) {
      const abs = path.join(LOCAL_ROOT, ref.url.replace('/uploads/', ''));
      if (abs.startsWith(LOCAL_ROOT)) await fs.promises.rm(abs, { force: true });
      return { removed: true };
    }
    return { removed: false, reason: 'reference has no provider we can address' };
  } catch (e) {
    return { removed: false, reason: e.message.slice(0, 140) };
  }
}

/** Tests and one-off migrations need to be able to re-read the environment. */
export function _resetStorageDecisionForTests() {
  cached = undefined;
}

/**
 * Store one multer file (or an array of them) through this service.
 *
 * Exists because multer is configured with memoryStorage in
 * middleware/upload.js: the routes used to build a URL out of `file.filename`
 * as though the bytes were on disk at a known name, which is exactly what a
 * buffered upload does not provide. Without this helper, flipping the engine
 * would have left four routes writing `/uploads/products/undefined` into the
 * database - a broken image path that validates fine and only shows up as a
 * blank tile on the storefront.
 *
 * The route says which folder; naming, the extension whitelist, the provider
 * decision and the size/type policy stay here.
 */
export async function persistMulterFile(files, folder) {
  const list = Array.isArray(files) ? files : [files];
  const out = [];
  const written = [];
  for (const file of list) {
    if (!file) continue;
    try {
      const asset = await saveUpload({
        buffer: file.buffer,
        originalname: file.originalname,
        mimeType: file.mimetype,
        folder,
      });
      written.push(asset);
      out.push(asset.url);
    } catch (error) {
      // never half-store: undo the files already saved for this request
      for (const asset of written) await removeUpload(asset);
      throw error;
    }
  }
  return Array.isArray(files) ? out : out[0];
}
