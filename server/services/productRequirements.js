/**
 * One definition of what a product must carry - by asking the model.
 *
 * This rule book used to exist three times. The sheet parser listed columns per
 * row ("frameShape", "lensesperbox", "subGender (boys or girls)", ...), the
 * manufacturer dashboard listed a slightly different set in `validateProductForm`
 * ("frame shape / face shape", "boys / girls"), and `models/Product.js` held the
 * real per-category rules in a pre-validate hook that calls `invalidate()` - which
 * is the only place either upload door actually reached. Three lists that must
 * agree, with nothing forcing them to, is how a manufacturer is told one set of
 * requirements by the page they typed into and refused by another.
 *
 * So this module does not keep a list of category rules. It
 *
 *  1. checks the fields that are upload-level rather than schema-level - the ones
 *     the sheet and the form demanded but Mongoose never did (modelNumber,
 *     productCode, at least one usable image), plus alias resolution; and
 *  2. leaves the per-category rules to `models/Product.js`, which validates on
 *     save in the single door and row by row in the sheet. The schema is *not*
 *     re-simulated here: a half-built document (before the door sets the seller,
 *     buckets a measured size, splits the dimensions string) reports things the
 *     door is about to fill in, and that reads to a manufacturer as their valid
 *     upload being refused. What this module adds on top is only what no
 *     persistence path enforces for either door: the frame measurements.
 *
 * Both doors therefore cannot disagree, because there is only one set of rules and
 * it lives in `models/Product.js`. A requirement added to the schema shows up in
 * the specification endpoint, in the sheet's per-row errors and in the form's
 * response without any of the three being edited.
 *
 * Kept deliberately out of the required list:
 *
 *  - `stock`: the schema requires it but defaults it to 0, and 0 means "out of
 *    stock" - a real state, not an absent value;
 *  - `mrp`: `models/Product.js` has no mrp field on the manufacturer's catalogue.
 *    A first draft of this file required it, which would have refused every
 *    upload - including the ten single-product calls the suites already make -
 *    while the message claimed it was only enforcing parity. MRP belongs to seller
 *    stock rows, where the price-vs-MRP check already lives.
 *  - `type` is an alias for `frameType` and never for `category`; letting one
 *    column answer two fields would let a sheet pass the category test with the
 *    words "full rim" in it.
 */
import mongoose from 'mongoose';
/*
 * Importing the model registers the schema as a side effect, and this module's
 * specification endpoint needs a *registered* model to validate a probe document.
 * `mongoose.model('Product')` alone throws MissingSchemaError when the model file
 * has not been imported yet - which happens in every script that requires this
 * service for its rules only. A require() inside the function is not available in
 * an ES module, so the import is at the top and the fallback is a lookup.
 */
import Product from '../models/Product.js';

/** Fields an upload must carry that the schema itself does not insist on. */
export const UPLOAD_REQUIRED_FIELDS = [
  'title',
  'brand',
  'category',
  'price',
  'description',
  'modelNumber',
  'productCode',
];

/** Canonical field -> the header spellings a manufacturer's sheet may use. */
export const FIELD_ALIASES = {
  /*
   * 'producttitle' is here because manufacturers head their sheets with whatever
   * their other systems call it, and reading "Product Title" as *no title* is a
   * refusal the form never makes for the same product. The template still says
   * `title`; this is leniency at the door, not a renamed column.
   */
  title: ['title', 'name', 'productname', 'producttitle', 'product'],
  brand: ['brand', 'brandname', 'make'],
  category: ['category', 'producttype'],
  price: ['price', 'sellingprice', 'sellprice'],
  description: ['description', 'desc', 'details'],
  modelNumber: ['modelnumber', 'modelno', 'model'],
  productCode: ['productcode', 'productid', 'sku'],
  images: ['images', 'image', 'imageurls', 'imagelinks'],
};

const LABELS = {
  // Literal, not FRAME_LABELS.x: those are declared below, and referencing them
  // here raised "Cannot access 'FRAME_LABELS' before initialization" at import.
  frameSize: 'Frame size (for example 54-16-135)',
  frameWidth: 'Frame width (mm)',
  frameWeight: 'Frame weight (g)',
  frameColor: 'Frame colour',
  dimensions: 'Frame dimensions (width x height x bridge x temple)',
  title: 'Product title',
  brand: 'Brand',
  category: 'Category',
  price: 'Selling price',
  description: 'Description',
  modelNumber: 'Model number',
  productCode: 'Product code',
  images: 'Image links',
};

