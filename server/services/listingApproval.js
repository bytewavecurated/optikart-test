import Product from '../models/Product.js';
import SellerStock from '../models/SellerStock.js';
import Manufacturer from '../models/Manufacturer.js';
import { pushListingEvent } from '../models/listingApproval.js';
import { notifyAdmins, notifyAccount } from './notifications.js';

/**
 * The supply claim behind a brand listing, and who has to believe it.
 *
 * Both ways a seller reaches a buyer go through here: a retailer's copy of a
 * brand product (`storefront`) and a `SellerStock` row that order routing reads
 * (`stock`). Keeping one implementation matters because the two paths used to
 * behave differently for the same claim, which is how a listing could be
 * unapproved in one place and selling in another.
 */

/*
 * Write the decided state with an explicit update.
 *
 * The decision setters assigned `verificationStatus` on the document and saved,
 * and in memory the document said `verified` while the row in MongoDB still said
 * `pending` - the hook chain was not the writer, and debugging that rabbit hole
 * costs more than this answer is worth: a decision must land as the exact fields
 * it means, so the transition is written by `$set` on the paths that matter and
 * then re-read. If some other writer disagrees afterwards, the queue will show
 * it, rather than the admin being told "verified" about a row still marked
 * pending - which is the failure mode this whole feature exists to prevent.
 */
const persistTransition = async (kind, id, fields) => {
  const target = kind === 'storefront' ? Product : SellerStock;
  await target.updateOne({ _id: id }, { $set: fields });
  return target.findById(id).lean();
};

/*
 * Tell the shop that made a supply claim what happened to it.
 *
 * The claim is the shop's own action, so its outcome belongs to them: a retailer
 * waiting to know whether a frame may sell, a seller waiting to know whether the
 * brand recognised the stock. Both decision paths used to write the state and
 * stop there, so the only way to find out was to reload the listing screen and
 * hope. The two account types live in different collections, which is why the
 * address is taken from the document rather than assumed from the route.
 */
const notifyShop = async ({ doc, kind, stage, title, reason, io = null }) => {
  try {
    const { notifySeller, notifyRetailer } = await import('./notifications.js');
    const listing = doc.listing || {};
    const proof = listing.sellerProof || {};
    const payload = {
      title: `Supply claim ${stage}`,
      message: `${title} - ${doc.title || doc.brand || 'your listing'}`
        + `${proof.reference ? ` (${proof.reference})` : ''}${reason ? `. Reason: ${reason}` : ''}`,
      type: 'listing',
      data: { listingId: String(doc._id), listingKind: kind, stage }
    };
    if (kind === 'storefront' && doc.manufacturerSellerId) {
      await notifyRetailer({ retailerId: doc.manufacturerSellerId, io, ...payload });
    } else if (doc.seller) {
      await notifySeller({ sellerId: doc.seller?._id || doc.seller, io, ...payload });
    }
  } catch (shopNoteErr) {
    // A recorded decision is not undone by a notification that could not be addressed.
    console.error(JSON.stringify({ event: 'shop_notify_failed', message: String(shopNoteErr.message).slice(0, 160) }));
  }
};

const clone = (v) => JSON.parse(JSON.stringify(v || {}));

/** A listing exists in one of two documents; resolve it by kind. */
export const loadListing = async ({ listingKind, id }) => {
  if (listingKind === 'storefront') {
    const doc = await Product.findById(id);
    return doc ? { doc, kind: 'storefront' } : null;
  }
  if (listingKind === 'stock') {
    const doc = await SellerStock.findById(id);
    return doc ? { doc, kind: 'stock' } : null;
  }
  return null;
};

const describe = (doc, kind) => ({
  listingKind: kind,
  id: String(doc._id),
  product: String(kind === 'storefront' ? (doc.manufacturerProduct || doc._id) : doc.product),
  title: kind === 'storefront' ? doc.title : (doc.brand ? `${doc.brand} ${doc.modelNumber || ''}`.trim() : ''),
  brand: doc.brand || '',
  seller: String(doc.seller?._id || doc.seller || doc.manufacturerSellerId || ''),
  listing: clone(doc.listing || {})
});

