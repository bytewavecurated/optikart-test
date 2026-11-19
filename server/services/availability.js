/**
 * Storefront availability: can anybody actually sell this product right now,
 * in this configuration, at what price, and - for prescription - which lens
 * types do the shops that hold it actually offer?
 *
 * WHY. The catalogue (manufacturer directory) describes what EXISTS;
 * SellerStock describes what can be BOUGHT. Those are different sets, and the
 * storefront used to consult only the first: a frame that every shop had
 * delisted still rendered its "Choose Lenses"/"Add to Cart" buttons as if it
 * were purchasable, and the lens configurator offered the directory's whole
 * config space even where the only shop holding that frame sold it in one
 * power type and a single colour. Buyers clicked through to a promise nobody
 * could keep.
 *
 * HOW. The admission predicates are IMPORTED from the routing engine
 * (`sellerHoldsConfig` in orderProximity.js, isListed + the listing-approval
 * gate identical to findCandidates), not re-derived: the page's promise and
 * the dispatch engine's capability are now written once, so they cannot drift.
 *
 * LEGACY NOTE. Products created before SellerStock (a shop listing its own
 * product directly, `product.seller` set) may hold no SellerStock rows while
 * still being genuinely purchasable through the owner. Those products are
 * available from their owning shop alone, priced and stocked by the directory
 * row - which is what routing already does with them (they fall to the admin
 * queue, a human decides); the storefront mirrors that, per configuration,
 * with variants from `product.variants`.
 */
import SellerStock from '../models/SellerStock.js';
import { sellerHoldsConfig } from './orderProximity.js';

/** Same listing admission the routing engine uses. */
const stockFilterFor = (productIds) => ({
  product: { $in: productIds },
  isListed: true,
  $or: [{ 'listing.brandLinked': { $ne: true } }, { 'listing.state': 'live' }],
});

/*
 * `sellerIsOpen` mirrors routing's admission for the SHOP itself
 * (`findCandidates` rejects only isBanned / isActive=false); isVerified is a
 * storefront-prominence flag elsewhere, never a supply veto, so including it
 * here would disable listings routing happily delivers from.
 */
const sellerIsOpen = (seller) => !!seller && seller.isActive !== false && seller.isBanned !== true;

const fold = (v) =>
  String(v || '')
    .trim()
    .toLowerCase();

const configKey = ({ color, size }) => `${fold(color)}|${fold(size)}`;

/**
 * Pure aggregation from already-queried inputs so it is unit-testable without
 * a database. `product` must carry _id, seller (or populated sellerId),
 * variants, isActive.
 */
