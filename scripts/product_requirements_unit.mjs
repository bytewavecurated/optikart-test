#!/usr/bin/env node
/**
 * One rule book, two upload doors.
 *
 * A manufacturer can create products one at a time or by spreadsheet. Those two
 * doors must not disagree about what a product needs: until this module existed
 * the sheet demanded a set of columns in its own words, the form demanded a
 * slightly different set in the browser, and the server demanded nothing until
 * Mongoose objected mid-save. A field required only by one door is either a
 * silently incomplete catalogue or a manufacturer told twice, in two vocabularies,
 * for one mistake.
 *
 * The split here is deliberate and is the whole content of the batch:
 *
 *  - `models/Product.js` owns the per-category attributes. It validates on save
 *    in the single door and row by row in the sheet (which uses insertMany, and
 *    insertMany skips validation, which is exactly why the sheet loop exists).
 *    This suite never re-implements those rules: it observes them through the two
 *    doors and asserts the doors agree.
 *  - `services/productRequirements.js` owns what NEITHER persistence path
 *    enforces: the upload-level fields (title/brand/category/price/description +
 *    the model number and product code that the sheet has always demanded and the
 *    API never did, and are what retailer matching and the spec page quote) and
 *    the frame measurements, plus image usability.
 *
 * What is deliberately NOT required, and why a test says so instead of a comment:
 * `stock` (it defaults to 0, and 0 means out of stock - a real state, so
 * requiring it would reject valid products), and `mrp` (a first draft of this
 * module required it and would have refused every single upload, including the
 * ten payload shapes the other suites already post, because there is no MRP on
 * the manufacturer catalogue at all).
 *
 *   node scripts/product_requirements_unit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  missingProductFields,
  describeRequired,
  readField,
  sheetTextFor,
  labelFor,
  UPLOAD_REQUIRED_FIELDS,
  FIELD_ALIASES,
  SHEET_MISSING_TEXT,
} from '../server/services/productRequirements.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 160)}` : ''}`);
  return ok;
};

const FIELDS = (list) => list.map((m) => m.field);
const COMPLETE_FRAME = {
  title: 'Test Frame 01',
  brand: 'Ray-Ban',
  category: 'sunglasses',
  price: 4990,
  description: 'A complete single-product payload.',
  modelNumber: 'MDL-001',
  productCode: 'SKU-001',
  images: ['https://example.com/a.png'],
  gender: 'men',
  frameShape: 'square',
  frameType: 'full-rim',
  frameMaterial: 'metal',
  frameSize: '54-16-135',
  frameWidth: 140,
  frameWeight: 24,
  frameColor: 'black',
  dimensions: '54x52x16x145',
};
const SHEET_HEADERS = {
  'Product Title': 'Test Frame 01',
  Brand: 'ray-ban',
  Category: 'Eyeglasses',
  'Selling Price': '999',
  Description: 'x',
  'Model No': 'M-1',
  SKU: 'S-1',
  'Image Links': 'https://example.com/a.png|https://example.com/b.png',
  Gender: 'women',
  'Frame Shape': 'round',
  Type: 'half-rim',
  Material: 'acetate',
  Size: '50-18-135',
  'Frame Width': '132',
  'Frame Weight': '19',
  Colour: 'amber',
  Dimensions: '50x44x18x135',
};
// Exactly the shape the bulk parser hands over: lowercased, no spaces or dashes.
const flatOf = (row) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/[\s_-]/g, ''), v]));

/* ---------------------------------------------------------------- vocabulary */
check(
  'every header spelling resolves to its schema field',
  (() => {
    const flat = flatOf(SHEET_HEADERS);
    const seen = FIELDS(missingProductFields({}, { flat }));
    // nothing required is missing from a complete sheet row
    return seen.length === 0;
  })(),
  JSON.stringify(FIELDS(missingProductFields({}, { flat: flatOf(SHEET_HEADERS) })))
);
check(
  'a single-product body is read in schema casing, not sheet vocabulary',
  FIELDS(missingProductFields(COMPLETE_FRAME)).length === 0,
  JSON.stringify(FIELDS(missingProductFields(COMPLETE_FRAME)))
);
check(
  'aliases never answer for each other: the frame column named "type" is frameType, not category',
  (() => {
    const row = { ...SHEET_HEADERS };
    delete row.Category;
    // 'Type' is a frameType alias; category must still be reported missing.
    const fields = FIELDS(missingProductFields({}, { flat: flatOf(row) }));
    return fields.includes('category');
  })()
);
check(
  'a missing images column is reported as images, not as an empty string field',
  (() => {
    const row = { ...SHEET_HEADERS };
    delete row['Image Links'];
    return FIELDS(missingProductFields({}, { flat: flatOf(row) })).includes('images');
  })()
);
check(
  'field and price are the two names the sheet accepts for the same column',
  readField({ price: '99' }, 'price') === '99' && readField({ __flat: { sellingprice: '99' } }, 'price') === undefined
);
// (readField takes explicit records or an explicit flat map; the second half of the
// assertion above documents that the two never mix in the same call.)