/**
 * Step 1 - the seller states where the goods came from.
 *
 * An incomplete declaration is refused rather than accepted and queued, because
 * a queue full of claims nobody can check converts the work instead of moving
 * it. `other` is allowed: plenty of legitimate stock comes from a liquidation or
 * a secondary distributor. It simply has to be said out loud, to the brand.
 */
export const declareSupply = async ({
  doc,
  kind,
  product,
  actorLabel,
  proof,
  brandLinked = true,
  notify = true
}) => {
  if (!brandLinked) {
    doc.listing = { ...(doc.listing || {}), brandLinked: false, state: 'live' };
    return { success: true, state: 'live', message: 'Not a brand listing, so it is sellable as before.' };
  }

  const kindOf = String(proof?.kind || '').trim();
  const reference = String(proof?.reference || '').trim();
  const note = String(proof?.note || '').trim();

  if (!kindOf) {
    return { success: false, reason: 'proof_kind_required', message: 'Say where this stock came from before listing it.' };
  }
  if (kindOf === 'manufacturer_purchase' && !reference) {
    return {
      success: false,
      reason: 'reference_required',
      message: 'A purchase from the brand needs an invoice or PO number the brand can look up.'
    };
  }
  if (kindOf === 'other' && note.length < 8) {
    return {
      success: false,
      reason: 'note_required',
      message: 'Stock not bought from the brand has to say where it came from, in enough words to check.'
    };
  }

  const previous = doc.listing || {};
  const reDeclared = (previous.declarationCount || 0) > 0;

  doc.listing = {
    ...previous,
    brandLinked: true,
    state: 'awaiting_manufacturer',
    sellerProof: {
      kind: kindOf,
      reference,
      note,
      declaredAt: new Date(),
      declaredBy: String(actorLabel || '')
    },
    manufacturerReview: { status: 'pending', by: '', brand: String(product?.manufacturer || ''), at: null, reason: '' },
    adminReview: { status: 'none', by: '', at: null, reason: '' },
    pausedAt: null,
    reDeclaredAt: reDeclared ? new Date() : previous.reDeclaredAt || null,
    declarationCount: (previous.declarationCount || 0) + 1,
    history: previous.history || []
  };
  pushListingEvent(doc.listing, reDeclared ? 're-declared' : 'declared', actorLabel, `${kindOf} ${reference || note}`);

  doc.markModified('listing');
  // Nothing about this copy sells until both agree, whatever the route wanted.
  // `verificationStatus` is what the storefront query filters on. An earlier
  // version of this file set `doc.status`, a path the Product schema does not
  // declare - Mongoose accepted the assignment, dropped it, and the listing
  // stayed visible while every test reading `status` reported success.
  if (kind === 'storefront') doc.verificationStatus = 'pending';
  doc.isListed = false;
  await doc.save();

  if (notify && product?.manufacturer) {
    const brand = await Manufacturer.findById(product.manufacturer).select('_id name').lean();
    if (brand) {
      await notifyAccount({
        user: brand._id,
        title: 'A shop wants to sell your brand',
        message: `${describe(doc, kind).title || 'A listing'} is being offered ${kindOf === 'other' ? 'from stock NOT bought from you' : `against purchase reference ${reference}`}. It stays invisible until you approve it and the platform verifies it.`,
        type: 'listing',
        data: { listingKind: kind, listingId: String(doc._id), brandLinked: true }
      });
    }
  }

  return {
    success: true,
    state: 'awaiting_manufacturer',
    listing: describe(doc, kind),
    message: 'Sent to the brand for approval. Nothing is visible to customers until the brand approves and the platform verifies it.'
  };
};

/**
 * Step 2 - the brand decides.
 *
 * Approval here means only "yes, we supplied this shop". The listing still is
 * not sellable: the platform verifies the copy itself, so a brand and a seller
 * who agree between them cannot put something in front of customers on their own.
 */