/** The sheet's historical column wording; 12 assertions and release notes quote it. */
/*
 * The frame-measurement columns. The schema does not require these (a frame can
 * exist without a temple length), but the product page renders them, the size
 * guide uses them, and the sheet has always asked for them row by row - while the
 * single form asked for them only in its own client-side list.
 *
 * They live here because that is the only place left where "one rule for both
 * upload doors" can be true. Note what does NOT happen: gender, frameShape,
 * frameType and frameMaterial are not repeated below, because models/Product.js
 * already insists on them for eyewear and the schema check runs on the same
 * object; listing them again would produce two messages for one cause.
 */
export const UPLOAD_FRAME_FIELDS = ['frameSize', 'frameWidth', 'frameWeight', 'frameColor'];
const EYEWEAR_CATEGORIES = ['sunglasses', 'eyeglasses', 'readingglasses', 'sportseyewear', 'kids'];

const FRAME_LABELS = {
  frameSize: 'Frame size (for example 54-16-135)',
  frameWidth: 'Frame width (mm)',
  frameWeight: 'Frame weight (g)',
  frameColor: 'Frame colour',
};

/** Sheets write `framecolour`, `colour`, `size`; the form writes canonical keys. */
const FRAME_ALIASES = {
  /*
   * `framedimensions` is the header the sheet template actually uses (the suite
   * payloads prove it), and the parser I replaced read it via
   * text('framedimensions', 'dimensions'). My first version listed only
   * 'dimensions', so a row that supplied "52 x 40 x 18 x 140" was told the
   * column was missing - my stricter rule, not the manufacturer's empty cell.
   */
  dimensions: ['framedimensions', 'dimensions'],
  dimWidth: ['dimwidth'],
  dimHeight: ['dimheight'],
  dimBridge: ['dimbridge'],
  dimTemple: ['dimtemple'],
  frameSize: ['framesize', 'size'],
  frameWidth: ['framewidth', 'width'],
  frameWeight: ['frameweight', 'weight'],
  frameColor: ['framecolor', 'framecolour', 'colour', 'color'],
};

export const SHEET_MISSING_TEXT = {
  title: 'title',
  brand: 'brand',
  category: 'category',
  price: 'price',
  description: 'description',
  modelNumber: 'modelNumber',
  productCode: 'productCode',
  images: 'images',
  frameSize: 'frameSize',
  frameWidth: 'frameWidth',
  frameWeight: 'frameWeight',
  frameColor: 'frameColor',
  dimensions: 'dimensions',
};

export const labelFor = (field) => LABELS[field] || field;
export const sheetTextFor = (problem) => SHEET_MISSING_TEXT[problem.field] || problem.field;

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
const USABLE_IMAGE = /^(https?:\/\/|\/uploads\/|\/assets\/)[^\s|]+/i;
/*
 * A usable image is an absolute URL or a same-origin path this app serves: the
 * single-product form uploads files first and posts the returned
 * `/uploads/products/...` paths back, so a rule demanding /^https?:/\// refused
 * products whose images were already stored on our own disk - my wording about
 * "links" read as if it were the app's contract. The garbage the sheet produces
 * ("undefined", "", bare filenames) still fails, which was the point.
 */
const usableImages = (value) =>
  (Array.isArray(value) ? value : String(value ?? '').split('|'))
    .map((v) => String(v ?? '').trim())
    .filter((v) => USABLE_IMAGE.test(v)).length;
/** Read one field from a record or a pre-normalised header map. */
export function readField(record, field, flat) {
  const source = flat || record || {};
  if (!flat && record && typeof record === 'object' && record[field] !== undefined) return record[field];
  const candidates = FIELD_ALIASES[field] || [
    String(field)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''),
  ];
  for (const c of candidates) if (source[c] !== undefined) return source[c];
  return undefined;
}