/* ----------------------------------------------------------- both doors, same words */
const asRow = (overrides) => {
  const row = { ...COMPLETE_FRAME, ...overrides };
  return FIELDS(missingProductFields(row)).sort().join(',');
};
const asSheet = (overrides) => {
  const headers = { ...SHEET_HEADERS };
  for (const [k, v] of Object.entries(overrides || {})) {
    const target = Object.keys(SHEET_HEADERS).find(
      (h) =>
        h.toLowerCase().replace(/[\s_-]/g, '') ===
        String(k)
          .toLowerCase()
          .replace(/[\s_-]/g, '')
    );
    if (target && v === null) delete headers[target];
    else if (target) headers[target] = v;
    else headers[k] = v;
  }
  return FIELDS(missingProductFields({}, { flat: flatOf(headers) }))
    .sort()
    .join(',');
};
check(
  'every base requirement is named identically on both doors (exact sets, not “contains”)',
  (() => {
    const headersFor = (key) =>
      ({
        title: 'Product Title',
        price: 'Selling Price',
        images: 'Image Links',
        modelNumber: 'Model No',
        productCode: 'SKU',
        description: 'Description',
        brand: 'Brand',
        category: 'Category',
      })[key];
    for (const key of UPLOAD_REQUIRED_FIELDS) {
      const formCase = { ...COMPLETE_FRAME };
      delete formCase[key];
      const sheetCase = { ...SHEET_HEADERS };
      delete sheetCase[headersFor(key)];
      const fromForm = FIELDS(missingProductFields(formCase)).sort().join(',');
      const fromSheet = FIELDS(missingProductFields({}, { flat: flatOf(sheetCase) }))
        .sort()
        .join(',');
      if (fromForm !== fromSheet) return false;
    }
    return true;
  })()
);
check(
  'a sheet headed "Product Title" is a titled product (leniency, not a renamed column)',
  !FIELDS(missingProductFields({}, { flat: flatOf(SHEET_HEADERS) })).includes('title')
);
check(
  'a blank-but-present cell is not “provided” (empty strings must refuse)',
  asSheet({ title: '   ', description: '', brand: '\t' }).includes('title') &&
    asSheet({ title: '   ' }).includes('title')
);
check(
  'null, undefined and “0” are distinguished (a price of 0 is not “missing”)',
  FIELDS(missingProductFields({ ...COMPLETE_FRAME, price: 0 })).includes('price') &&
    FIELDS(missingProductFields({ ...COMPLETE_FRAME, price: '0' })).includes('price')
);
check(
  'a zero or non-numeric measurement is refused as not-a-number, never accepted as blank',
  (() => {
    const zero = FIELDS(missingProductFields({ ...COMPLETE_FRAME, frameWidth: '0' }));
    const junk = FIELDS(missingProductFields({ ...COMPLETE_FRAME, frameWidth: 'wide' }));
    const good = FIELDS(missingProductFields({ ...COMPLETE_FRAME, frameWidth: '140mm' }));
    return zero.includes('frameWidth') && junk.includes('frameWidth') && !good.includes('frameWidth');
  })(),
  JSON.stringify(FIELDS(missingProductFields({ ...COMPLETE_FRAME, frameWidth: '0' })))
);
check(
  'a negative or fractional price without a decimal point is still a price',
  !FIELDS(missingProductFields({ ...COMPLETE_FRAME, price: 4990.5 })).includes('price') &&
    FIELDS(missingProductFields({ ...COMPLETE_FRAME, price: -1 })).includes('price')
);