export const decideAsManufacturer = async ({ listingKind, id, decision, reason, actorLabel, brandId }) => {
  const found = await loadListing({ listingKind, id });
  if (!found) return { success: false, reason: 'not_found', message: 'That listing is not on the queue any more.' };
  const { doc, kind } = found;
  const listing = doc.listing || {};

  if (listing.brandLinked !== true) {
    return { success: false, reason: 'not_brand_linked', message: 'This listing is not a brand claim and needs no approval from you.' };
  }
  if (listing.state !== 'awaiting_manufacturer') {
    return {
      success: false,
      reason: 'wrong_state',
      message: `This request is already ${listing.state}; only the brand's decision is awaited while it says awaiting_manufacturer.`
    };
  }

  const chosen = String(decision || '').toLowerCase();
  if (!['approve', 'reject'].includes(chosen)) {
    return { success: false, reason: 'decision_invalid', message: 'Decision must be approve or reject.' };
  }
  if (chosen === 'reject' && String(reason || '').trim().length < 5) {
    return { success: false, reason: 'reason_required', message: 'Tell the shop why, in enough words to act on.' };
  }

  // A brand may only answer for its own brand.
  const owner = doc.manufacturer || doc.brand;
  void owner;
  const productDoc = kind === 'storefront'
    ? await Product.findById(doc.manufacturerProduct || doc._id).select('manufacturer').lean()
    : await Product.findById(doc.product).select('manufacturer').lean();
  if (brandId && productDoc?.manufacturer && String(productDoc.manufacturer) !== String(brandId)) {
    return { success: false, reason: 'not_your_brand', message: 'That product belongs to a different brand.' };
  }

  if (chosen === 'approve') {
    listing.state = 'awaiting_admin';
    listing.manufacturerReview = { ...listing.manufacturerReview, status: 'approved', by: actorLabel, at: new Date(), reason: String(reason || '') };
    listing.adminReview = { status: 'pending', by: '', at: null, reason: '' };
    pushListingEvent(listing, 'brand-approved', actorLabel, reason);
    if (kind === 'storefront') doc.verificationStatus = 'pending';
    doc.isListed = false;
  } else {
    listing.state = 'rejected';
    listing.manufacturerReview = { ...listing.manufacturerReview, status: 'rejected', by: actorLabel, at: new Date(), reason: String(reason || '') };
    listing.adminReview = { status: 'none', by: '', at: null, reason: '' };
    pushListingEvent(listing, 'brand-rejected', actorLabel, reason);
    if (kind === 'storefront') doc.verificationStatus = 'rejected';
    doc.isListed = false;
  }

  // A fresh object plus markModified: `listing` is a Mixed path, so mutating
  // the object Mongoose already holds changes nothing it will write - the
  // brand's approval was reported as succeeded, and the queue still said the
  // brand had not answered.
  doc.listing = clone(listing);
  doc.markModified('listing');
  await doc.save();
  await persistTransition(kind, doc._id, {
    isListed: false,
    ...(kind === 'storefront' ? { verificationStatus: chosen === 'approve' ? 'pending' : 'rejected' } : {}),
    'listing.state': listing.state,
    'listing.manufacturerReview': listing.manufacturerReview,
    'listing.adminReview': listing.adminReview
  });

  await notifyShop({
    doc,
    kind,
    stage: chosen === 'approve' ? 'approved by the brand' : 'refused by the brand',
    title: chosen === 'approve'
      ? 'The brand confirmed it supplied this stock; OptiKart verifies it next'
      : 'The brand says it did not supply this stock',
    reason: String(reason || '')
  });

  await notifyAdmins({
    title: chosen === 'approve' ? `Brand approved a listing - needs verification` : `Brand refused a listing`,
    message: chosen === 'approve'
      ? `${describe(doc, kind).title || 'A listing'} was approved by the brand as genuinely supplied${reason ? ` (${reason})` : ''}. It is waiting on platform verification before it can sell.`
      : `${describe(doc, kind).title || 'A listing'} was refused by the brand: ${reason}`,
    type: 'listing',
    data: { listingKind: kind, listingId: String(doc._id), decision: chosen }
  });

  return {
    success: true,
    state: listing.state,
    listing: describe(doc, kind),
    message: chosen === 'approve'
      ? 'Approved as supplied by you. The platform verifies it next; it is not sellable until that is done.'
      : 'Refused. The shop is told why, and cannot list this again without a new declaration.'
  };
};

