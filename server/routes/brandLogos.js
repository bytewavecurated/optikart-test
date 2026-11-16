import express from 'express';
import multer from 'multer';
import Brand from '../models/Brand.js';
import Manufacturer from '../models/Manufacturer.js';
import Product from '../models/Product.js';
import { buildBrandManifest, manifestSummaryText } from '../services/brandManifest.js';
import { notifyManufacturer } from '../services/notifications.js';
import { verifyToken, verifyAdmin, verifyManufacturer } from '../middleware/auth.js';
import { assessLogo, MIN_LOGO_EDGE_PX, MAX_LOGO_BYTES } from '../services/brandLogo.js';
import { foldBrand } from '../services/brandOwnership.js';
import { saveUpload, removeUpload, storageStatus, StoragePolicyError } from '../services/storage.js';
import { notifyAdmins } from '../services/notifications.js';

/**
 * Brand registration and logos.
 *
 * Scope of this router, deliberately: the manufacturer side (register a brand
 * with its logo, see its own status) and the admin side's *read* (the queue).
 * The approve/reject decision is not here yet - it lands together with the
 * brand→products manifest and the manufacturer notification, because an endpoint
 * that marks a brand approved while the manufacturer never hears about it is a
 * half-feature shipped as if it were whole.
 *
 * Two things every path here does on purpose:
 *
 *  1. The logo is validated from its bytes and then handed to the storage layer,
 *     so this route never learns where files go. Cloudinary or the development
 *     fallback - same code, same failure messages either way.
 *  2. Ownership is decided by the shared `foldBrand`, and a collision answers
 *     with who already holds the name. "Brand already exists" is not actionable
 *     when the manufacturer is looking at a name they believe is theirs.
 */
const router = express.Router();

/*
 * memoryStorage, not disk: the bytes have to be inspected and then passed to the
 * storage layer, and a disk temp file *is* a local copy - the thing we are moving
 * away from. The cap is the logo cap plus slack, so an oversized upload gets the
 * message that explains the 2 MB limit and the found size rather than multer's
 * generic "file too large".
 */
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.floor(MAX_LOGO_BYTES * 1.5), files: 1 },
});

const isDupKey = (e) => e?.code === 11000 || /duplicate key/i.test(String(e?.message || ''));

const ownerNameOf = async (brand) => {
  const owner = await Manufacturer.findById(brand.ownerManufacturer).select('name').lean();
  return owner?.name || 'another manufacturer';
};

const collisionMessage = async (brand, selfId) => {
  const mine = String(brand.ownerManufacturer) === String(selfId);
  const who = await ownerNameOf(brand);
  if (mine) {
    return `"${brand.name}" is already registered to you (${brand.status}). Re-upload the logo to replace it, or edit the existing brand instead of creating a new one.`;
  }
  return `"${brand.name}" is already claimed by ${who} (registered as "${brand.name}", ${brand.status}). Brand names belong to exactly one manufacturer, so a name you both share is a dispute for the verification desk, not a second record.`;
};

