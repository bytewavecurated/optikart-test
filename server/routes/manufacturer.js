import { otpBypassAllowed } from '../config/authMode.js';
import { saveUpload, StoragePolicyError } from '../services/storage.js';
import { signSession, logoutHandler } from '../services/session.js';
import { brandOwnersByFoldedName, foldBrand } from '../services/brandOwnership.js';
import {
  missingProductFields,
  describeRequired,
  sheetTextFor,
  pickUploadableFields,
} from '../services/productRequirements.js';
import { brandQueue, decideAsManufacturer } from '../services/listingApproval.js';
import express from 'express';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator';
import Manufacturer from '../models/Manufacturer.js';
import Product from '../models/Product.js';
import ManufacturerSeller from '../models/ManufacturerSeller.js';
import ManufacturerStaff from '../models/ManufacturerStaff.js';
import { describeOtpDelivery, sendOTP } from '../services/email.js';
import multer from 'multer';
import xlsx from 'xlsx';
import { verifyManufacturer } from '../middleware/auth.js';
import { registerProfileRoutes } from './manufacturerProfile.js';

import {
  deleteManufacturerSeller,
  banManufacturerSeller,
  validateBulkUpload,
  getManufacturerPendingProducts,
  updatePendingProduct,
  deletePendingProduct,
} from '../services/manufacturerEnhancements.js';
const router = express.Router();

/* --------------------------------------------------------------------------
 * Supply claims about this brand's products.
 *
 * A shop listing a frame it was never given is invisible to every ordinary
 * check: the price is plausible, the model number is real, the stock count is
 * its own. The only party who can tell is the brand, so this queue is theirs,
 * and the decision they take here is not "may it sell" but "did we supply it" -
 * the platform verifies the listing itself afterwards.
 * ------------------------------------------------------------------------ */