/**
 * Step 3 - the platform verifies and the listing becomes sellable.
 *
 * `ProductVerification`, the existing admin queue, reads documents whose
 * `status` is `pending`; the hook in models/Product.js keeps a not-yet-approved
 * brand copy there, so this is the only door to `live`.
 */
export const decideAsAdmin = async ({ listingKind, id, decision, reason, actorLabel }) => {
  const found = await loadListing({ listingKind, id });
  if (!found) return { success: false, reason: 'not_found', message: 'That listing is not on the queue any more.' };
  const { doc, kind } = found;
  const listing = doc.listing || {};

  const chosen = String(decision || '').toLowerCase();
  if (!['approve', 'reject'].includes(chosen)) {
    return { success: false, reason: 'decision_invalid', message: 'Decision must be approve or reject.' };
  }

  if (listing.brandLinked === true && listing.state !== 'awaiting_admin') {
    return {
      success: false,
      reason: listing.state === 'awaiting_manufacturer' ? 'brand_first' : 'wrong_state',
      message: listing.state === 'awaiting_manufacturer'
        ? 'The brand has not approved this supply claim yet. Verifying first would skip the one check that proves the shop was actually supplied.'
        : `This listing is ${listing.state}, so there is nothing here to verify.`
    };
  }
  if (chosen === 'reject' && String(reason || '').trim().length < 5) {
    return { success: false, reason: 'reason_required', message: 'Tell the shop why, in enough words to act on.' };
  }

  if (chosen === 'approve') {
    listing.state = 'live';
    listing.adminReview = { ...listing.adminReview, status: 'approved', by: actorLabel, at: new Date(), reason: String(reason || '') };
    pushListingEvent(listing, 'verified', actorLabel, reason);
    doc.listing = clone(listing);
    doc.markModified('listing');
    if (kind === 'storefront') doc.verificationStatus = 'verified';
    doc.isListed = true;
    doc.__transition = {
      isListed: true,
      ...(kind === 'storefront' ? { verificationStatus: 'verified' } : {}),
      'listing.state': 'live',
      'listing.adminReview': listing.adminReview
    };
  } else {
    listing.state = 'rejected';
    listing.adminReview = { ...listing.adminReview, status: 'rejected', by: actorLabel, at: new Date(), reason: String(reason || '') };
    pushListingEvent(listing, 'admin-rejected', actorLabel, reason);
    doc.listing = clone(listing);
    doc.markModified('listing');
    if (kind === 'storefront') doc.verificationStatus = 'rejected';
    doc.isListed = false;
    doc.__transition = {
      isListed: false,
      ...(kind === 'storefront' ? { verificationStatus: 'rejected' } : {}),
      'listing.state': 'rejected',
      'listing.adminReview': listing.adminReview
    };
  }
  await doc.save();
  // The shop is told from the state as decided here; `persistTransition` below
  // writes the decided fields explicitly and re-reads them, which is why the
  // message is sent before it rather than from a value that may be re-read.
  await notifyShop({
    doc,
    kind,
    stage: chosen === 'approve' ? 'verified by OptiKart' : 'refused by OptiKart',
    title: chosen === 'approve'
      ? 'Verified - this listing is now visible to buyers'
      : 'OptiKart did not verify this listing',
    reason: String(reason || '')
  });
  await doc.save();
  const stored = await persistTransition(kind, doc._id, doc.__transition || {});
  if (stored?.listing) doc.listing = stored.listing;
  if (kind === 'storefront') doc.verificationStatus = stored?.verificationStatus;
  doc.isListed = stored?.isListed;

  return {
    success: true,
    state: listing.state,
    storedState: stored?.listing?.state ?? null,
    storedVerification: kind === 'storefront' ? (stored?.verificationStatus ?? null) : undefined,
    listing: describe(doc, kind),
    message: chosen === 'approve' ? 'Verified. The listing is live and routing may offer orders to it.' : 'Rejected. It stays invisible.'
  };
};