router.post('/manufacturer/brands', verifyManufacturer, logoUpload.single('logo'), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const io = req.app.get('io');
    const selfId = req.manufacturer._id;

    if (!name) return res.status(400).json({ success: false, message: 'Brand name is required.', field: 'name' });
    if (name.length > 120) {
      return res
        .status(400)
        .json({ success: false, message: 'Brand name must be 120 characters or fewer.', field: 'name' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({
        success: false,
        field: 'logo',
        message: `A logo file is required: PNG, JPG or SVG, square, at least ${MIN_LOGO_EDGE_PX}px on a side, up to 2 MB.`,
      });
    }

    // Byte-level validation happens before any storage call: a rejected upload
    // must not leave an asset behind on the provider.
    const problem = assessLogo(req.file.buffer, { mimetype: req.file.mimetype });
    if (problem) return res.status(400).json({ success: false, message: problem.message, field: problem.field });

    const slug = foldBrand(name);
    const existing = await Brand.findOne({ slug }).lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        field: 'name',
        message: await collisionMessage(existing, selfId),
        owner: String(existing.ownerManufacturer),
        claimedByYou: String(existing.ownerManufacturer) === String(selfId),
      });
    }

    const asset = await saveUpload({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: 'brands',
    });

    const geometry = { width: undefined, height: undefined };
    // assessLogo already parsed the header; reuse its numbers via a second cheap
    // read so the stored record carries what was verified, not what was claimed.
    const { readLogoGeometry } = await import('../services/brandLogo.js');
    const geo = readLogoGeometry(req.file.buffer);
    if (geo) {
      geometry.width = geo.width;
      geometry.height = geo.height;
    }

    let brand;
    try {
      brand = await Brand.create({
        name,
        ownerManufacturer: selfId,
        status: 'pending',
        logo: {
          url: asset.url,
          provider: asset.provider,
          publicId: asset.publicId,
          bytes: asset.bytes,
          width: geometry.width,
          height: geometry.height,
          kind: geo?.kind || null,
        },
      });
    } catch (e) {
      if (!isDupKey(e)) throw e;
      /*
       * Two manufacturers submitting the same name in the same instant: the
       * unique slug index decides, and the loser must not leave its bytes on the
       * provider. Deleting before answering is what makes "nothing stored that
       * isn't in the database" true under concurrency rather than in the happy
       * path only.
       */
      await removeUpload(asset);
      const winner = await Brand.findOne({ slug }).lean();
      return res.status(409).json({
        success: false,
        field: 'name',
        message: winner
          ? await collisionMessage(winner, selfId)
          : 'That brand name was just taken. Try again to see who holds it.',
      });
    }

    /*
     * The manufacturer's own brand list is what the bulk-upload gate checks, so a
     * brand registered here must appear on it or the manufacturer could not ship
     * products under their own name. Appended by exact string; the profile route
     * remains the place where the list is curated.
     */
    const list = req.manufacturer.brands || [];
    if (!list.some((b) => foldBrand(b) === slug)) {
      await Manufacturer.updateOne({ _id: selfId }, { $addToSet: { brands: name } });
    }

    await notifyAdmins({
      title: 'Brand awaiting verification',
      message: `${req.manufacturer.name || 'A manufacturer'} registered "${name}" with a logo. Verify the mark and ownership before it goes on the rails.`,
      type: 'brand',
      data: { brandId: String(brand._id), name, slug },
      io,
    });

    res.status(201).json({
      success: true,
      message: `"${name}" registered and sent for verification. It appears on the storefront once the desk approves the logo.`,
      brand: publicBrand(brand, 'manufacturer'),
    });
  } catch (error) {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, field: 'logo', message: `Logo must be under 2 MB.` });
    }
    /*
     * A rule the file broke is a 400 the manufacturer can act on; only a real
     * infrastructure failure is a 500. Reporting a refused SVG as a server error
     * would send them to support instead of to a square PNG.
     */
    if (error instanceof StoragePolicyError) {
      return res.status(400).json({ success: false, message: error.message, field: error.field });
    }
    console.error('Brand registration failed:', String(error.message).slice(0, 180));
    res.status(500).json({ success: false, message: 'The brand could not be registered. Nothing was saved.' });
  }
});

/*
 * Which provider is live, for operators. Deliberately free of account names and
 * any secret-derived value: this is the answer to "did my logo go to the CDN or
 * to the disk", and it should be readable without granting config access.
 */
router.get('/storage/status', verifyToken, verifyAdmin, async (req, res) => {
  res.json({ success: true, storage: storageStatus() });
});

/**
 * What each audience may see. An admin needs the decision trail and the storage
 * reference; a manufacturer needs their own status; the public projection - used
 * by rails in B2 - deliberately cannot reach this helper by accident, so there
 * are two named shapes instead of one object with fields clipped at the call
 * site.
 */
function publicBrand(brand, audience) {
  const base = {
    _id: String(brand._id),
    name: brand.name,
    slug: brand.slug,
    status: brand.status,
    logoUrl: brand.logo?.url || null,
    logoKind: brand.logo?.kind || null,
  };
  if (audience === 'manufacturer') {
    return {
      ...base,
      logoBytes: brand.logo?.bytes ?? null,
      logoDimensions: brand.logo?.width ? { width: brand.logo.width, height: brand.logo.height } : null,
      storedWith: brand.logo?.provider || null,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
      decisionNote: brand.decision?.note || null,
      decidedAt: brand.decision?.at || null,
    };
  }
  return {
    ...base,
    ownerManufacturer: String(brand.ownerManufacturer),
    storage: {
      provider: brand.logo?.provider || null,
      publicId: brand.logo?.publicId || null,
      bytes: brand.logo?.bytes ?? null,
    },
    decision: brand.decision
      ? { by: brand.decision.by || null, at: brand.decision.at || null, note: brand.decision.note || null }
      : null,
  };
}