router.get('/listing-requests', verifyManufacturer, async (req, res) => {
  try {
    const queue = await brandQueue(req.manufacturer._id);
    res.json({ success: true, count: queue.length, requests: queue });
  } catch (error) {
    console.error('Brand listing queue error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/listing-requests/decide', verifyManufacturer, async (req, res) => {
  try {
    const { listingKind, listingId, decision, reason } = req.body || {};
    const result = await decideAsManufacturer({
      listingKind,
      id: listingId,
      decision,
      reason,
      actorLabel: req.manufacturer.name || 'brand',
      brandId: req.manufacturer._id,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Brand listing decision error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/*
 * Ends this session server-side. Without it, signing out only discarded the
 * token in one browser, and any other copy of that string kept working until it
 * expired on its own. See services/session.js.
 */
router.post('/logout', verifyManufacturer, logoutHandler('manufacturer'));
/**
 * Copy remote image links into our own store.
 *
 * Manufacturer sheets carry image URLs. Left as-is, a dead third-party link
 * breaks a live listing, so each URL is fetched once and served from our own
 * uploads directory; anything that cannot be fetched fails the import loudly
 * rather than publishing a broken product.
 */
const IMAGE_HOSTS_ALLOW = /\.(jpe?g|png|webp|gif|avif|svg)$/i;
/*
 * The URL forms that mean "a file this app already stores", for both the
 * relative and absolute spelling.
 *
 * Host matching is done on the *hostname*, never on a substring of the URL, so
 * `http://127.0.0.1.evil.test/uploads/...` cannot borrow our own-host allowance:
 * its hostname is `127.0.0.1.evil.test`, which is not in the set. Ports are
 * ignored on purpose (the app is behind a proxy, a dev server, or a container
 * and the port differs between them) and the path must start with the uploads
 * directory rather than merely contain it.
 */
const OWN_UPLOAD_PREFIX = '/uploads/';
const localHostnames = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/** Returns the canonical relative /uploads path, or null. */
export function ownUploadsPath(value) {
  const text = String(value || '').trim();
  if (text.startsWith(OWN_UPLOAD_PREFIX)) return text;
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  const isSelf = localHostnames.has(host) || host === '127.0.0.1' || host.endsWith('.localhost');
  // FRONTEND_URL / PUBLIC_URL, when configured, is also "us".
  const configured = [process.env.FRONTEND_URL, process.env.PUBLIC_URL, process.env.APP_URL]
    .filter(Boolean)
    .some((base) => {
      try {
        return new URL(base).hostname === parsed.hostname;
      } catch {
        return false;
      }
    });
  if (!isSelf && !configured) return null;
  if (!parsed.pathname.startsWith(OWN_UPLOAD_PREFIX)) {
    throw new Error(
      `"${text}" is this server's own address but not an uploaded file, and the app will not fetch itself.`
    );
  }
  return parsed.pathname;
}

/*
 * Guards for storeRemoteImages(). Kept next to its caller because they exist
 * only for it; the behaviour is asserted by
 * server/scripts/storage_upload_guards_unit.mjs so a future edit cannot quietly
 * narrow the rule.
 */
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/,
  /^\[::\]/,
  /^169\.254\.169\.254$/, // cloud provider metadata
  /^metadata\.google.internal$/i,
  /^host\.docker\.internal$/i,
  /^\[::1\]$/,
  /^100\.\d+\.\d+\.\d+$/, // carrier-grade NAT range often used by internal balancers
];
const LOCAL_TLDS = /\.local$/i;

/** True when the hostname refers to this machine or its private network. */
export const isDisallowedHost = (hostname) => {
  const h = String(hostname || '').replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (LOCAL_TLDS.test(h)) return true;
  if (/^0\.0\.0\.0$/.test(h)) return true;
  // A literal IPv6 loopback/unspecified, and any decimal/octal trick form of
  // loopback (e.g. 2130706433 == 127.0.0.1) is refused by requiring dotted
  // decimal to fall in a public range.
  if (/^\d+$/.test(h)) {
    const n = Number(h);
    if (!Number.isFinite(n)) return true;
    if (n >= 0 && n <= 0x7f000000 + 0x00ffffff) {
      // anything resolving into 0.0.0.0/127.255.255.255 is loopback-adjacent
      if (n <= 0x7fffffff) return true;
    }
    return false;
  }
  return PRIVATE_HOST_PATTERNS.some((re) => re.test(h));
};

class DisallowedRedirectError extends Error {
  constructor(target) {
    super(`"${target}" redirected to an address inside this server's own network, which the app will not fetch.`);
    this.name = 'DisallowedRedirectError';
  }
}

/**
 * fetch() that re-checks every redirect hop.
 *
 * `redirect: 'follow'` on a user-supplied URL means the first host we approved
 * chooses the second one, which is how an SSRF guard that only looks at the
 * input is bypassed with a 302.
 */
export async function fetchSameOriginGuarded(url, { maxHops = 4, ...init } = {}) {
  let current = String(url);
  for (let hop = 0; hop <= maxHops; hop += 1) {
    const parsed = new URL(current);
    if (!/^https?:$/.test(parsed.protocol) || isDisallowedHost(parsed.hostname)) {
      if (hop === 0) throw new Error('refused: host is not publicly reachable');
      throw new DisallowedRedirectError(current);
    }
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) return res;
      current = new URL(location, parsed).toString();
      continue;
    }
    return res;
  }
  throw new Error('too many redirects while fetching an image URL');
}

const storeRemoteImages = async (urls = [], ownerHint = 'manufacturer', subdir = 'products') => {
  const fsMod = await import('fs');
  const pathMod = await import('path');
  const dirMod = await import('url');
  const out = [];
  for (const raw of urls) {
    const url = String(raw || '').trim();
    if (!url) continue;
    /*
     * "This app's own stored file" is a legitimate answer in a sheet, and it has
     * always been accepted in its relative form (`/uploads/products/x.png`, e.g.
     * copied out of the media picker). The absolute spelling of the same thing -
     * `http://127.0.0.1:3111/uploads/products/x.png` - was rejected by the SSRF
     * guard added in this batch, which broke three passing rows in the suites:
     * the manifest export produces absolute self-URLs, so a manufacturer
     * round-tripping their own catalogue through the bulk sheet got "points at
     * an address inside this server's own network". That is my guard mistaking
     * *our own served files* for an internal service.
     *
     * So: recognise both spellings of our own uploads before the network guard,
     * and reuse the path instead of fetching it. Deliberately restricted to the
     * `/uploads/` prefix on our own host - any other path on loopback stays
     * refused, because `http://127.0.0.1:3111/api/admin/users` is exactly what
     * an SSRF attempt looks like, and a fix that stops guarding to make a test
     * pass is not a fix.
     */
    const asUploadedPath = ownUploadsPath(url);
    if (asUploadedPath) {
      out.push(asUploadedPath);
      continue;
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`"${url}" is not a valid image URL`);
    }
    if (!/^https?:$/.test(parsed.protocol)) throw new Error(`"${url}" is not an http(s) URL`);
    /*
     * The extension check used to reject any URL whose path ended without
     * `.jpg`/`.png`, which refused image hosts that carry the transform in the
     * path tail or the query string (`…/seed/x/800/800`, `…?format=jpg`,
     * signed CDN URLs) - and the error told the brand the link "does not point
     * at an image file" when it pointed at one perfectly well.
     *
     * The content type is the actual evidence, so the request answers that
     * question instead, and the stored extension comes from it. A path
     * extension is still used first when present, since it is the more specific
     * hint and keeps existing sheets producing the same filenames.
     */
    const extMatch = parsed.pathname.match(IMAGE_HOSTS_ALLOW);

    /*
     * Server-side fetch of a URL that arrived in a spreadsheet, which is the
     * definition of an SSRF surface: with no guard, a sheet row could point at
     * the metadata endpoint of the cloud account, at a database or admin port on
     * an internal address, and the response body would be written out as an
     * "image" whose content-type was checked but whose *origin* never was.
     * redirect:'follow' made it worse, because an allowed host could bounce to a
     * forbidden one.
     *
     * So: reject any host that is a loopback/private/link-local name or literal,
     * and follow redirects by hand so every hop passes the same test rather than
     * only the first one. Image CDNs and ordinary public hosts are unaffected.
     */
    if (isDisallowedHost(parsed.hostname)) {
      throw new Error(
        `"${url}" points at an address inside this server's own network, which the app will not fetch. ` +
          'Use a public image URL.'
      );
    }
    let res;
    try {
      res = await fetchSameOriginGuarded(url, { signal: AbortSignal.timeout(15000) });
    } catch (e) {
      if (e && e.name === 'DisallowedRedirectError') throw e;
      throw new Error(`could not download ${url}: ${e.message}`);
    }
    if (!res.ok) throw new Error(`could not download ${url} (HTTP ${res.status})`);

    const type = String(res.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const TYPE_EXT = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/avif': '.avif',
      'image/gif': '.gif',
    };
    if (!TYPE_EXT[type]) {
      throw new Error(
        `"${url}" did not return an image (content-type "${type || 'unknown'}"). ` +
          'Use a direct link to the image file, not a page that shows it.'
      );
    }
    const ext = extMatch ? extMatch[0] : TYPE_EXT[type];

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error(`${url} returned no data`);
    if (buf.length > 8 * 1024 * 1024) throw new Error(`${url} is larger than 8 MB`);

    /*
     * The bytes used to be written here by hand, with `subdir` interpolated
     * straight into a path built from __dirname. `subdir` is a parameter, so a
     * caller (or a future one) that passed '../..' walked out of uploads - and
     * even without that, this is the second place in the app that wrote user
     * files to this container's disk whatever the deployment was configured to
     * do, outside the folder whitelist and outside the inventory that reports
     * what is stored where.
     *
     * saveUpload() now owns all of it: a whitelisted folder, a generated name
     * that no caller can influence, the extension decided by a list rather than
     * by string concatenation, and the Cloudinary-or-local decision in one
     * place. `/uploads/...` early-returns above are untouched, because those are
     * already this app's own stored assets.
     */
    const asset = await saveUpload({ buffer: buf, originalname: `remote${ext}`, mimeType: type, folder: subdir });
    out.push(asset.url);
  }
  return out;
};

/*
 * Sheet cells and form fields carry the size printed on the temple
 * (52-17-140), while the schema keeps a coarse bucket. Derive the bucket from the
 * lens width and keep the measurement in dimensions, rather than rejecting a
 * manufacturer's own numbers with an enum error.
 */
const FRAME_SIZE_BUCKETS = [
  ['extra-large', 59],
  ['large', 55],
  ['medium', 51],
];
/*
 * The schema lists frameShape/frameType/... as enumerations, and a manufacturer's
 * spreadsheet spells them however the shop spells them ("Square", "Full Rim",
 * "cat eye"). Comparing case-insensitively and with separators removed accepts the
 * word the shop wrote instead of failing the row on punctuation, but a value that
 * matches nothing is reported as that row's problem rather than thrown as a 500
 * that loses the whole file.
 */
const ENUM_ALIASES = {
  frameShape: 'frameShape',
  frameType: 'frameType',
  frameMaterial: 'frameMaterial',
  gender: 'gender',
};

const enumsOf = (Model, path) => Model.schema.path(path)?.options?.enum || [];

const matchEnum = (Model, path, value) => {
  const allowed = enumsOf(Model, path);
  const raw = String(value ?? '').trim();
  if (!raw) return { value: raw, unknown: false };
  if (allowed.includes(raw)) return { value: raw, unknown: false };
  const loose = raw.toLowerCase().replace(/[\s_-]/g, '');
  const hit = allowed.find(
    (a) =>
      String(a)
        .toLowerCase()
        .replace(/[\s_-]/g, '') === loose
  );
  return hit !== undefined ? { value: hit, unknown: false } : { value: raw, unknown: true };
};

const frameSizeBucket = (raw) => {
  const lens = Number(String(raw ?? '').split(/[-\u00D7x\s,]+/)[0]);
  if (!Number.isFinite(lens) || lens <= 0) return 'medium';
  for (const [bucket, min] of FRAME_SIZE_BUCKETS) if (lens >= min) return bucket;
  return 'small';
};
const measureFromSize = (raw) => {
  const [lens, bridge, temple] = String(raw ?? '')
    .split(/[-\u00D7x\s,]+/)
    .map(Number);
  return { lens, bridge, temple };
};

/*
 * Device photo upload for a single product. The form accepted only image URLs,
 * so a shop holding real photographs had nowhere to put them. Files arrive as
 * multipart, are checked for type and size, and go into uploads/products under
 * the same naming convention storeRemoteImages() already uses.
 */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
});

const looksLikeImage = (buf) => {
  if (!buf || buf.length < 12) return false;
  const head = buf.subarray(0, 12);
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  const isGif = head.subarray(0, 3).toString('ascii') === 'GIF';
  const isWebp = head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP';
  const isAvif = head.subarray(4, 12).toString('ascii').includes('avif');
  return isJpeg || isPng || isGif || isWebp || isAvif;
};

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
};

router.post('/products/upload-images', verifyManufacturer, imageUpload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ success: false, message: 'No image files were received.' });
    }
    const fsMod = await import('fs');
    const pathMod = await import('path');
    const urlMod = await import('url');
    const { fileURLToPath } = urlMod;
    const dir = pathMod.join(pathMod.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', 'products');
    fsMod.mkdirSync(dir, { recursive: true });

    const saved = [];
    const rejected = [];
    for (const file of req.files) {
      if (!looksLikeImage(file.buffer)) {
        rejected.push(`"${file.originalname}" is not a picture we can use (accepted: JPG, PNG, GIF, WebP, AVIF)`);
        continue;
      }
      const ext = EXT_BY_MIME[file.mimetype] || '.jpg';
      const safe = `mfg-${req.manufacturer._id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      fsMod.writeFileSync(pathMod.join(dir, safe), file.buffer);
      saved.push(`/uploads/products/${safe}`);
    }

    if (!saved.length) {
      return res
        .status(400)
        .json({ success: false, message: rejected.join('; ') || 'None of the files you picked were pictures.' });
    }
    res.status(201).json({ success: true, urls: saved, rejected });
  } catch (error) {
    if (error && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Each image must be 8 MB or smaller.' });
    }
    console.error('Product image upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Image upload failed.' });
  }
});

/*
 * The uploaded sheet is an input, not an asset, and it used to be written to
 * uploads/ by multer's default disk storage with a random name - then read
 * and never deleted. Every bulk import therefore left a copy of a
 * manufacturer's price list on the server forever, in the same directory the
 * app serves to browsers. Buffering it keeps the bytes in memory only, and
 * xlsx reads the buffer directly.
 */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const generateManufacturerToken = (manufacturerId) => {
  return signSession({ id: manufacturerId, manufacturerId, role: 'manufacturer' }, { expiresIn: '24h' });
};

// Manufacturer Login
router.get('/onboarding/:token', async (req, res) => {
  try {
    const { resolveVerificationToken, onboardingSnapshot } = await import('../services/manufacturerOnboarding.js');
    const found = await resolveVerificationToken(req.params.token);
    if (!found.ok) {
      return res.status(404).json({
        success: false,
        reason: found.reason,
        message:
          found.reason === 'expired'
            ? 'This invitation link expired - ask the desk for a fresh confirmation mail.'
            : 'That confirmation link is not valid.',
      });
    }
    res.json({ success: true, onboarding: onboardingSnapshot(found.m), company: found.m.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/** VERIFY: details are correct - now prove it's really them with the OTP. */
router.post('/onboarding/:token/verify', async (req, res) => {
  try {
    const { resolveVerificationToken, beginActivation } = await import('../services/manufacturerOnboarding.js');
    const found = await resolveVerificationToken(req.params.token);
    if (!found.ok)
      return res.status(404).json({
        success: false,
        message: found.reason === 'expired' ? 'Link expired; request a fresh confirmation.' : 'Invalid link.',
      });
    const result = await beginActivation(found.m);
    if (!result.ok) return res.status(409).json({ success: false, message: result.message, delivered: false });
    return res.json({ success: true, message: result.message, devCode: result.devCode || undefined });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/** The emailed 6-digit code; only this instates the account. */
router.post('/onboarding/:token/otp', async (req, res) => {
  try {
    const { resolveVerificationToken, completeActivation } = await import('../services/manufacturerOnboarding.js');
    const found = await resolveVerificationToken(req.params.token);
    if (!found.ok)
      return res.status(404).json({
        success: false,
        message: found.reason === 'expired' ? 'Link expired; request a fresh confirmation.' : 'Invalid link.',
      });
    const result = await completeActivation(found.m, req.body.otp);
    if (!result.ok) return res.status(400).json({ success: false, message: result.message });
    /*
     * Success carries the final state IN THE RESPONSE, because activation
     * retires the invitation handle (correctly - the used token must not
     * resolve any more). A page that re-reads the retired token after a
     * successful activation would answer 'invitation not usable' to someone
     * who just finished; the terminal state rides on the success instead.
     */
    return res.json({ success: true, message: result.message, onboarding: { state: 'active' } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/** UPDATE INFO: propose; nothing changes until the desk re-creates it. */
router.post('/onboarding/:token/update', async (req, res) => {
  try {
    const { resolveVerificationToken, requestInfoUpdate } = await import('../services/manufacturerOnboarding.js');
    const found = await resolveVerificationToken(req.params.token);
    if (!found.ok)
      return res.status(404).json({
        success: false,
        message: found.reason === 'expired' ? 'Link expired; request a fresh confirmation.' : 'Invalid link.',
      });
    const result = await requestInfoUpdate(found.m, { updates: req.body.updates || {}, note: req.body.note || '' });
    const status = result.ok ? 200 : result.errors ? 400 : 409;
    return res
      .status(status)
      .json(
        result.ok
          ? { success: true, message: result.message }
          : { success: false, message: result.message, errors: result.errors, reason: result.reason }
      );
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const manufacturer = await Manufacturer.findOne({ email });
    if (!manufacturer) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!manufacturer.isActive) {
      const { onboardingStateOf } = await import('../services/manufacturerOnboarding.js');
      const st = onboardingStateOf(manufacturer);
      if (st !== 'active') {
        return res.status(403).json({
          success: false,
          onboarding: st,
          message:
            st === 'update_requested'
              ? 'Your update request is with the OptiKart desk. Sign-in opens once they re-create the invitation and you confirm it.'
              : 'This company record is awaiting email confirmation - open the newest confirmation mail from OptiKart and finish with Verify + the code we send.',
        });
      }
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    if (manufacturer.isBanned) {
      return res.status(403).json({ success: false, message: 'Account has been banned.' });
    }

    if (manufacturer.lockUntil && manufacturer.lockUntil > new Date()) {
      const remainingTime = Math.ceil((manufacturer.lockUntil - new Date()) / 1000 / 60);
      return res.status(423).json({
        success: false,
        message: `Account is locked. Please try again in ${remainingTime} minutes.`,
        locked: true,
        lockUntil: manufacturer.lockUntil,
      });
    }

    const isMatch = await manufacturer.comparePassword(password);
    if (!isMatch) {
      manufacturer.failedLoginAttempts = (manufacturer.failedLoginAttempts || 0) + 1;

      if (manufacturer.failedLoginAttempts >= 3) {
        manufacturer.lockUntil = new Date(Date.now() + 3 * 60 * 1000);
        manufacturer.failedLoginAttempts = 0;
        await manufacturer.save();

        return res.status(423).json({
          success: false,
          message: 'Too many failed attempts. Account locked for 3 minutes.',
          locked: true,
          lockUntil: manufacturer.lockUntil,
        });
      }

      await manufacturer.save();
      const remainingAttempts = 3 - manufacturer.failedLoginAttempts;
      return res.status(401).json({
        success: false,
        message: `Invalid email or password. ${remainingAttempts} attempts remaining.`,
      });
    }

    manufacturer.failedLoginAttempts = 0;
    manufacturer.lockUntil = null;

    // Check if this is a test credential - bypass OTP for testing
    const testManufacturerEmails = ['rayban.manufacturer@optikart.com'];
    // Second-factor OTP may only be skipped outside production, and only
    // for the well-known seededdemo accounts whose password is also public.
    const isTestCredential = otpBypassAllowed(testManufacturerEmails, email);

    if (isTestCredential) {
      // Direct login for test credentials
      const token = generateManufacturerToken(manufacturer._id);
      manufacturer.loginTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      manufacturer.lastLoginAt = new Date();
      await manufacturer.save();

      res.json({
        success: true,
        message: 'Login successful.',
        token,
        manufacturer: manufacturer.toJSON(),
      });
    } else {
      const loginOtp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        specialChars: false,
        lowerCaseAlphabets: false,
      });

      manufacturer.loginOtp = loginOtp;
      manufacturer.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await manufacturer.save();

      const delivery = await sendOTP(email, loginOtp, 'login');
      if (!delivery.success) {
        /*
         * The honest answer. Before this, an unconfigured mail account still
         * produced "Login OTP sent to your email" - the code existed only in the
         * server log, so the manufacturer was locked out while being told to
         * check their inbox. A 503 here names the actual missing piece: SMTP.
         */
        return res.status(503).json({
          success: false,
          message:
            'Sign-in cannot be completed: the verification code could not be delivered because email is not configured on this server.',
          reason: delivery.reason,
        });
      }
      res.json({
        success: true,
        requiresOTP: true,
        message: delivery.delivered
          ? 'Login OTP sent to your email.'
          : 'Email is not configured on this server; the code is returned below for development use only.',
        manufacturerId: manufacturer._id,
        // Present only outside production and only when the code could not be
        // mailed. A deployed system never sees this field.
        devCode: delivery.devCode,
      });
    }
  } catch (error) {
    console.error('Manufacturer login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
});

// Verify Manufacturer Login OTP
router.post('/verify-login-otp', otpLimiter, async (req, res) => {
  try {
    const { manufacturerId, otp } = req.body;

    if (!manufacturerId || !otp) {
      return res.status(400).json({ success: false, message: 'Manufacturer ID and OTP are required.' });
    }

    const manufacturer = await Manufacturer.findById(manufacturerId);
    if (!manufacturer) {
      return res.status(404).json({ success: false, message: 'Manufacturer not found.' });
    }

    if (manufacturer.loginOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    if (new Date() > manufacturer.loginOtpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
    }

    manufacturer.loginOtp = undefined;
    manufacturer.loginOtpExpiry = undefined;
    manufacturer.lastLoginAt = new Date();
    await manufacturer.save();

    const token = generateManufacturerToken(manufacturer._id);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      manufacturer: manufacturer.toJSON(),
    });
  } catch (error) {
    console.error('Verify manufacturer login OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Manufacturer Profile
/* Manufacturer self-service profile; see routes/manufacturerProfile.js. */
registerProfileRoutes(router);

router.get('/me', verifyManufacturer, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const manufacturer = await Manufacturer.findById(req.manufacturer._id);

    if (!manufacturer) {
      return res.status(404).json({ success: false, message: 'Manufacturer not found.' });
    }

    res.json({
      success: true,
      manufacturer: manufacturer.toJSON(),
    });
  } catch (error) {
    console.error('Get manufacturer profile error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Add Product (Manufacturer)
/*
 * The rule book, published.
 *
 * The upload form and the sheet both say what they will demand; until now each
 * said it from its own copy of the list, which is how a manufacturer could read
 * one set of requirements, satisfy it, and be refused by the other door. This
 * returns the same object both doors compute their messages from, so the client
 * renders the actual rules rather than a paraphrase of them.
 *
 * It is behind the manufacturer guard on purpose: nothing here is secret, but a
 * competitor enumerating required columns is a different matter from a shop
 * reading the rules it must satisfy, and every other upload surface is private.
 */
router.get('/upload-spec', verifyManufacturer, async (req, res) => {
  res.json({ success: true, spec: describeRequired() });
});

router.post('/products', verifyManufacturer, async (req, res) => {
  try {
    /*
     * The single-product form used to validate nothing of its own: whatever came
     * in went to Mongoose, and a missing description or model number surfaced as
     * "Path `description` is required" - a sentence about an object nobody filled
     * in, and the reason the bulk sheet appeared to demand more than the form.
     * Both doors now consult the same rule set in services/productRequirements.js,
     * so a requirement cannot exist on one side without the other, and the answer
     * names every missing field at once instead of whichever one the schema
     * happened to check first.
     */
    const requiredProblems = missingProductFields(req.body || {});
    if (requiredProblems.length) {
      return res.status(400).json({
        success: false,
        message:
          'This product is missing ' +
          requiredProblems.length +
          ' required ' +
          (requiredProblems.length === 1 ? 'field' : 'fields') +
          ': ' +
          requiredProblems.map((item) => item.label).join(', ') +
          '.',
        missing: requiredProblems.map(({ field, label, message }) => ({ field, label, message })),
        hint: 'The same fields are required on the bulk upload sheet - see the specification at the bottom of this page.',
      });
    }

    // The measured size ("54-16-135") is normalised into the schema's bucket, and
    // the numbers themselves are kept where the product page reads them.
    const incoming = { ...req.body };
    const measured = String(incoming.frameSize ?? '').trim();
    if (measured && !['small', 'medium', 'large', 'extra-large'].includes(measured.toLowerCase())) {
      incoming.frameSize = frameSizeBucket(measured);
      const { lens, bridge, temple } = measureFromSize(measured);
      const dims = incoming.dimensions && typeof incoming.dimensions === 'object' ? incoming.dimensions : {};
      incoming.dimensions = {
        width: Number.isFinite(dims.width) ? dims.width : lens,
        height: Number.isFinite(dims.height) ? dims.height : undefined,
        bridge: Number.isFinite(dims.bridge) ? dims.bridge : bridge,
        temple: Number.isFinite(dims.temple) ? dims.temple : temple,
      };
    }

    /*
     * Allow-list applied to the body before the document exists.
     *
     * This door used to spread req.body into `new Product(...)`, which meant a
     * manufacturer could set any field the schema knows about. Verified against the
     * running API: `verificationStatus: 'verified'` came back stored as verified and
     * listed in the public catalogue with no review at all - the entire listing
     * approval workflow (brands, supply claims, desk queue) bypassed by one extra
     * key in a JSON body - and `isSponsored: true` bought a placement the desk
     * sells. See services/productRequirements.js for the field list and why it is a
     * deny-by-default derivation rather than a blocklist.
     */
    const { values: uploadable, dropped } = pickUploadableFields(incoming, Object.keys(Product.schema.paths));
    if (dropped.length) {
      /*
       * Named in the log, and in the response, because a caller whose extra field
       * is silently ignored will assume it was applied. `verificationStatus` from a
       * manufacturer is also worth a line in the log: it is either an integration
       * bug or someone probing, and both are worth seeing.
       */
      console.warn(
        `POST /manufacturer/products from ${req.manufacturer.email}: ignored server-owned field(s) ${dropped.join(', ')}`
      );
    }

    const productData = {
      ...uploadable,
      // Owned by the door, never by the caller.
      manufacturer: req.manufacturer._id,
      isManufacturerProduct: true,
      verificationStatus: 'pending',
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product added successfully.',
      product,
    });
  } catch (error) {
    /*
     * A rejected product is the caller's problem, not ours. Until now every
     * failure on this door - a lens with no base curve, a width of "140mm" that
     * Mongoose cannot cast to a Number, a missing seller on a seller listing -
     * arrived as HTTP 500 "Server error" carrying our own error text. That is
     * wrong twice: it tells a manufacturer their perfectly described data is
     * something WE broke (so they wait instead of fixing it), and it forwards
     * `error.message`, which for a validation failure recites schema paths and
     * cast internals that belong in a log, not in a response body.
     *
     * So ValidationError becomes 400 with a per-field list in the same shape as
     * the upload-rule problems above - one vocabulary for the whole door - and
     * everything else stays 500 while the detail goes to the log only.
     */
    if (error?.name === 'ValidationError') {
      const problems = Object.entries(error.errors || {}).map(([field, e]) => {
        /*
         * Mongoose's own text is written for engineers: "Cast to Number failed
         * for value \"140mm\" (type string) at path \"frameWidth\"" names schema
         * paths, internal type words and the library's grammar. A manufacturer
         * reading that cannot tell whether they typed a unit, and the sentence
         * exposes our schema layout in an HTTP body.
         *
         * So the *kind* of problem is mapped to the words the rest of this door
         * already uses, with the field left intact for the client to highlight.
         * Unknown kinds keep the message (nothing is invented) but drop the
         * library's phrasing.
         */
        /*
         * Verified against the installed Mongoose rather than assumed: a cast
         * failure arrives as a CastError whose `kind` is the *target type*
         * ("Number"), not the word "Cast", and required paths arrive with
         * `kind: 'required'` and a message written as "Path `seller` is
         * required." An earlier version of this mapper tested kind === 'Cast' and
         * therefore printed the useless "is not in a form we can save" for every
         * bad number.
         */
        const leaf = field.split('.').pop();
        const label = leaf.charAt(0).toUpperCase() + leaf.slice(1).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
        const kind = e?.kind || '';
        const isCast = e?.name === 'CastError';
        let message;
        if (isCast) {
          if (kind === 'Number')
            message = `${label} must be a number (a value like "140mm" cannot be stored as a measurement)`;
          else if (kind === 'Date') message = `${label} must be a date`;
          else if (kind === 'Boolean') message = `${label} must be yes or no`;
          else if (kind === 'ObjectIds' || kind === 'ObjectId') message = `${label} must name an existing record`;
          else if (kind === 'Array') message = `${label} must be a list`;
          else message = `${label} cannot be saved as written`;
        } else if (kind === 'required') {
          message = `${label} is required`;
        } else if (kind === 'enum') {
          const allowed = Product.schema.path(field)?.enumValues || [];
          message = allowed.length
            ? `${label} must be one of: ${allowed.join(', ')}`
            : `${label} is not a value we accept`;
        } else if (kind === 'min' || kind === 'max') {
          message = `${label} is outside the range we accept`;
        } else {
          // The model's own pre-validate hook writes the good sentences for
          // category attributes; keep them, strip only the library's grammar.
          message = String(e?.message || `${label} needs attention`)
            .replace(/^Path `[^`]*` is required\.?/, `${label} is required`)
            .replace(/^Cast to .* at path `[^`]*`.*$/, `${label} cannot be saved as written`)
            .replace(
              /^`[^`]*` is not a valid enum value for path `[^`]*`\.?/,
              `${label} is not one of the values we accept`
            );
          if (/^(Cast to|ObjectExpected|Path `)/.test(message)) message = `${label} cannot be saved as written`;
        }
        /*
         * This `return` had been dropped by an earlier edit of mine, and a map
         * callback that runs off the end yields undefined for every entry: the
         * door then threw "Cannot read properties of undefined (reading 'field')"
         * on the manufacturer's own validation error - a 500 in the code that
         * exists to turn a 500 into a message. `node --check` cannot see it; the
         * suite did.
         */
        return { field, label, message };
      });
      return res.status(400).json({
        success: false,
        message: `This product could not be saved: ${problems.map((p) => p.field).join(', ')} need attention.`,
        missing: problems,
      });
    }
    console.error('Add product error:', error);
    res.status(500).json({ success: false, message: 'The product could not be saved. The details were recorded.' });
  }
});