/**
 * Pause - the seller stops selling, and keeps everything they configured.
 *
 * The old retailer toggle deleted the copy outright, which took its price
 * history, its stock ledger and every order line pointing at it with it. A shop
 * that ran out of stock for a week should not have to rebuild a listing from
 * scratch, and the platform should not lose the record that it existed.
 *
 * Coming back is deliberately not free: the listing re-enters the queue as a
 * fresh claim, so a shop cannot use a pause to park an approval and resume
 * selling later on stale permission.
 */
export const pauseListing = async ({ listingKind, id, actorLabel, reason }) => {
  const found = await loadListing({ listingKind, id });
  if (!found) return { success: false, reason: 'not_found', message: 'That listing does not exist.' };
  const { doc, kind } = found;
  const listing = { ...(doc.listing || {}) };

  listing.state = 'paused';
  listing.pausedAt = new Date();
  listing.pausedBy = String(actorLabel || '');
  pushListingEvent(listing, 'paused', actorLabel, reason);
  doc.listing = clone(listing);
  doc.markModified('listing');
  doc.isListed = false;
  if (kind === 'storefront') doc.verificationStatus = 'pending';
  await doc.save();
  await persistTransition(kind, doc._id, {
    isListed: false,
    ...(kind === 'storefront' ? { verificationStatus: 'pending' } : {}),
    'listing.state': 'paused'
  });

  return {
    success: true,
    state: 'paused',
    listing: describe(doc, kind),
    message: 'Paused. Price, variants and stock are kept. Selling it again needs a new supply declaration, the brand\'s approval and a fresh verification.'
  };
};

/** Everything the brand should be looking at, oldest first. */
export const brandQueue = async (brandId) => {
  const products = await Product.find({ manufacturer: brandId }).select('_id title brand').lean();
  /*
   * ObjectIds, not strings. `String(_id)` in a `$in` against an ObjectId path
   * matches nothing, and the failure is silent and total: the brand's queue came
   * back empty for every claim, which looks exactly like "no shop has asked to
   * list your brand" - the one state in which a brand does nothing and a
   * diversion succeeds anyway.
   */
  const ids = products.map((x) => x._id);

  const clones = await Product.find({ manufacturerProduct: { $in: ids }, 'listing.state': 'awaiting_manufacturer' })
    .sort({ updatedAt: 1 })
    .lean();
  const stocks = await SellerStock.find({ product: { $in: ids }, 'listing.state': 'awaiting_manufacturer' })
    .sort({ updatedAt: 1 })
    .lean();

  return [
    ...clones.map((d) => describe(d, 'storefront')),
    ...stocks.map((d) => describe(d, 'stock'))
  ].sort((a, b) => new Date(a.listing?.sellerProof?.declaredAt || 0) - new Date(b.listing?.sellerProof?.declaredAt || 0));
};

/** Everything waiting on the platform's verification. */
export const adminQueue = async () => {
  const clones = await Product.find({ 'listing.state': 'awaiting_admin' }).sort({ updatedAt: 1 }).lean();
  const stocks = await SellerStock.find({ 'listing.state': 'awaiting_admin' }).sort({ updatedAt: 1 }).lean();
  const grandfathered = await SellerStock.find({ 'listing.grandfathered': true, isListed: true }).limit(200).lean();

  return {
    awaitingVerification: [
      ...clones.map((d) => describe(d, 'storefront')),
      ...stocks.map((d) => describe(d, 'stock'))
    ],
    // Listing that were selling before this rule existed. Nobody has ever
    // confirmed the supply claim, because there was none to confirm.
    grandfathered: grandfathered.map((d) => describe(d, 'stock'))
  };
};