router.get('/manufacturer/brands', verifyManufacturer, async (req, res) => {
  try {
    const brands = await Brand.find({ ownerManufacturer: req.manufacturer._id }).sort({ createdAt: -1 }).lean();
    // Product.brand is still free text, so counts group by the same fold the
    // Brand slug uses - otherwise "Acme Optics" and "acme-optics" rows would be
    // counted against whichever spelling the record happened to store.
    const products = await Product.find({
      manufacturer: req.manufacturer._id,
      brand: { $exists: true, $ne: null },
    })
      .select('brand')
      .lean();
    const bySlug = new Map();
    for (const p of products) {
      const k = foldBrand(p.brand);
      bySlug.set(k, (bySlug.get(k) || 0) + 1);
    }
    res.json({
      success: true,
      brands: brands.map((b) => ({ ...publicBrand(b, 'manufacturer'), productCount: bySlug.get(b.slug) || 0 })),
      storage: storageStatus(),
    });
  } catch (error) {
    console.error('Brand list failed:', String(error.message).slice(0, 180));
    res.status(500).json({ success: false, message: 'Your brands could not be read.' });
  }
});

router.get('/admin/brand-queue', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || 'pending')
      .trim()
      .toLowerCase();
    if (!['pending', 'approved', 'rejected', 'all'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be pending, approved, rejected or all.' });
    }
    const filter = status === 'all' ? {} : { status };
    const brands = await Brand.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('ownerManufacturer', 'name email')
      .lean();
    res.json({
      success: true,
      status,
      count: brands.length,
      queue: brands.map((b) => ({
        ...publicBrand(b, 'admin'),
        ownerName: b.ownerManufacturer?.name || null,
        ownerEmail: b.ownerManufacturer?.email || null,
      })),
      storage: storageStatus(),
    });
  } catch (error) {
    console.error('Brand queue failed:', String(error.message).slice(0, 180));
    res.status(500).json({ success: false, message: 'The verification queue could not be read.' });
  }
});

/*
 * The desk's decision. A brand may be approved or rejected; pending is the only
 * state it can leave, and a rejection must carry a reason the manufacturer can
 * act on - "rejected" with no explanation is a support ticket waiting to be filed.
 *
 * Approving is not publishing. This is the rule the manifest exists to state,
 * because it is the assumption every manufacturer arrives with: approving the
 * mark does not verify the listings underneath it, and each product keeps its
 * own verification state. The response therefore carries the manifest and the
 * notification repeats it in one line.
 */
router.put('/admin/brands/:id/decision', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { decision, reason = '' } = req.body || {};
    if (!['approve', 'reject'].includes(String(decision))) {
      return res.status(400).json({ success: false, message: 'decision must be "approve" or "reject".' });
    }
    const brand = await Brand.findById(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: 'No such brand record.' });
    if (brand.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: `This brand is already ${brand.status.split('_').join(' ')}. Reopen it from the queue instead of deciding it twice.`,
      });
    }
    if (decision === 'reject' && !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        field: 'reason',
        message: 'A rejection needs the reason the manufacturer will be shown.',
      });
    }

    const products = await Product.find({ manufacturer: brand.ownerManufacturer, brand: { $exists: true, $ne: null } })
      .select(
        'brand title sku price stock category isActive isDiscontinued verificationStatus rejectionReason verificationNotes'
      )
      .lean();
    const manifest = buildBrandManifest({ products, brandRecords: [brand.toObject()] });

    if (decision === 'approve') {
      brand.status = 'approved';
      brand.decision = { by: req.user.id, at: new Date(), logoSeenAt: new Date(), note: String(reason).trim() || null };
    } else {
      /*
       * One status value only. `rejected_logo` was invented here and is not in the
       * schema's enum, so the save would have failed with a ValidationError and the
       * desk would have seen a 400 they could not interpret. The distinction the
       * admin intended is carried by `decision.note`, which is what the manufacturer
       * is actually shown.
       */
      brand.status = 'rejected';
      brand.decision = { by: req.user.id, at: new Date(), note: String(reason).trim() };
    }
    await brand.save();

    await notifyManufacturer({
      manufacturerId: brand.ownerManufacturer,
      title: decision === 'approve' ? `"${brand.name}" approved` : `"${brand.name}" not approved`,
      message:
        decision === 'approve'
          ? manifestSummaryText(manifest, brand.name)
          : `"${brand.name}" was not approved: ${brand.decision.note}`,
      type: 'brand',
      data: { brandId: String(brand._id), slug: brand.slug, decision: brand.status, totals: manifest.totals },
      io: req.app.get('io'),
    });

    res.json({
      success: true,
      message:
        decision === 'approve'
          ? `Approved. The manifest below is what "approved" actually covers - products do not go live from this decision.`
          : `Refused. The manufacturer can correct the file and re-register it.`,
      brand: publicBrand(brand, 'admin'),
      manifest,
    });
  } catch (error) {
    if (error?.name === 'ValidationError' || /logo|ownership/i.test(String(error.message))) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Brand decision failed:', String(error.message).slice(0, 180));
    res
      .status(500)
      .json({ success: false, message: 'The decision could not be recorded. The brand is still pending.' });
  }
});