export const aggregateAvailability = ({ product, stocks, legacySeller }) => {
  const byConfig = new Map(); // color|size -> {color,size,sellers,cheapest,inStockAny}
  const addSelling = (key, { color, size }, entry) => {
    const cur = byConfig.get(key) || { color, size, sellers: 0, inStock: 0, cheapest: null, lensTypes: new Set() };
    cur.sellers += 1;
    cur.inStock += entry.held;
    if (entry.price != null && Number.isFinite(entry.price))
      cur.cheapest = cur.cheapest == null ? entry.price : Math.min(cur.cheapest, entry.price);
    for (const t of entry.lensTypes || []) cur.lensTypes.add(t);
    byConfig.set(key, cur);
  };

  let listedSellerRows = 0;
  for (const stock of stocks || []) {
    if (String(stock.product?._id || stock.product) !== String(product._id)) continue;
    if (!sellerIsOpen(stock.seller)) continue;
    listedSellerRows += 1;
    const rows = (stock.variants || []).length
      ? stock.variants
      : [{ color: '', size: '', stock: stock.totalStock, price: stock.sellingPrice }];
    for (const v of rows) {
      const held = Math.max(0, Number(v.stock != null ? v.stock : stock.totalStock) || 0);
      addSelling(configKey(v), v, {
        // The model keeps totalStock derived from variants; a row whose
        // variants are all 0 while totalStock>0 (written before derivation
        // ran) still means the shop holds it - trust the higher number so
        // the promise is never narrower than routing's own view (routing
        // only checks isListed + product + totalStock, never variant rows).
        held: Math.max(held, Number(stock.totalStock) || 0),
        price: v.price != null ? v.price : stock.sellingPrice,
        lensTypes: stock.sellsWithPower ? stock.powerLensTypes || [] : [],
      });
    }
  }

  let directoryIsTruth = false;
  /*
   * Legacy direct-shop listings (a shop's OWN product - `product.seller` set,
   * no SellerStock rows anywhere for it) are genuinely purchasable through
   * the owner, priced and stocked by the directory fields. The storefront
   * must not disable what checkout can still deliver - and these are exactly
   * the products the marketplace was running on before multi-seller stock
   * existed.
   */
  if (listedSellerRows === 0 && sellerIsOpen(legacySeller) && product.isActive !== false) {
    const rows = (product.variants || []).filter((v) => v.isActive !== false);
    const usable = rows.filter((v) => (Number(v.stock) || 0) > 0);
    // Show every configuration the shop lists; in-stock ones gate the Buy
    // button, out-of-stock ones explain themselves. A product with NO
    // variant rows at all is priced/stocked by its top-level fields.
    for (const v of rows.length ? rows : [{ _flat: true }]) {
      const flat = v._flat;
      const held = flat ? Math.max(0, Number(product.stock) || 0) : Math.max(0, Number(v.stock) || 0); // a listed-out variant still SHOWS, with inStock 0
      addSelling(flat ? '|' : configKey(v), flat ? { color: '', size: '' } : v, {
        held,
        price: (flat ? null : v.price) ?? product.discountedPrice ?? product.price,
        lensTypes: [],
      });
    }
  }

  /*
   * Third source, and the last honest one: an owner-less product that no shop
   * has listed. Today's checkout still sells these from `product.stock`
   * (direct, not routed), so the storefront must keep buying them exactly as
   * much as before this module existed. Flagged, because "no seller chose to
   * list this" may still be worth saying to the buyer on frames/sunglasses.
   */
  // Consumables (contact lenses, solutions, accessories) are sold from the
  // lab/owner's own stock - no shop holds "a box of AC lenses in -2.25", the
  // power is built per order. Eyewear without any listing shop and without an
  // open owner is genuinely nobody-to-fulfil: that is the honest empty state,
  // not a directory row somebody will never honour.
  const CONSUMABLE = ['contactlenses', 'solution', 'accessories'];
  if (
    listedSellerRows === 0 &&
    !sellerIsOpen(legacySeller) &&
    product.isActive !== false &&
    CONSUMABLE.includes(String(product.category || '').toLowerCase())
  ) {
    directoryIsTruth = true;
    addSelling(
      '|',
      { color: '', size: '' },
      {
        held: Math.max(0, Number(product.stock) || 0),
        price: product.discountedPrice ?? product.price,
        lensTypes: [],
      }
    );
  }

  const configs = [...byConfig.values()].map((c) => ({
    color: c.color || '',
    size: c.size || '',
    sellers: c.sellers,
    inStock: c.inStock,
    cheapest: c.cheapest,
    lensTypes: [...c.lensTypes],
    buyable: c.sellers > 0 && c.inStock > 0,
  }));

  const anyBuyable = configs.some((c) => c.inStock > 0);
  const totalSellers = configs.reduce((s, c) => s + c.sellers, 0);
  const cheapestPrice =
    configs
      .filter((c) => c.inStock > 0 && c.cheapest != null)
      .map((c) => c.cheapest)
      .sort((a, b) => a - b)[0] ?? null;

  return {
    sellable: configs.some((c) => c.buyable),
    // Every configuration some shop lists - in stock or not - so the page can
    // disable the precise one that is missing rather than the whole product.
    configs,
    anyBuyable,
    totalSellersWhoList: totalSellers,
    cheapestPrice,
    powered: [...new Set(configs.flatMap((c) => c.lensTypes))],
    // True when the only supply source is the product's own directory stock
    // (no shops, no open owner listing) - the checkout keeps selling these as
    // direct listings, and the storefront says so instead of pretending.
    directoryDirect: directoryIsTruth,
    // Whether `powered` can be trusted as complete: SellerStock rows carry the
    // declaration; legacy owner-listed products have no rows, so an empty
    // list there means "not reported", not "nobody sells lenses with this".
    poweredAuthoritative: listedSellerRows > 0,
    // What the storefront must not show as buyable-but-fake:
    reasonWhenUnsellable: buildReason(product, configs, totalSellers, legacySeller),
  };
};

const buildReason = (product, configs, totalSellers, legacySeller) => {
  if (configs.some((c) => c.buyable)) return null;
  if (!product.isActive) return 'This listing is not active.';
  if (configs.length === 0) {
    return 'No shop sells this on OptiKart yet. Manufacturers list the catalogue here; shops choose what to stock.';
  }
  return 'Shops list this frame, but none can supply the configuration you picked right now - try another colour or size, or check back later.';
};

/**
 * Database-backed entry: one query, one aggregation. `products` are lean
 * documents (id, isActive, price, stock, variants, seller) in a Map/array;
 * seller population happens in the stock query only (legacy owner resolved
 * per-product by the caller if needed).
 */
export const availabilityForProducts = async (products) => {
  const ids = products.map((p) => p._id);
  const stocks = await SellerStock.find(stockFilterFor(ids)).populate('seller', 'isActive isBanned isVerified').lean();
  const out = {};
  const byProduct = new Map();
  for (const s of stocks) {
    const pid = String(s.product?._id || s.product);
    byProduct.set(pid, [...(byProduct.get(pid) || []), s]);
  }
  for (const product of products) {
    const legacySeller = product.seller && typeof product.seller === 'object' ? product.seller : null;
    out[String(product._id)] = aggregateAvailability({
      product,
      stocks: byProduct.get(String(product._id)) || [],
      legacySeller,
    });
  }
  return out;
};
