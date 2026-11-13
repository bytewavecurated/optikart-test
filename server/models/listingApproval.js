/**
 * The listing-approval contract, shared by both ways a seller reaches a buyer.
 *
 * There are two, and they had the same hole from opposite sides:
 *
 *  - a manufacturer's retailer toggles a brand product into their own store,
 *    which copied the brand record - `status: 'verified'` included - and put it
 *    straight on the storefront;
 *  - a seller adds `SellerStock` for a product, which is what order routing
 *    reads when it decides who can fulfil an order.
 *
 * Neither asked where the goods came from. So a shop that had never been
 * supplied by a brand could list that brand's frames, or claim stock of them,
 * and the platform would route customers to it. That is the leak this closes:
 * a listing of somebody else's brand is a claim about your supply, and a claim
 * of that kind is confirmed by the brand before it is allowed in front of
 * customers, then checked once more by the platform.
 *
 * States, in order:
 *
 *   awaiting_manufacturer  declared, brand has not decided yet - NOT sellable
 *   awaiting_admin         brand approved, platform has not verified - NOT sellable
 *   live                   both agreed - sellable
 *   rejected               stopped, with a reason - not sellable until re-declared
 *   paused                 the seller's own choice to stop, config preserved
 *
 * `sellerProof` is required at declaration: either a purchase reference the
 * brand can look up, or an honest statement that the stock did not come from
 * them, which goes to the brand anyway. A seller who cannot say is not allowed
 * to list, because listing then would be an unexamined claim.
 *
 * Grandfathering: rows that existed before this rule was introduced are marked
 * `grandfathered` and keep selling, so a new rule does not empty the
 * storefront or silently invalidate a real catalogue. They are visible to the
 * admin queue labelled as such - nobody has ever confirmed them, and that is
 * written down rather than hidden.
 */

const LIVE_STATES = ['live'];

export const LISTING_STATES = [
  'awaiting_manufacturer',
  'awaiting_admin',
  'live',
  'rejected',
  'paused'
];

export const SOURCE_KINDS = ['manufacturer_purchase', 'brand_distribution', 'other'];

export const listingApprovalSchema = {
  /*
   * Whether a brand owns the item being listed. Unbranded goods - a cleaning
   * cloth, a generic case, the seller's own lens stock - are not somebody's
   * brand, so requiring a brand's permission to sell them would be theatre.
   */
  brandLinked: { type: Boolean, default: false },
  state: { type: String, enum: LISTING_STATES, default: 'live' },

  sellerProof: {
    kind: { type: String, enum: SOURCE_KINDS, default: '' },
    // Invoice number, PO, distributor name - whatever the brand can look up.
    reference: { type: String, default: '' },
    note: { type: String, default: '' },
    declaredAt: { type: Date, default: null },
    declaredBy: { type: String, default: '' }
  },

  manufacturerReview: {
    status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    by: { type: String, default: '' },
    brand: { type: String, default: '' },
    at: { type: Date, default: null },
    reason: { type: String, default: '' }
  },

  adminReview: {
    status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    by: { type: String, default: '' },
    at: { type: Date, default: null },
    reason: { type: String, default: '' }
  },

  // The seller chose to stop selling; price, variants and stock are preserved.
  pausedAt: { type: Date, default: null },
  pausedBy: { type: String, default: '' },

  // Re-listing after a pause costs the declaration and both sign-offs again.
  reDeclaredAt: { type: Date, default: null },
  declarationCount: { type: Number, default: 0 },

  grandfathered: { type: Boolean, default: false },
  history: [{
    at: { type: Date, default: Date.now },
    by: { type: String, default: '' },
    action: { type: String, required: true },
    detail: { type: String, default: '' }
  }]
};

export const isSellable = (doc) => {
  const listing = doc?.listing;
  if (!listing || listing.brandLinked !== true) return true;
  return LIVE_STATES.includes(listing.state);
};

export const pushListingEvent = (listing, action, by = '', detail = '') => {
  if (!listing.history) listing.history = [];
  listing.history.push({ at: new Date(), by: String(by || ''), action, detail: String(detail || '').slice(0, 300) });
  if (listing.history.length > 40) listing.history.splice(0, listing.history.length - 40);
};