/*
 * The manifest on demand, for the owner's own brand list and for the desk.
 * Scoped by the brand's owner even when the caller is the owner - a manufacturer
 * asking for a slug they do not hold is answered the same way as one that does
 * not exist, so the endpoint cannot be used to enumerate who owns what.
 */
/**
 * The manifest, scoped to one brand by default.
 *
 * A route addressed as `/brands/:slug/manifest` must answer about that brand.
 * The first version returned every brand the manufacturer has, which is a
 * different question - and the difference matters when the manifest is read as
 * "what did approving THIS brand cover": an unfiltered answer quietly includes
 * listings under unrelated brands. The whole-manufacturer totals are still
 * available, under their own honest name.
 */
async function manifestFor(brand, { scopeToBrand = true } = {}) {
  const products = await Product.find({ manufacturer: brand.ownerManufacturer, brand: { $exists: true, $ne: null } })
    .select(
      'brand title sku price stock isActive isDiscontinued verificationStatus rejectionReason verificationNotes category'
    )
    .lean();
  const full = buildBrandManifest({ products, brandRecords: [brand] });
  if (!scopeToBrand) return full;
  const brands = full.brands.filter((b) => b.slug === brand.slug);
  return {
    ...full,
    scope: 'brand',
    scopeSlug: brand.slug,
    brands,
    totals: {
      brands: brands.length,
      products: brands.reduce((n, b) => n + b.total, 0),
      live: brands.reduce((n, b) => n + (b.byState?.live || 0), 0),
    },
    manufacturerOverview: { ...full.totals, withoutBrandRows: full.skipped?.withoutBrand ?? 0 },
  };
}

router.get('/manufacturer/brands/:slug/manifest', verifyManufacturer, async (req, res) => {
  try {
    const slug = foldBrand(req.params.slug);
    const brand = await Brand.findOne({ slug, ownerManufacturer: req.manufacturer._id });
    if (!brand)
      return res.status(404).json({ success: false, message: 'You have no brand registered under that name.' });
    const manifest = await manifestFor(brand);
    res.json({ success: true, brand: publicBrand(brand, 'manufacturer'), manifest });
  } catch (error) {
    console.error('Brand manifest failed:', String(error.message).slice(0, 160));
    res.status(500).json({ success: false, message: 'The manifest could not be built.' });
  }
});

/*
 * Storefront rails. Returns one entry per brand that is actually on sale, with
 * the approved logo when there is one - so the rails show a mark instead of an
 * initial, without ever falling back to a fabricated image. Only approved
 * brands' logos are published: a pending submission is not public information,
 * and rendering it would leak a name the desk has not cleared.
 */
router.get('/brands/with-logos', async (req, res) => {
  try {
    const scope = { isActive: true, verificationStatus: 'verified' };
    if (req.query.category) scope.category = String(req.query.category).toLowerCase();
    const names = await Product.distinct('brand', scope);
    const slugs = names.map((n) => foldBrand(n));
    const approved = await Brand.find({ slug: { $in: slugs }, status: 'approved' })
      .select('name slug logo')
      .lean();
    const bySlug = new Map(approved.map((b) => [b.slug, b]));
    const list = names
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .map((name) => {
        const record = bySlug.get(foldBrand(name)) || null;
        return {
          name,
          slug: foldBrand(name),
          logoUrl: record?.logo?.url || null,
          letter: String(name).trim().charAt(0).toUpperCase(),
          verified: Boolean(record),
        };
      });
    res.json({
      success: true,
      brands: list,
      withLogos: list.filter((b) => b.logoUrl).length,
      scoped: Boolean(req.query.category),
    });
  } catch (error) {
    console.error('Brand rail lookup failed:', String(error.message).slice(0, 160));
    res.status(500).json({ success: false, message: 'Brand list could not be read.' });
  }
});

export default router;