// Get Manufacturer Products
router.get('/products', verifyManufacturer, async (req, res) => {
  try {
    const products = await Product.find({
      manufacturer: req.manufacturer._id,
      isDiscontinued: false,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Update Product
router.put('/products/:id', verifyManufacturer, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      manufacturer: req.manufacturer._id,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    /*
     * The update door used to be `Object.assign(product, req.body)`, which is the
     * single most permissive line in this controller: on an EXISTING product a
     * manufacturer could set `verificationStatus: 'verified'` to publish past the
     * review queue, `isSponsored: true` to buy a placement nobody sold them,
     * `blockedByAdmin: false` to undo a desk takedown, or - worst, because it
     * rewrites the ownership the query just enforced - `manufacturer` itself.
     *
     * Allow-listed like creation. Two fields are additionally held back below,
     * because they are the desk's to set and the model's to reset: ownership and
     * review state. Editing a listing does not re-verify it; the model's
     * pre('save') drops verificationStatus to pending whenever a described field
     * changes, and that behaviour is relied upon here rather than duplicated.
     */
    const { values: editable, dropped: droppedUpdate } = pickUploadableFields(
      req.body,
      Object.keys(Product.schema.paths)
    );
    if (droppedUpdate.length) {
      console.warn(
        `PUT /products/:id by ${req.manufacturer.email}: ignored server-owned field(s) ${droppedUpdate.join(', ')}`
      );
    }
    // Ownership and lifecycle remain the desk's / the door's, never the caller's.
    delete editable.manufacturer;
    delete editable.isManufacturerProduct;
    delete editable.seller;
    Object.assign(product, editable);
    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully.',
      product,
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Discontinue Product
router.post('/products/:id/discontinue', verifyManufacturer, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      manufacturer: req.manufacturer._id,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    product.isDiscontinued = true;
    product.discontinuedAt = new Date();
    product.discontinuedBy = req.manufacturer._id;
    await product.save();

    // Remove from all seller dashboards
    await Product.updateMany({ manufacturerProduct: product._id }, { isActive: false });

    res.json({
      success: true,
      message: 'Product discontinued successfully.',
    });
  } catch (error) {
    console.error('Discontinue product error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Re-continue Product
router.post('/products/:id/recontinue', verifyManufacturer, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      manufacturer: req.manufacturer._id,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    product.isDiscontinued = false;
    product.discontinuedAt = null;
    product.discontinuedBy = null;
    await product.save();

    res.json({
      success: true,
      message: 'Product re-continued successfully.',
    });
  } catch (error) {
    console.error('Recontinue product error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Bulk Upload Products via Spreadsheet
router.post('/products/bulk-upload', verifyManufacturer, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const products = [];
    const errors = [];

    // Sunglasses and eyeglasses must arrive in separate files: mixed uploads
    // are the commonest cause of a whole sheet being mapped to one category.
    // A mixed-brand sheet is caught the same way above, with per-row brands.
    const categoriesSeen = new Set();
    /*
     * Brand gate state, collected before rows are validated.
     *
     * Two separate rules apply to a single sheet, and they matter because
     * products group by brand on the home page and in filters:
     *
     *  - one brand per file, like the existing one-category rule. A mixed-brand
     *    sheet otherwise half-imports and leaves two brands' products filed under
     *    whichever name happened to appear per row, which reads to a shopper as a
     *    brand carrying frames it never listed. Each offending row gets its own
     *    error naming the brand on that row, so the fix is a locate-and-split and
     *    not a hunt through a spreadsheet.
     *  - a brand must exist on this manufacturer's profile (`brands`), and must
     *    not be another manufacturer's brand. A brand nobody declared cannot own
     *    a catalogue row: the storefront would show a name with no approval queue
     *    and no retailer access behind it, and a brand owned by a *different*
     *    manufacturer would attribute one company's frames to another on a page
     *    grouped purely by brand name. Only the brand-list rule is enforced here
     *    for now: brand logos are a separate model that does not exist yet, so
     *    nothing in these messages mentions a logo, and a message that pointed at
     *    a non-existent upload box would be the worst kind of advice - correct in
     *    spirit, impossible to follow.
     */
    const allowedBrands = new Set(
      (req.manufacturer?.brands || []).map((b) => String(b).trim().toLowerCase()).filter(Boolean)
    );
    const brandFirstRow = new Map(); // case-folded brand -> sheet row numbers
    // One query for the sheet, not one per row: the owners of every *other*
    // manufacturer's brand names, case-folded, so row checks stay Map.get().
    const foreignBrands = await brandOwnersByFoldedName(req.manufacturer?._id);
    const brandLabels = new Map(); // case-folded brand -> display value
    /*
     * A `|`-separated cell becomes a list of real values.
     *
     * Filtered twice: empty tokens, and the words `undefined`/`null` that
     * spreadsheets pick up from export tools. Those were stored verbatim, so a
     * product ended up offering a material called "undefined" and a size called
     * "undefined" - values a shopper can select and no lens can be ground to.
     * The same class of defect the scalar fields were fixed for; lists are where
     * it actually reached the customer, because they render as options.
     */
    const list = (v, map) =>
      String(v ?? '')
        .split('|')
        .map((x) => (map ? map(x) : String(x).trim()))
        .filter(
          (x) => x && String(x).trim().toLowerCase() !== 'undefined' && String(x).trim().toLowerCase() !== 'null'
        );

    // sheet_to_json() already uses the first spreadsheet line as the column
    // names, so data[0] is a real product row. Starting at 1 silently dropped the
    // first row of every upload while still replying "success".
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || Object.values(row).every((v) => v === '' || v === undefined || v === null)) continue;
      const line = i + 2; // spreadsheet row: the header is line 1

      // Column names are matched loosely so a sheet exported from Excel with
      // spaces or capital letters still loads.
      const get = (...keys) => {
        for (const k of Object.keys(row)) {
          const norm = String(k)
            .toLowerCase()
            .replace(/[\s_-]/g, '');
          if (keys.some((key) => norm === key)) return row[k];
        }
        return undefined;
      };

      /*
       * An absent cell means "not provided", not the text "undefined".
       *
       * Every field below was written `String(get(...)).trim()`, so a blank cell
       * became the four-character string "undefined". For fields the parser
       * already requires, that string passes the emptiness check and is stored -
       * a product with modelNumber "undefined" is searchable by nothing and shows
       * nothing useful. For optional enum fields it is worse: `frameShape:
       * "undefined"` is not a member of the enum, so importing a bottle of
       * solution failed with "frameShape is not one of rectangle, cateye, ..." -
       * a rule about eyewear being applied to a lens cleaner, because a missing
       * value had been turned into a wrong one.
       */
      const text = (...keys) => {
        const value = get(...keys);
        if (value === undefined || value === null) return '';
        const out = String(value).trim();
        return out === 'undefined' || out === 'null' ? '' : out;
      };
      const optText = (...keys) => text(...keys) || undefined;

      /*
       * The whole row, keyed the way `get()` keys it (lowercase, no spaces,
       * underscores or hyphens), so the shared rule book can read any column a
       * manufacturer titled sensibly rather than this parser naming 20 of them by
       * hand. A hand-typed list is how the two doors lost sync in the first place:
       * every field the sheet checked that the API did not, and every field the
       * single form invented for itself.
       */
      const normRow = {};
      for (const [key, value] of Object.entries(row)) {
        const norm = String(key)
          .toLowerCase()
          .replace(/[\s_-]/g, '');
        if (norm) normRow[norm] = value;
      }

      const title = String(get('title', 'name', 'productname') ?? '').trim();
      const price = Number(get('price', 'sellingprice'));
      const categoryRaw = String(get('category') ?? '').trim();
      const brand = String(get('brand', 'brandname') ?? '').trim();
      const genderRaw = String(get('gender') ?? '').trim();

      // Record sightings before any skip so mixed-brand detection sees every
      // row, including rows that later fail a different check.
      if (brand) {
        const folded = brand.toLowerCase();
        if (!brandFirstRow.has(folded)) {
          brandFirstRow.set(folded, []);
          brandLabels.set(folded, brand);
        }
        brandFirstRow.get(folded).push(line);
      }

      const missing = [];
      if (!title) missing.push('title');
      if (!Number.isFinite(price) || price <= 0) missing.push('price');
      if (!categoryRaw) missing.push('category');
      if (!brand) missing.push('brand');
      else if (foreignBrands.has(foldBrand(brand))) {
        // Checked before the profile-list rule on purpose: a name another
        // company owns is not missing, it is taken, and telling someone to add
        // it to their profile would be a direct invitation to make the mistake
        // this rule prevents.
        const taken = foreignBrands.get(foldBrand(brand));
        errors.push(
          `Row ${line}: brand "${brand}" belongs to ${taken.owner} (declared there as "${taken.ownerBrand}"). One brand name can only have one manufacturer. Upload it under the brand you own, or ask OptiKart to reassign the brand.`
        );
        continue;
      } else if (allowedBrands.size && !allowedBrands.has(brand.toLowerCase())) {
        // Per-row and named: a generic reject would make the manufacturer hunt
        // for which row invented which brand, on a sheet of 60 rows.
        errors.push(
          `Row ${line}: brand "${brand}" is not on this manufacturer's profile. Add it under "Brands manufactured" first (currently: ${[...allowedBrands].join(', ') || 'none declared'}); a brand nobody declared cannot own catalogue rows.`
        );
        continue;
      } else if (!allowedBrands.size) {
        // An empty brand list is not "anything goes": it is a profile nobody has
        // set up, and importing on top of it leaves the store grouping by a brand
        // with no logo, no approval queue and no retailer access.
        errors.push(
          `Row ${line}: brand "${brand}" cannot be imported - this manufacturer has no brands declared yet. Add the brand to the profile first.`
        );
        continue;
      }
      /*
       * One rule book for both upload doors.
       *
       * These checks used to be written out here, column by column, while the
       * single-product form checked none of them on the server and Mongoose
       * complained afterwards about an object nobody recognised. The lists could
       * and did drift, and the storefront inherited the difference: a sheet row
       * demanded frame geometry that a form-created product could ship without.
       *
       * They now come from services/productRequirements.js. What stays local is
       * only the sheet's own wording (SHEET_MISSING_TEXT), because 12 assertions
       * and several release notes quote those strings - and the images and price
       * messages, which this parser has always delivered in its own voice with the
       * spreadsheet vocabulary ("the images column", "got X"). Re-emitting them
       * from the shared list would print the same row error twice for one cause.
       */
      const sharedProblemFields = missingProductFields({}, { flat: normRow });
      /*
       * Two kinds of complaint, and the sheet used to have words for only one of
       * them. A missing cell becomes "missing required frameWidth"; a cell that is
       * present but not a measurement is a different fact, and printing it as
       * "missing" told the manufacturer to fill in a column they had filled in -
       * while the single-product door, reading the same rule, said it had to be a
       * number greater than 0. The two doors now carry the same distinction:
       * absence goes in the row's missing list, invalid values get their own
       * sentence, in the sheet's per-row voice.
       *
       * images, price and category are excluded because this parser already
       * answers those three in its own wording (the images column and the parsed
       * price), and duplicating them would print one row error twice.
       */
      const sheetProblems = sharedProblemFields.filter(
        (problem) => problem.field !== 'images' && problem.field !== 'price' && problem.field !== 'category'
      );
      const absent = [];
      for (const problem of sheetProblems) {
        const isAbsence = /is required/.test(problem.message);
        if (isAbsence) absent.push(sheetTextFor(problem));
        else errors.push(`Row ${line}${title ? ` (${title})` : ''}: ${problem.message}`);
      }
      missing.push(...absent);

      const category = String(categoryRaw)
        .toLowerCase()
        .replace(/[\s_-]/g, '');
      const EYEWEAR = ['sunglasses', 'eyeglasses', 'readingglasses', 'sportseyewear', 'kids'];
      if (category && !EYEWEAR.includes(category) && !['contactlenses', 'solution', 'accessories'].includes(category)) {
        errors.push(
          `Row ${line}: unknown category "${categoryRaw}". Use sunglasses, eyeglasses, readingglasses, sportseyewear, kids, contactlenses, solution or accessories.`
        );
        continue;
      }
      if (EYEWEAR.includes(category)) categoriesSeen.add(category);
      /*
       * The frame-geometry and lens-optics requirements moved into
       * CATEGORY_REQUIREMENTS (services/productRequirements.js) so both upload
       * doors read the same list. The block that used to sit here demanded them
       * from sheets only, and repeated three columns with their own phrasing.
       */
      if (missing.length) {
        errors.push(`Row ${line} (${title || 'untitled'}): missing required ${missing.join(', ')}`);
        continue;
      }

      const imageField = String(get('images', 'image', 'imagelinks', 'imageurls') ?? '').trim();
      if (!imageField) {
        errors.push(`Row ${line}: images are required - put one or more | separated links in the images column`);
        continue;
      }
      categoriesSeen.add(category);

      const dimRaw = String(get('framedimensions', 'dimensions') ?? '');
      // An empty spreadsheet cell arrives as '', and Number('') is 0 - so blank
      // measurements used to be stored as zero widths and zero temples.
      const num = (v) => {
        const raw = String(v ?? '').trim();
        if (!raw) return undefined;
        const n = Number(raw.replace(/[^0-9.\-]/g, ''));
        if (!Number.isFinite(n) || n === 0) return undefined;
        return n;
      };
      const first = (...vals) => {
        for (const v of vals) {
          const n = num(v);
          if (n !== undefined) return n;
        }
        return undefined;
      };

      products.push({
        title,
        description: String(get('description') ?? '').trim(),
        price,
        discountedPrice: get('discountedprice') ? Number(get('discountedprice')) : undefined,
        originalPrice: get('originalprice') ? Number(get('originalprice')) : price,
        category,
        brand,
        stock: parseInt(get('stock')) || 0,
        modelNumber: text('modelnumber', 'modelno', 'model'),
        productCode: text('productcode', 'productid', 'sku'),
        // A blank cell must not reach an enum as the empty string: the model
        // rejects `` for `gender`, which meant every solution and accessory row
        // was refused over a column that only eyewear has. Same reason
        // subGender/ageGroup below keep `|| undefined`.
        gender: String(genderRaw ?? '').toLowerCase() || undefined,
        subGender: ['boys', 'girls'].includes(String(get('subgender') ?? '').toLowerCase())
          ? String(get('subgender')).toLowerCase()
          : undefined,
        ageGroup: optText('agegroup'),
        frameShape: optText('frameshape', 'faceshape'),
        frameType: optText('frametype'),
        frameMaterial: optText('framematerial', 'material'),
        frameColor: optText('framecolor', 'framecolour', 'color', 'colour', 'colours'),
        // Frame size is typed by the manufacturer, not chosen from three labels.
        frameSize: frameSizeBucket(get('framesize', 'size')),
        sizes: list(get('sizes')),
        frameWidth: num(get('framewidth')),
        frameWeight: num(get('frameweight')),
        materials: list(get('materials', 'material')),
        colors: list(get('colors', 'colours')).map((c) => ({ name: c })),
        /*
         * The measurement is written on the temple as lens - bridge - temple and
         * sheets express it either as one "54 x 52 x 16 x 145" string or as four
         * columns. The old code read a composite only for width/height and
         * expected columns for bridge/temple, so the last two numbers of a normal
         * sheet vanished silently.
         */
        dimensions: (() => {
          const parts = dimRaw.split(/\s*(?:[x\u00D7]|[-,])\s*/).filter((p) => String(p).trim() !== '');
          const four = parts.length >= 4;
          const fromSize = measureFromSize(get('framesize', 'size'));
          return {
            width: first(get('dimwidth'), four ? parts[0] : undefined, fromSize.lens),
            height: first(get('dimheight'), four ? parts[1] : undefined),
            bridge: first(get('dimbridge'), four ? parts[2] : parts[1], fromSize.bridge),
            temple: first(get('dimtemple'), four ? parts[3] : parts[2], fromSize.temple),
          };
        })(),
        images: imageField
          .split('|')
          .map((u) => u.trim())
          .filter(Boolean),
        // Powered declaration from the sheet, validated on save.
        poweredOptionsAvailable: ['true', 'yes', 'y', '1'].includes(
          String(get('powered', 'withpower', 'poweredoptionsavailable') ?? '').toLowerCase()
        ),
        prescriptionLensTypes: list(get('prescriptionlenstypes', 'lenstypes')),
        warranty: String(get('warranty') ?? ''),
        tags: list(get('tags')),
        returnWindowDays: get('returnwindowdays') !== undefined ? Number(get('returnwindowdays')) : undefined,
        // Contact-lens specifics when the row is a lens product.
        ...(category === 'contactlenses'
          ? {
              contactLens: {
                powerType: ['distance', 'toric', 'multifocal', 'none'].includes(String(get('powertype')).toLowerCase())
                  ? String(get('powertype')).toLowerCase()
                  : 'distance',
                lensesPerBox: Number(get('lensesperbox')) || 6,
                replacementPeriod: String(get('replacementperiod')).toLowerCase(),
                diameter: Number(get('diameter')),
                baseCurve: Number(get('basecurve')),
                waterContent: Number(get('watercontent')),
                allowsZeroPower: ['true', 'yes'].includes(String(get('allowszeropower') ?? '').toLowerCase()),
                isCosmetic: ['true', 'yes'].includes(
                  String(get('iscosmetic', 'coloured', 'color') ?? '').toLowerCase()
                ),
                colorTone: String(get('colortone') ?? ''),
                /*
                 * Toric and multifocal ranges. The model refuses a toric lens without
                 * a negative cylinder range and an axis range, and a multifocal without
                 * an ADD range where max > min - but the parser never read the columns,
                 * so those lenses failed against fields no template mentioned and could
                 * only be created one at a time.
                 */
                cylinderMin: get('cylindermin') !== undefined ? Number(get('cylindermin')) : undefined,
                cylinderMax: get('cylindermax') !== undefined ? Number(get('cylindermax')) : undefined,
                axisMin: get('axismin') !== undefined ? Number(get('axismin')) : undefined,
                axisMax: get('axismax') !== undefined ? Number(get('axismax')) : undefined,
                additionMin: get('additionmin') !== undefined ? Number(get('additionmin')) : undefined,
                additionMax: get('additionmax') !== undefined ? Number(get('additionmax')) : undefined,
                step: get('step') !== undefined ? Number(get('step')) : undefined,
              },
            }
          : {}),
        /*
         * Solution needs a bottle volume and at least one pack price; accessories
         * need a type. The model checks all three and the parser supplied none of
         * them, which meant no solution or accessory could ever be imported in
         * bulk - the rows failed with a message about a column that did not exist
         * in any template.
         *
         * Pack pricing is written `2:1499|3:2099` (multipack size : price) because
         * the saving is the point of the field and one number per row cannot hold
         * it. An unknown accessory type is dropped rather than guessed at, so the
         * row fails loudly about the column instead of quietly filing a case as a
         * cleaning kit.
         */
        ...(category === 'solution'
          ? {
              solution: {
                volumeMl: Number(get('volumeml', 'volume')) || undefined,
                packPricing: String(get('packpricing', 'packs') ?? '')
                  .split('|')
                  .map((chunk) => {
                    const [packSize, price] = chunk.split(':').map((x) => Number(String(x).trim()));
                    return Number.isFinite(packSize) && Number.isFinite(price) && packSize >= 1
                      ? { packSize, price }
                      : null;
                  })
                  .filter(Boolean),
                suitableFor: String(get('suitablefor') ?? '')
                  .split('|')
                  .map((x) => x.trim().toLowerCase().replace(/\s+/g, '-'))
                  .filter((x) =>
                    ['soft', 'silicone-hydrogel', 'rigid-gas-permeable', 'coloured', 'extended-wear'].includes(x)
                  ),
                volumePerBottle: String(get('volumeperbottle') ?? ''),
                disinfects:
                  get('disinfects') === undefined
                    ? true
                    : ['true', 'yes', '1'].includes(String(get('disinfects')).toLowerCase()),
                peroxideBased: ['true', 'yes', '1'].includes(String(get('peroxidebased') ?? '').toLowerCase()),
                preservativeFree: ['true', 'yes', '1'].includes(String(get('preservativefree') ?? '').toLowerCase()),
              },
            }
          : {}),
        ...(category === 'accessories'
          ? {
              accessory: {
                accessoryType: [
                  'case',
                  'twezers',
                  'applicator',
                  'suction-cup',
                  'travel-pouch',
                  'cleaning-kit',
                ].includes(
                  String(get('accessorytype') ?? '')
                    .trim()
                    .toLowerCase()
                )
                  ? String(get('accessorytype')).trim().toLowerCase()
                  : String(get('accessorytype') ?? '').trim() || undefined,
                materialName: String(get('materialname') ?? ''),
                compartmentCount: get('compartmentcount') !== undefined ? Number(get('compartmentcount')) : undefined,
                colours: String(get('colours') ?? '')
                  .split('|')
                  .map((x) => x.trim())
                  .filter(Boolean),
              },
            }
          : {}),
      });
    }

    /*
     * A sheet that names two brands is refused in full, and each row that names
     * a different brand from the sheet's first gets its own line in the error
     * list. This mirrors the mixed-category rule below rather than inventing a
     * third style: failing the whole file is what keeps a brand's catalogue
     * whole, and naming rows is what makes the fix fast.
     */
    if (brandFirstRow.size > 1) {
      const labels = [...brandFirstRow.keys()].map((f) => brandLabels.get(f));
      for (const [f, rows] of brandFirstRow.entries()) {
        for (const row of rows) {
          errors.push(
            `Row ${row}: sheet mixes ${brandFirstRow.size} brands (${labels.map((l) => `"${l}"`).join(', ')}), and one file must carry one brand. Split this file by brand and upload it again.`
          );
        }
      }
    }

    // Mixed-category sheets are refused rather than silently half-imported.
    const sunCount = categoriesSeen.has('sunglasses');
    const eyeCount = [...categoriesSeen].some((c) =>
      ['eyeglasses', 'readingglasses', 'kids', 'sportseyewear'].includes(c)
    );
    if (sunCount && eyeCount) {
      return res.status(400).json({
        success: false,
        message: 'Sunglasses and eyeglasses must be uploaded in separate files. This sheet mixes both categories.',
      });
    }

    // Mixed-brand refusal: per-row errors already assembled above; reject the
    // whole file before any create happens.
    if (brandFirstRow.size > 1) {
      const labelList = [...brandFirstRow.keys()].map((f) => `"${brandLabels.get(f)}"`).join(', ');
      return res.status(400).json({
        success: false,
        mixedBrands: [...brandFirstRow.keys()].map((f) => ({
          brand: brandLabels.get(f),
          rows: brandFirstRow.get(f),
        })),
        message: `One brand per file. This sheet mixes ${brandFirstRow.size} brands (${labelList}) - split it by brand and upload each separately.`,
        errors: errors.slice(0, 50),
      });
    }

    if (!products.length && errors.length) {
      return res
        .status(400)
        .json({ success: false, message: 'No rows could be imported.', errors: errors.slice(0, 50) });
    }

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: `${errors.length} row(s) need attention before the file can be imported. Nothing was saved.`,
        errors: errors.slice(0, 50),
      });
    }

    // Pull each image link down to our own store so the listing never depends on
    // a third-party URL staying alive.
    const stored = [];
    for (const p of products) {
      try {
        p.images = await storeRemoteImages(p.images, req.manufacturerSellerId || 'manufacturer');
      } catch (imgErr) {
        errors.push(`${p.title}: ${imgErr.message}`);
      }
      p.manufacturer = req.manufacturer._id;
      p.isManufacturerProduct = true;
      stored.push(p);
    }
    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: 'Some image links could not be fetched. Nothing was saved.',
        errors: errors.slice(0, 20),
      });
    }

    /*
     * Every row is checked against the schema before anything is written, and
     * failures name the row and the word that did not match. insertMany skips
     * validators, which is how a sheet could be rejected with a bare "Server
     * error" after the whole batch was already lost - and how `name` used to be
     * left empty for imported rows.
     */
    /** Enum members for a schema path, so a refusal names the allowed words. */
    const enumValuesOf = (path) => {
      try {
        const found = path.split('.').reduce((schema, key) => {
          if (!schema) return null;
          const direct = schema.path?.(key);
          if (direct) return direct;
          const nested = schema.schema?.path?.(key);
          return nested || null;
        }, Product.schema);
        return found?.enumValues || [];
      } catch {
        return [];
      }
    };

    const rowProblems = [];
    for (const [index, p] of products.entries()) {
      for (const field of Object.keys(ENUM_ALIASES)) {
        const path = ENUM_ALIASES[field];
        if (p[field] === undefined) continue;
        const matched = matchEnum(Product, path, p[field]);
        if (matched.unknown) {
          rowProblems.push(
            `${p.title || `row ${index + 1}`}: ${field} "${p[field]}" is not one of ${enumsOf(Product, path).join(', ')}`
          );
        }
        p[field] = matched.value;
      }
      if (p.title && !p.name) p.name = p.title;

      /*
       * NOT validateSync. models/Product.js states its per-category rules in an
       * async pre('validate') hook, and Mongoose does not run async middleware
       * under validateSync - so this line checked *less* than the save it was
       * protecting, for exactly the rules it claims to name. A solution row with
       * no pack pricing passed here, then `insertMany` (which does run the full
       * validate) threw one ValidationError over the whole batch, and the
       * manufacturer received HTTP 500 "Server error" with our error text
       * instead of the row number. Measured directly: validateSync said NO
       * ERRORS, insertMany said "solution.packPricing".
       *
       * The comment above this loop already promised rows are "checked against
       * the schema before anything is written". Now it is true.
       */
      let invalid = null;
      try {
        await new Product(p).validate();
      } catch (validationError) {
        invalid = validationError;
      }
      if (invalid) {
        /*
         * Schema problems are reported like the sheet's own column problems:
         * which line, which column, in plain words. The first version of this
         * loop printed `${title}: ${path} - ${message}`, so a manufacturer
         * reading "No Pack Solution: solution.packPricing - Solution needs at
         * least one pack price" had a product name and a Mongoose path but no
         * row number in a 78-line file, and the assertion that the row must be
         * named by number was failing honestly.
         */
        const detail = Object.entries(invalid.errors)
          .map(([path, err]) => {
            const column = path.split('.').pop();
            const words = String(err.message || '')
              .replace(/^Path `.*?` is invalid: /, '')
              .replace(
                /^`.*?` is not a valid enum value for path `[\S]*`\.?/,
                `${column} must be one of: ${(enumValuesOf(path) || []).join(', ')}`
              );
            return `${column} - ${words}`;
          })
          .join('; ');
        rowProblems.push(`Row ${index + 2}${p.title ? ` (${p.title})` : ''}: ${detail}`);
      }
    }
    if (rowProblems.length) {
      return res.status(400).json({
        success: false,
        message: `${rowProblems.length} row(s) need attention before the file can be imported. Nothing was saved.`,
        errors: rowProblems.slice(0, 20),
      });
    }

    const createdProducts = await Product.insertMany(products);

    res.json({
      success: true,
      message: `${createdProducts.length} products uploaded successfully.`,
      count: createdProducts.length,
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Add Manufacturer Seller
router.post('/sellers', verifyManufacturer, async (req, res) => {
  try {
    const sellerData = {
      ...req.body,
      manufacturer: req.manufacturer._id,
      createdBy: req.manufacturer._id,
    };

    const seller = new ManufacturerSeller(sellerData);
    await seller.save();

    // Send credentials email
    await sendOTP(seller.email, sellerData.password, 'credentials');

    res.status(201).json({
      success: true,
      message: 'Manufacturer seller added successfully.',
      seller,
    });
  } catch (error) {
    console.error('Add manufacturer seller error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Manufacturer Sellers
router.get('/sellers', verifyManufacturer, async (req, res) => {
  try {
    const sellers = await ManufacturerSeller.find({
      manufacturer: req.manufacturer._id,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      sellers,
    });
  } catch (error) {
    console.error('Get sellers error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Bulk Upload Manufacturer Sellers
router.post('/sellers/bulk-upload', verifyManufacturer, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const sellers = [];
    // (errors came from the validation pass above)

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // Validate required fields
      if (
        !row.name ||
        !row.email ||
        !row.phone ||
        !row.storeName ||
        !row.manufacturerCode ||
        !row.gstNumber ||
        !row.panNumber ||
        !row.accountNumber ||
        !row.ifscCode ||
        !row.bankName ||
        !row.branchName
      ) {
        errors.push(`Row ${i + 2}: Missing required fields`);
        continue;
      }

      // Generate random password
      const password = Math.random().toString(36).slice(-10) + 'A1!';

      const sellerData = {
        name: row.name,
        email: row.email,
        password: password,
        phone: row.phone,
        storeName: row.storeName,
        storeAddress: {
          street: row.street || '',
          city: row.city || '',
          state: row.state || '',
          pincode: row.pincode || '',
        },
        manufacturerCode: row.manufacturerCode,
        manufacturer: req.manufacturer._id,
        gstNumber: row.gstNumber,
        panNumber: row.panNumber,
        bankDetails: {
          accountNumber: row.accountNumber,
          ifscCode: row.ifscCode,
          bankName: row.bankName,
          branchName: row.branchName,
        },
        createdBy: req.manufacturer._id,
      };

      sellers.push(sellerData);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors found.',
        errors,
      });
    }

    const createdSellers = await ManufacturerSeller.insertMany(sellers);

    // Send credentials to all sellers
    for (const seller of createdSellers) {
      await sendOTP(seller.email, sellers.find((s) => s.email === seller.email).password, 'credentials');
    }

    res.json({
      success: true,
      message: `${createdSellers.length} sellers added successfully.`,
      count: createdSellers.length,
    });
  } catch (error) {
    console.error('Bulk upload sellers error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Ban Manufacturer Seller
router.post('/sellers/:id/ban', verifyManufacturer, async (req, res) => {
  try {
    const seller = await ManufacturerSeller.findOne({
      _id: req.params.id,
      manufacturer: req.manufacturer._id,
    });

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }

    seller.isBanned = true;
    seller.banReason = req.body.reason || '';
    seller.bannedAt = new Date();
    seller.bannedBy = req.manufacturer._id;
    await seller.save();

    res.json({
      success: true,
      message: 'Seller banned successfully.',
    });
  } catch (error) {
    console.error('Ban seller error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Add Manufacturer Staff
router.post('/staff', verifyManufacturer, async (req, res) => {
  try {
    const staffData = {
      ...req.body,
      manufacturer: req.manufacturer._id,
      createdBy: req.manufacturer._id,
    };

    const staff = new ManufacturerStaff(staffData);
    await staff.save();

    res.status(201).json({
      success: true,
      message: 'Staff added successfully.',
      staff,
    });
  } catch (error) {
    console.error('Add staff error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

// Get Manufacturer Staff
router.get('/staff', verifyManufacturer, async (req, res) => {
  try {
    const staff = await ManufacturerStaff.find({
      manufacturer: req.manufacturer._id,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      staff,
    });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.delete('/sellers/:sellerId', verifyManufacturer, async (req, res) => {
  try {
    const { sellerId } = req.params;
    const manufacturerId = req.manufacturer._id;
    const result = await deleteManufacturerSeller(sellerId, manufacturerId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sellers/:sellerId/ban', verifyManufacturer, async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { reason } = req.body;
    const manufacturerId = req.manufacturer._id;
    const result = await banManufacturerSeller(sellerId, manufacturerId, reason);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Manufacturer's own account: profile and brand list.
// Without these the brand chips and company details could never be corrected
// after creation, which is what "already added brand is not editable" referred to.
// ---------------------------------------------------------------------------

router.get('/profile', verifyManufacturer, async (req, res) => {
  try {
    const me = await Manufacturer.findById(req.manufacturer._id).select('-password -loginOtp -loginOtpExpiry').lean();
    res.json({ success: true, data: me });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/profile', verifyManufacturer, async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'companyName', 'gstNumber', 'panNumber', 'brands', 'address'];
    const updates = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    if (updates.brands !== undefined) {
      const list = Array.isArray(updates.brands) ? updates.brands : String(updates.brands).split(',');
      const cleaned = [...new Set(list.map((b) => String(b).trim()).filter(Boolean))];
      if (cleaned.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one brand is required.' });
      }
      updates.brands = cleaned;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update.' });
    }

    const me = await Manufacturer.findByIdAndUpdate(req.manufacturer._id, updates, {
      new: true,
      runValidators: true,
    }).select('-password -loginOtp -loginOtpExpiry');
    res.json({ success: true, message: 'Profile updated.', data: me });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Lift a ban on one of this manufacturer's sellers.
router.post('/sellers/:sellerId/unban', verifyManufacturer, async (req, res) => {
  try {
    const manufacturerId = req.manufacturer._id;
    const seller = await ManufacturerSeller.findOne({ _id: req.params.sellerId, manufacturer: manufacturerId });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found under your manufacturer account.' });
    }

    seller.isBanned = false;
    seller.banReason = '';
    seller.bannedAt = null;
    seller.isActive = true;
    await seller.save();

    res.json({ success: true, message: 'Seller reinstated.', data: seller });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Edit a seller's commercial details (store info, contact, address).
router.put('/sellers/:sellerId', verifyManufacturer, async (req, res) => {
  try {
    const seller = await ManufacturerSeller.findOne({ _id: req.params.sellerId, manufacturer: req.manufacturer._id });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found under your manufacturer account.' });
    }

    const allowed = ['name', 'phone', 'storeName', 'storeDescription', 'storeAddress', 'gstNumber', 'panNumber'];
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) seller[k] = req.body[k];
    });
    if (req.body.storeAddress) {
      seller.storeAddress = { ...seller.storeAddress, ...req.body.storeAddress };
    }

    await seller.save();
    res.json({ success: true, message: 'Seller updated.', data: seller });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/products/validate-bulk', verifyManufacturer, async (req, res) => {
  try {
    const { products } = req.body;
    const result = await validateBulkUpload(products);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/products/pending', verifyManufacturer, async (req, res) => {
  try {
    const manufacturerId = req.manufacturer._id;
    const result = await getManufacturerPendingProducts(manufacturerId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/products/pending/:productId', verifyManufacturer, async (req, res) => {
  try {
    const { productId } = req.params;
    const manufacturerId = req.manufacturer._id;
    const result = await updatePendingProduct(productId, req.body, manufacturerId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/products/pending/:productId', verifyManufacturer, async (req, res) => {
  try {
    const { productId } = req.params;
    const manufacturerId = req.manufacturer._id;
    const result = await deletePendingProduct(productId, manufacturerId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