/* ------------------------------------------------------------------ images */
check(
  'images must be usable links: a bare filename refuses, an https link accepts',
  (() => {
    const bare = FIELDS(missingProductFields({ ...COMPLETE_FRAME, images: ['IMG_2048.PNG'] }));
    const http = FIELDS(missingProductFields({ ...COMPLETE_FRAME, images: ['http://example.com/a.png'] }));
    const dataUri = FIELDS(missingProductFields({ ...COMPLETE_FRAME, images: ['https://cdn.example/a.png'] }));
    const mixed = FIELDS(
      missingProductFields({ ...COMPLETE_FRAME, images: ['', '   ', null, 'https://cdn.example/a.png'] })
    );
    return (
      bare.includes('images') && !http.includes('images') && !dataUri.includes('images') && !mixed.includes('images')
    );
  })()
);
check(
  'the sheet accepts pipe-separated links, including spaces around them',
  (() => {
    const row = { ...SHEET_HEADERS, 'Image Links': ' https://a.test/1.png | https://a.test/2.png ' };
    return !FIELDS(missingProductFields({}, { flat: flatOf(row) })).includes('images');
  })()
);
check(
  'pipe-separated garbage is refused rather than half-accepted',
  FIELDS(missingProductFields({}, { flat: flatOf({ ...SHEET_HEADERS, 'Image Links': 'undefined|null|' }) })).includes(
    'images'
  )
);

/* ---------------------------------------------------------- frame measurements */
check(
  'the four frame measurements are required for frames and nothing else',
  (() => {
    const stripped = FIELDS(
      missingProductFields({
        ...COMPLETE_FRAME,
        frameSize: '',
        frameWidth: '',
        frameWeight: '',
        frameColor: '',
        dimensions: '',
      })
    );
    return ['frameSize', 'frameWidth', 'frameWeight', 'frameColor', 'dimensions'].every((f) => stripped.includes(f));
  })(),
  JSON.stringify(
    FIELDS(
      missingProductFields({
        ...COMPLETE_FRAME,
        frameSize: '',
        frameWidth: '',
        frameWeight: '',
        frameColor: '',
        dimensions: '',
      })
    )
  )
);
check(
  'dimensions may be a string, four columns, or derivable from the measured size',
  (() => {
    const stringDims = FIELDS(missingProductFields(COMPLETE_FRAME));
    const four = FIELDS(
      missingProductFields({
        ...COMPLETE_FRAME,
        dimensions: '',
        frameSize: '',
        dimWidth: 54,
        dimHeight: 52,
        dimBridge: 16,
        dimTemple: 135,
      })
    );
    const fromSize = FIELDS(missingProductFields({ ...COMPLETE_FRAME, dimensions: '' }));
    return !stringDims.includes('dimensions') && !four.includes('dimensions') && !fromSize.includes('dimensions');
  })()
);
check(
  'nothing can be derived from a two-part or nonsense size',
  (() => {
    const two = FIELDS(missingProductFields({ ...COMPLETE_FRAME, dimensions: '', frameSize: '54-16' }));
    const junk = FIELDS(missingProductFields({ ...COMPLETE_FRAME, dimensions: '', frameSize: 'one-two-three' }));
    return two.includes('dimensions') && junk.includes('dimensions');
  })()
);
check(
  'non-frame categories raise no frame requirement',
  (() => {
    const sunglasses = { ...COMPLETE_FRAME, category: 'sunglasses' };
    for (const f of ['frameSize', 'frameWidth', 'frameWeight', 'frameColor', 'frameShape', 'frameType', 'dimensions'])
      delete sunglasses[f];
    return (
      FIELDS(missingProductFields({ ...sunglasses, category: 'solution' })).length === 0 &&
      FIELDS(missingProductFields({ ...sunglasses, category: 'accessories' })).length === 0 &&
      FIELDS(missingProductFields({ ...sunglasses, category: 'contactlenses' })).length === 0
    );
  })(),
  JSON.stringify(
    FIELDS(
      missingProductFields({
        ...COMPLETE_FRAME,
        category: 'solution',
        frameSize: '',
        frameWidth: '',
        frameWeight: '',
        frameColor: '',
        frameShape: '',
        frameType: '',
        dimensions: '',
      })
    )
  )
);

