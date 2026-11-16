import { foldBrand } from './brandOwnership.js';

/**
 * The brand → products manifest.
 *
 * When the desk approves a brand, the manufacturer is told two different things
 * that are easy to confuse: *approved* (a decision about the mark) and *here is
 * what that covers* (a set of listings with states of their own). A message that
 * says only "your brand was approved" leaves them guessing whether their
 * products went live with it - and the answer is usually no, because each product
 * still needs its own verification. So the approval notification carries the
 * manifest, and the manifest states its own limits.
 *
 * Grouping is by the shared fold, not by exact spelling: a sheet where half the
 * rows say "Ray-Ban" and half say "ray ban" is one brand to a shopper and to the
 * unique slug, so it must be one entry here. Anything else shows a manufacturer
 * two brands where the storefront has one.
 */

/*
 * Product's real vocabulary, checked against models/Product.js rather than
 * assumed: `verificationStatus` is one of pending | verified | rejected |
 * data_incorrect (there is no isVerified on a product - that field belongs to
 * Seller, and reading it here would have quietly reported every listing as
 * pending forever), plus isActive and isDiscontinued. "Live on the storefront"
 * means exactly what routes/product.js's own VISIBLE_PRODUCTS gate means,
 * because a manifest that disagrees with the list the customer sees is worse
 * than no manifest at all.
 */
const STATE_LABELS = {
  live: 'live on the storefront',
  pending: 'submitted, waiting on product verification',
  rejected: 'rejected - see the reason on the listing',
  data_incorrect: 'sent back because the data did not match the product',
  inactive: 'switched off by you, not visible to shoppers',
  discontinued: 'discontinued, not offered any more',
};

const stateOf = (product) => {
  if (product.isDiscontinued) return 'discontinued';
  if (product.isActive === false) return 'inactive';
  const v = String(product.verificationStatus || 'pending');
  if (v === 'verified') return 'live';
  if (v === 'rejected') return 'rejected';
  if (v === 'data_incorrect') return 'data_incorrect';
  return 'pending';
};

/**
 * @param brands      distinct brand strings seen on the manufacturer's products
 * @param products    the manufacturer's product rows (lean)
 * @param records     Brand documents keyed by slug, for status/logo/decisions
 */
export function buildBrandManifest({ products = [], brandRecords = [] } = {}) {
  const bySlug = new Map(brandRecords.map((b) => [b.slug, b]));
  const groups = new Map();
  let skippedNoBrand = 0;

  for (const p of products) {
    const raw = p.brand ?? p.brandName ?? null;
    if (raw == null || String(raw).trim() === '') {
      /*
       * Counted, never silently skipped. A projection that forgets `brand` (one
       * did) returns rows whose brand is undefined; grouping would then answer
       * "this manufacturer has no branded products" - a plausible-looking empty
       * result rather than an error. With the counter, an unexpected zero has a
       * number attached to it.
       */
      skippedNoBrand += 1;
      continue;
    }
    const slug = foldBrand(raw);
    if (!groups.has(slug)) {
      groups.set(slug, {
        brand: String(raw).trim(),
        slug,
        registered: bySlug.get(slug) || null,
        products: [],
      });
    }
    const group = groups.get(slug);
    // Keep the registered spelling: two sheets half "Ray-Ban", half "ray ban"
    // are one brand to the storefront, and a manifest that lists both spellings
    // tells the manufacturer they have two.
    if (group.registered?.name && group.brand !== group.registered.name) group.brand = group.registered.name;
    const state = stateOf(p);
    group.products.push({
      _id: String(p._id),
      title: p.title,
      sku: p.sku || null,
      state,
      stateLabel: STATE_LABELS[state],
      // Only fields confirmed on models/Product.js. `product.rejectionReason`
      // (with the wrong identifier) once lived here and was a ReferenceError
      // that no syntax check could see; a stale `supplyClaims` read pretended a
      // relationship that belongs to SellerStock. This projection is asserted by
      // scripts/brand_manifest_unit.mjs so the next invented field fails CI.
      rejectionReason: p.rejectionReason || null,
      verificationNotes: p.verificationNotes || null,
      price: p.price ?? null,
      stock: p.stock ?? null,
      category: p.category || null,
    });
  }

  let live = 0;
  for (const g of groups.values()) for (const item of g.products) if (item.state === 'live') live += 1;

  const brands = [...groups.values()]
    .sort((a, b) => a.brand.localeCompare(b.brand))
    .map((g) => ({
      brand: g.brand,
      slug: g.slug,
      status: g.registered?.status || 'unregistered',
      logoUrl: g.registered?.logo?.url || null,
      decisionNote: g.registered?.decision?.note || null,
      decidedAt: g.registered?.decision?.at || null,
      total: g.products.length,
      byState: g.products.reduce((acc, item) => {
        acc[item.state] = (acc[item.state] || 0) + 1;
        return acc;
      }, {}),
      products: g.products,
    }));

  return {
    brands,
    // Non-zero only when rows arrived without a brand field - see the counter above.
    skipped: { withoutBrand: skippedNoBrand },
    totals: {
      brands: brands.length,
      products: brands.reduce((n, b) => n + b.total, 0),
      live,
    },
    /**
     * Stated because it is the part people assume wrongly: a brand decision does
     * not publish listings, and this document only covers brands with at least
     * one product. A registered brand with no products yet is invisible here and
     * must be reported separately, not silently missing from the count.
     */
    limitations: [
      'This covers brands that already have at least one product from this manufacturer.',
      'A brand decision does not publish a listing: each product keeps its own verification state.',
      'Prices and stock are shown as recorded now and change afterwards.',
    ],
  };
}

export function manifestSummaryText(manifest, brandName) {
  const one = manifest.brands.find((b) => b.brand === brandName) || manifest.brands[0];
  if (!manifest.brands.length) {
    return `${brandName} was approved. You have no products under it yet - add listings and each one still needs its own verification.`;
  }
  const liveCount = one.byState.live || 0;
  const pending = one.total - liveCount;
  return `${brandName} was approved. Manifest: ${one.total} product(s) under it - ${liveCount} live now, ${pending} not live yet (each one keeps its own verification, and switching a product off is yours to do).`;
}