/** True when dimensions arrive in any of the three shapes the sheet accepts. */
function hasDimensions(get) {
  if (!isBlank(get('dimensions'))) return true;
  const four = ['width', 'height', 'bridge', 'temple'].every(
    (k) => Number(get(`dim${k[0].toUpperCase()}${k.slice(1)}`)) > 0
  );
  if (four) return true;
  const parts = String(get('frameSize') ?? '')
    .split(/[\s\-x/]+/i)
    .map((n) => parseInt(n, 10))
    .filter(Number.isFinite);
  return parts.length >= 3 && parts[0] > 0 && parts[2] > 0;
}

/**
 * The upload-level checks, then the schema's own checks on the document the door
 * was about to write.
 *
 * @param input     the JSON body of the single-product form (canonical keys)
 * @param options.flat  a normalised header map, for a spreadsheet row
 * @param options.shape the product document the door will save (nested contactLens,
 *                      solution and accessory included) - this is what the schema
 *                      validates, so per-category rules cannot drift from it
 */
export function missingProductFields(input = {}, { flat, shape } = {}) {
  const missing = [];
  const push = (field, message) =>
    missing.push({ field, label: labelFor(field), message: message || `${labelFor(field)} is required` });

  for (const field of UPLOAD_REQUIRED_FIELDS) {
    if (isBlank(readField(input, field, flat))) push(field);
  }

  /*
   * Price must be a usable number rather than merely present: the schema only
   * says `min: 0`, so a text cell ("Rs 999"), a 0 and a negative all used to
   * reach the catalogue through one door or the other, and 0 would have listed a
   * frame as free.
   */
  const priceRaw = readField(input, 'price', flat);
  if (!isBlank(priceRaw)) {
    const price = Number(priceRaw);
    if (!(price > 0)) push('price', 'Selling price must be a number greater than 0');
  }

  /*
   * At least one image. "Required" means a usable link here, not a non-empty
   * cell: sheets have produced the word "undefined" in the images column and the
   * form has posted `images: ['']`, both of which pass a naive emptiness test and
   * render a broken tile on the storefront.
   */
  if (!usableImages(readField(input, 'images', flat))) {
    push('images', 'At least one image link (http/https) is required');
  }

  /*
   * Frame measurements, required of every eyewear row whatever the door. Read
   * from the same source the door already used (flat sheet headers, or the
   * document shape for the form), so the two cannot disagree about what counts.
   */
  const categoryKey = String(readField(input, 'category', flat) ?? '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (EYEWEAR_CATEGORIES.includes(categoryKey)) {
    const readRaw = (key) => {
      /*
       * The canonical camelCase name has to be a candidate too. The first version
       * used FRAME_ALIASES alone, which lists only the *spreadsheet* spellings
       * (lowercase, no separators) - so a JSON body posting frameSize: "54-16-135"
       * was read as empty and a fully specified frame was refused for missing
       * fields it actually had. A test in scripts/product_upload_parity_e2e.mjs now
       * posts a complete product through both doors for exactly this reason.
       */
      const candidates = [key, ...(FRAME_ALIASES[key] || [])];
      if (flat) {
        for (const c of candidates) if (flat[c] !== undefined) return flat[c];
        return undefined;
      }
      const source = shape && typeof shape === 'object' ? shape : input;
      for (const c of candidates) if (source[c] !== undefined) return source[c];
      // The form writes dimensions as a nested object; the sheet writes a string.
      if (key === 'dimensions' && source.dimensions) return source.dimensions;
      return undefined;
    };
    const get = (key) => (key === 'frameSize' ? (readRaw('frameSize') ?? readRaw('size')) : readRaw(key));
    for (const field of UPLOAD_FRAME_FIELDS) {
      const value = get(field);
      if (isBlank(value)) {
        missing.push({ field, label: labelFor(field), message: `${labelFor(field)} is required for ${categoryKey}` });
        continue;
      }
      /*
       * Width and weight are millimetres and grams: a value that is not a
       * positive number is not a measurement, it is a mistake or a stray unit.
       * The size guide shows these numbers, so "abc" or "0" reaching the
       * catalogue is a visible defect rather than a harmless one. frameSize and
       * frameColor are text and deliberately not number-checked here.
       */
      if (field === 'frameWidth' || field === 'frameWeight') {
        const n = Number(String(value).replace(/[^0-9.\-]/g, ''));
        if (!(n > 0)) {
          missing.push({
            field,
            label: labelFor(field),
            message: `${labelFor(field)} must be a number greater than 0 (got "${String(value).trim()}")`,
          });
        }
      }
    }
    if (!hasDimensions((k) => (k === 'dimensions' ? get('dimensions') : get(k)))) {
      missing.push({
        field: 'dimensions',
        label: labelFor('dimensions'),
        message: `${labelFor('dimensions')} is required for ${categoryKey}`,
      });
    }
  }

  /*
   * Per-category rules, straight from models/Product.js. It validates the object
   * the door is about to persist, so nested lens columns, contact-lens optics,
   * solution pack pricing, kids subGender and the frame geometry a storefront
   * filter needs all arrive with the schema's own explanation ("Frame shape is
   * required so the face-shape browse can list this product"), which is a better
   * message than any list a wrapper could write.
   */
  if (shape && typeof shape === 'object' && shape.__simulateSchemaRules === true) {
    /*
     * Off by default and unreachable from either door. Retained only so the parity
     * tests can ask the model directly what it insists on for a category without a
     * full document; production callers pass nothing and get upload-level answers.
     */
    const Product = mongoose.models.Product || mongoose.model('Product');
    const doc = new ProductModel(shape);
    const errors = doc.validateSync();
    if (errors?.errors) {
      const seen = new Set(missing.map((m) => m.field));
      for (const [path, err] of Object.entries(errors.errors)) {
        /*
         * Upload-level fields are the door's business: the record being checked
         * may hold them under a sheet header or a form key the partial shape
         * object does not carry, so the schema's complaint about a missing title
         * here would be an artefact of the shape, not a fact about the upload.
         */
        if (seen.has(path) || UPLOAD_REQUIRED_FIELDS.includes(path) || /^_id$/.test(path)) continue;
        missing.push({ field: path, label: humanizePath(path), message: err.message });
      }
    }
  }

  /*
   * Never state one requirement twice for one cause: the schema reports
   * `price`-adjacent problems too.
   */
  const deduped = [];
  const fields = new Set();
  for (const problem of missing) {
    if (fields.has(problem.field)) continue;
    fields.add(problem.field);
    deduped.push(problem);
  }
  return deduped;
}