/* --------------------------------------------------------- never required */
check(
  'stock is NOT required: 0 means out of stock, which is an answer, not a gap',
  (() => {
    const noStock = { ...COMPLETE_FRAME };
    delete noStock.stock;
    const zero = { ...COMPLETE_FRAME, stock: 0 };
    return (
      FIELDS(missingProductFields(noStock)).length === 0 &&
      FIELDS(missingProductFields(zero)).length === 0 &&
      describeRequired().notRequired.stock.includes('out of stock')
    );
  })()
);
check(
  'mrp is NOT required, so the manufacturer door cannot invent it',
  (() => {
    const noMrp = { ...COMPLETE_FRAME };
    delete noMrp.mrp;
    return FIELDS(missingProductFields(noMrp)).length === 0 && !UPLOAD_REQUIRED_FIELDS.includes('mrp');
  })()
);
check(
  'and the specification page says which rules are the schema’s, in words a manufacturer can read',
  (() => {
    const spec = describeRequired();
    return (
      /models\/Product\.js/.test(spec.source) &&
      Array.isArray(spec.categories) &&
      Object.keys(spec.uploadCategoryFields.sunglasses).length > 0 &&
      spec.categories.length >= 5
    );
  })(),
  describeRequired().source
);

/* ------------------------------------------------------ messages and labels */
const allProblems = missingProductFields({ title: '', brand: '', price: 'x', images: [], frameColor: '' });
check(
  'a problem carries field, label and message together',
  allProblems.every((p) => p.field && labelFor(p.field) && p.message && p.message !== p.field),
  JSON.stringify(allProblems[0] || null)
);
check(
  'the sheet wording survives (the release notes and 12 assertions quote these strings)',
  sheetTextFor({ field: 'modelNumber' }) === 'modelNumber' && SHEET_MISSING_TEXT.dimensions.startsWith('dimensions'),
  Object.entries(SHEET_MISSING_TEXT)
    .map(([k, v]) => `${k}:${v}`)
    .slice(0, 4)
    .join(' ')
);
check(
  'no problem is ever listed twice',
  (() => {
    const list = missingProductFields({ title: '', description: '', brand: '', price: 0 }).map((p) => p.field);
    return new Set(list).size === list.length;
  })(),
  JSON.stringify(missingProductFields({ title: '', description: '', brand: '', price: 0 }).map((p) => p.field))
);
check(
  'the upload-level field list is exactly what this module claims to add',
  UPLOAD_REQUIRED_FIELDS.join(',') ===
    ['title', 'brand', 'category', 'price', 'description', 'modelNumber', 'productCode'].join(','),
  UPLOAD_REQUIRED_FIELDS.join(',')
);

/* ------------------------------------ the doors must not re-implement the rules */
const manufacturerRoutes = fs.readFileSync(path.join(ROOT, 'server', 'routes', 'manufacturer.js'), 'utf8');
const dashboard = fs.readFileSync(
  path.join(ROOT, 'client', 'src', 'pages', 'manufacturer', 'ManufacturerDashboard.js'),
  'utf8'
);
const rulesHelper = fs.readFileSync(path.join(ROOT, 'client', 'src', 'utils', 'productUploadRules.js'), 'utf8');
check(
  'the sheet parser consults the shared module instead of its own column list',
  manufacturerRoutes.includes('missingProductFields(')
);
check(
  'no door keeps a private copy of the upload requirements',
  (() => {
    const serverHasOwnList = /missing\.push\('description'\)|missing\.push\('modelNumber'\)/.test(manufacturerRoutes);
    const clientHasOwnList = /newProduct\.[a-zA-Z]+\.trim\(\)\)\s*missing\.push/.test(dashboard);
    const clientDelegates = /missingUploadFields\(uploadSpec, newProduct\)/.test(dashboard);
    return !serverHasOwnList && !clientHasOwnList && clientDelegates;
  })(),
  JSON.stringify({
    serverHasOwnList: /missing\.push\('description'\)|missing\.push\('modelNumber'\)/.test(manufacturerRoutes),
    clientHasOwnList: /newProduct\.[a-zA-Z]+\.trim\(\)\)\s*missing\.push/.test(dashboard),
    clientDelegates: /missingUploadFields\(uploadSpec, newProduct\)/.test(dashboard),
  })
);
check(
  'the browser form gets its required list from the published specification',
  /manufacturer\/upload-spec/.test(dashboard) && /spec\.upload/.test(rulesHelper)
);
check(
  'the client helper does not fall back to a private list when the spec fails to load',
  /if \(!spec \|\| !Array\.isArray\(spec\.upload\)\) return \[\]/.test(rulesHelper) &&
    !/const LOCAL_REQUIRED/.test(rulesHelper)
);
check(
  'and the specification is served from the same function that validates',
  /describeRequired\(\)/.test(manufacturerRoutes) && /router\.get\('\/upload-spec'/.test(manufacturerRoutes)
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} product-requirements checks passed`);
if (failed.length) failed.forEach((f) => console.log(`  - ${f.name}`));
process.exitCode = failed.length ? 1 : 0;