/** `contactLens.baseCurve` -> "Base curve"; `dimensions.width` -> "Width". */
function humanizePath(path) {
  const last = String(path).split('.').pop();
  const spaced = last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The specification both doors and the UI render.
 *
 * It is derived, not typed: for each category an empty product is validated and
 * every complaint the schema raises becomes a requirement line. That is the only
 * way this can stay true when models/Product.js changes - a hand-written spec is
 * a second list, which is the thing that caused the original bug.
 */
export function describeRequired() {
  /*
   * The model must exist as a registered schema before a document can be built
   * from it, and this module is imported by routes *and* by scripts that touch no
   * model at all. Requiring the model file is how registration is guaranteed;
   * `mongoose.model('Product')` alone throws MissingSchemaError when nothing has
   * registered it yet, which is a crash in a page that only wanted to read a list.
   */
  const ProductModel = mongoose.models.Product || Product;
  const categories = ProductModel.schema.path('category')?.enumValues || [];
  const eyewear = ['sunglasses', 'eyeglasses', 'readingglasses', 'sportseyewear', 'kids'];
  const perCategory = {};
  for (const category of categories) {
    const doc = new ProductModel({
      category,
      title: 'spec probe',
      brand: 'spec brand',
      price: 1,
      description: 'spec description',
      modelNumber: 'SPEC-1',
      productCode: 'SPEC-1-SKU',
      images: ['https://example.com/spec.png'],
    });
    const errors = doc.validateSync();
    perCategory[category] = Object.entries(errors?.errors || {})
      .filter(([path]) => !UPLOAD_REQUIRED_FIELDS.includes(path) && path !== 'price')
      .map(([path, err]) => ({ field: path, label: humanizePath(path), message: err.message }));
  }
  return {
    upload: UPLOAD_REQUIRED_FIELDS.map((field) => ({
      field,
      label: labelFor(field),
      message: `${labelFor(field)} is required`,
    })),
    images: { min: 1, rule: 'an http(s) link; a spreadsheet takes one or more | separated links in the images column' },
    categories,
    eyewearCategories: eyewear,
    perCategory,
    /*
     * What the frame categories must carry beyond the schema. Published so the
     * form can validate the same list instead of keeping its own - which is the
     * exact shape of the bug this module exists to end.
     */
    uploadCategoryFields: Object.fromEntries(
      EYEWEAR_CATEGORIES.map((category) => [
        category,
        [...UPLOAD_FRAME_FIELDS, 'dimensions'].map((field) => ({ field, label: labelFor(field) })),
      ])
    ),
    aliases: { ...FIELD_ALIASES, ...FRAME_ALIASES },
    notRequired: {
      stock: 'defaults to 0, and 0 means out of stock - a real state, not a missing value',
      mrp: 'the manufacturer catalogue has no MRP field; price against MRP is checked where seller stock is set',
    },
    source:
      'models/Product.js (these rules are produced by validating a real product, so the page cannot drift from the API)',
  };
}

/** The sheet's sentence, in the wording it has always used. */
export function formatMissingForSheet(missing, line, title) {
  return `Row ${line}${title ? ` (${title})` : ''}: missing required ${missing.map(sheetTextFor).join(', ')}`;
}

/*
 * Which fields an upload caller may actually set.
 *
 * The single-product door built its document with `{ ...req.body, manufacturer,
 * isManufacturerProduct: true }`. Everything else came from the request, and that
 * is a privilege escalation, verified against the running API rather than
 * reasoned about: posting `verificationStatus: "verified"` produced a listing that
 * was stored as verified and appeared in the public catalogue immediately, with no
 * review, defeating the whole approval workflow. `isSponsored: true` - a placement
 * the desk sells and controls - was equally self-serviceable.
 *
 * So the door takes an ALLOW-LIST of catalogue fields a manufacturer may write, and
 * ignores everything else. It is derived from the model's own paths minus
 * SERVER_OWNED_FIELDS, which means:
 *  - a new schema field is NOT writable until someone adds it here on purpose
 *    (silently inheriting a new capability is how the last one got in);
 *  - the privilege fields cannot be set by shape, alias, nesting or spelling: they
 *    are dropped by name before the document is built.
 * The route logs what it dropped, because a caller silently losing data to a
 * security rule wastes everyone's afternoon.
 */
export const SERVER_OWNED_FIELDS = [
  // review workflow
  'verificationStatus',
  'verifiedAt',
  'verifiedBy',
  'verificationNotes',
  'rejectionReason',
  'dataCorrectedAt',
  'submittedAt',
  'lastUpdatedAt',
  // placement and commercial controls
  'isSponsored',
  'sponsoredBy',
  'sponsoredAt',
  'commissionPercentage',
  'totalEarnings',
  // ownership and lifecycle, set by the door or by admin action
  'manufacturer',
  'seller',
  'manufacturerSellerId',
  'manufacturerProduct',
  'brandSourceProduct',
  'supplyClaim',
  'isManufacturerProduct',
  'isActive',
  'isRemoved',
  'removedAt',
  'removedBy',
  'blockedByAdmin',
  'blockReason',
  'isDiscontinued',
  'discontinuedAt',
  'discontinuedBy',
  // identity and aggregates the system owns
  'itemCode',
  'uniqueId',
  'listing',
  'ratings',
  'totalRatings',
  'totalReviews',
  'viewCount',
  'sellerOffer',
  'isUnderSaleEvent',
  'saleEventId',
  'effectivePrice',
  'originalDiscountedPrice',
  '__v',
  '_id',
];

/** @returns {{ values: object, dropped: string[] }} */
export function pickUploadableFields(body = {}, schemaPaths = []) {
  const writable = new Set(
    (schemaPaths.length ? schemaPaths : Object.keys(body)).filter(
      (p) => !p.startsWith('__') && !SERVER_OWNED_FIELDS.includes(p) && p !== '_id'
    )
  );
  const values = {};
  const dropped = [];
  for (const [key, value] of Object.entries(body || {})) {
    if (writable.has(key)) values[key] = value;
    else if (SERVER_OWNED_FIELDS.includes(key)) dropped.push(key);
    // an unknown key is neither accepted nor reported as a violation: it is
    // simply not a field on the model, and mongoose would drop it anyway
  }
  return { values, dropped };
}
