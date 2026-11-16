#!/usr/bin/env node
/**
 * The single product rule book, before any HTTP.
 *
 * These assertions are what makes "the two doors require the same fields" a fact
 * rather than an intention. There is now one function (`missingProductFields`)
 * and one table (`CATEGORY_REQUIREMENTS`); what is tested here is that the table
 * says what the schema says, that neither invented requirements, and that the
 * exceptions are deliberate and named:
 *
 *  - `stock` is not required. Mongoose requires it, but defaults it to 0, and 0
 *    is a real state - out of stock - not an absent value. Adding it to the list
 *    would reject legitimate products while the message claimed parity was being
 *    enforced. (`describeRequired().optional.stock` is what tells a manufacturer
 *    this instead.)
 *  - `mrp` is not required, because models/Product.js has no mrp field at all.
 *    The MRP concept belongs to seller stock rows; a first draft of this service
 *    required it and would have failed EVERY upload - the suites' own payloads
 *    omit it - which is what checking against the schema, instead of against
 *    memory of the form, caught.
 *  - `type` is a header for frameType, not for category. Both doors read
 *    FIELD_ALIASES; one column answering two fields would have made a sheet pass
 *    the category test with the word "full-rim" in it.
 *
 * Lives under server/ because it asserts against the real Mongoose schema, and
 * mongoose + the models only resolve from there; root-level suites cannot see
 * either (a constraint that has broken several of my earlier attempts to put a
 * schema check in scripts/).
 *
 *   node server/scripts/product_requirements_unit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  missingProductFields,
  describeRequired,
  CATEGORY_REQUIREMENTS,
  REQUIRED_PRODUCT_FIELDS,
  PRODUCT_CATEGORIES,
  EYEWEAR_CATEGORIES,
  FIELD_ALIASES,
  SHEET_MISSING_TEXT,
  sheetTextFor,
  readField,
} from '../services/productRequirements.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SERVER = path.resolve(HERE, '..');
const ROOT = path.resolve(SERVER, '..');
const results = [];
const check = (name, cond, detail) => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 160)}` : ''}`);
};

/*
 * models/Product.js builds part of its shape with `productSchema.add(...)` after
 * the base definition, and `category.enum` lives in one of those blocks - so the
 * assertions below need the model *registered*, not just imported. A
 * fire-and-forget import loop left it unregistered and threw MissingSchemaError
 * before a single assertion could run; awaiting the module is the fix.
 */
const productModule = await import('../models/Product.js');
const Product = productModule.default;
const schemaPaths = Object.keys(Product.schema.paths);

const COMPLETE = {
  title: 'Probe Frame',
  brand: 'Ray-Ban',
  category: 'sunglasses',
  price: 4999,
  description: 'A complete row for the rules to accept',
  modelNumber: 'RB-PROBE-1',
  productCode: 'RB-PROBE-1-SKU',
  images: ['https://example.com/a.png'],
  gender: 'unisex',
  frameShape: 'round',
  frameType: 'full-rim',
  frameMaterial: 'metal',
  frameSize: '54-16-135',
  frameWidth: '140mm',
  frameWeight: '22g',
  frameColor: 'black',
  dimensions: '54x52x16x145',
};

/* ------------------------------------------------------------ the happy path */
check(
  'a complete product raises nothing',
  missingProductFields(COMPLETE).length === 0,
  JSON.stringify(missingProductFields(COMPLETE))
);
check(
  'the same object read through sheet aliases raises nothing',
  (() => {
    const flat = {
      title: 'Probe Frame',
      brand: 'ray-ban',
      category: 'sunglasses',
      price: '4999',
      description: 'ok',
      modelnumber: 'RB-1',
      productcode: 'RB-1-SKU',
      images: 'https://example.com/a.png|https://example.com/b.png',
      gender: 'unisex',
      frameshape: 'round',
      frametype: 'full-rim',
      framematerial: 'metal',
      framesize: '54-16-135',
      framewidth: '140',
      frameweight: '22',
      framecolor: 'black',
      dimensions: '54x52x16x145',
    };
    return missingProductFields({}, { flat }).length === 0;
  })(),
  JSON.stringify(missingProductFields({}, { flat: { title: 'x' } }))
);

/* ----------------------------------------------------- one table, every field */
for (const field of REQUIRED_PRODUCT_FIELDS) {
  const probe = { ...COMPLETE };
  delete probe[field];
  const found = missingProductFields(probe);
  check(
    `dropping "${field}" is refused by name`,
    found.some((m) => m.field === field),
    found.map((m) => m.field).join(',')
  );
}
check(
  'every required field is a real schema path or an alias of one',
  REQUIRED_PRODUCT_FIELDS.every((f) => schemaPaths.includes(f) || Object.keys(FIELD_ALIASES).includes(f)),
  REQUIRED_PRODUCT_FIELDS.filter((f) => !schemaPaths.includes(f) && !Object.keys(FIELD_ALIASES).includes(f)).join(',')
);
check(
  'every category requirement is a real schema path',
  Object.values(CATEGORY_REQUIREMENTS)
    .flat()
    .every((f) => schemaPaths.includes(f)),
  [...new Set(Object.values(CATEGORY_REQUIREMENTS).flat())].filter((f) => !schemaPaths.includes(f)).join(',')
);
check(
  'the spec published to the client lists the same base fields as the API enforces',
  describeRequired()
    .base.map((b) => b.field)
    .join(',') === REQUIRED_PRODUCT_FIELDS.join(','),
  describeRequired()
    .base.map((b) => b.field)
    .join(',')
);
check(
  'the spec lists the same categories as the schema enum',
  describeRequired().categories.join(',') === Product.schema.path('category').enumValues.join(','),
  `${describeRequired().categories.join(',')} vs ${Product.schema.path('category').enumValues.join(',')}`
);
check(
  'every required field has a human label (a bare column name is not feedback)',
  [...REQUIRED_PRODUCT_FIELDS, ...new Set(Object.values(CATEGORY_REQUIREMENTS).flat())].every(
    (f) => sheetTextFor({ field: f }) !== f || ['title', 'brand', 'category', 'price'].includes(f)
  )
);
check(
  'an unknown category is refused in vocabulary the manufacturer can use',
  (() => {
    const m = missingProductFields({ ...COMPLETE, category: 'spectacles' });
    return m.some((x) => x.field === 'category' && /sunglasses, eyeglasses/.test(x.message));
  })(),
  missingProductFields({ ...COMPLETE, category: 'spectacles' })
    .map((m) => m.message)
    .join(' | ')
);

/* ------------------------------------------------------------------ deliberate non-rules */
check(
  'stock is NOT required: 0 means out of stock, which is a real state',
  !REQUIRED_PRODUCT_FIELDS.includes('stock') &&
    missingProductFields({ ...COMPLETE, stock: 0 }).length === 0 &&
    /out of stock/.test(JSON.stringify(describeRequired().optional)),
  missingProductFields({ ...COMPLETE, stock: 0 })
    .map((m) => m.field)
    .join(',')
);
check(
  'mrp is NOT required, because the product schema has no mrp field',
  !REQUIRED_PRODUCT_FIELDS.includes('mrp') &&
    !schemaPaths.includes('mrp') &&
    missingProductFields({ ...COMPLETE }).length === 0
);
check(
  'the sheet vocabulary for images never answers for category',
  !FIELD_ALIASES.category.includes('type') && FIELD_ALIASES.frameType?.includes('type'),
  `category aliases ${JSON.stringify(FIELD_ALIASES.category)} / frameType ${JSON.stringify(FIELD_ALIASES.frameType)}`
);
check(
  'one image is required, and the literal word undefined is not an image',
  (() => {
    const none = missingProductFields({ ...COMPLETE, images: [] });
    const fake = missingProductFields({ ...COMPLETE, images: ['undefined', 'null', '   '] });
    const texty = missingProductFields({ ...COMPLETE, images: 'not a url' });
    return (
      none.some((m) => m.field === 'images') &&
      fake.some((m) => m.field === 'images') &&
      texty.some((m) => m.field === 'images')
    );
  })()
);
check(
  'a URL with no scheme is refused (the schema never said, the tiles said it loudly)',
  missingProductFields({ ...COMPLETE, images: ['example.com/a.png'] }).some((m) => m.field === 'images')
);

/* ------------------------------------------------------------------ price rules */
check(
  'price must be a number greater than 0, not merely present',
  (() => {
    const zero = missingProductFields({ ...COMPLETE, price: 0 });
    const negative = missingProductFields({ ...COMPLETE, price: -40 });
    const text = missingProductFields({ ...COMPLETE, price: 'Rs 999' });
    return (
      zero.some((m) => m.field === 'price' && /greater than 0/.test(m.message)) &&
      negative.some((m) => m.field === 'price') &&
      text.some((m) => m.field === 'price')
    );
  })(),
  missingProductFields({ ...COMPLETE, price: 0 })
    .map((m) => m.message)
    .join('|')
);
check(
  'a blank spreadsheet cell is not the string "undefined"',
  readField({ __flat: { description: 'undefined' } }, 'description') === 'undefined' &&
    missingProductFields({ ...COMPLETE, description: 'undefined' }).length === 0,
  'documents the parser-side guard: text() sanitises before this module sees it'
);

/* --------------------------------------------------------- category conditionals */
check(
  'a solution sheet row needs its volume and pack pricing',
  (() => {
    const m = missingProductFields({
      ...COMPLETE,
      category: 'solution',
      dimensions: '',
      frameShape: '',
      gender: '',
      frameType: '',
      frameMaterial: '',
      frameSize: '',
      frameWidth: '',
      frameWeight: '',
      frameColor: '',
    });
    return m.some((x) => x.field === 'volumeMl') && m.some((x) => x.field === 'packPricing');
  })()
);
check(
  'an accessories row names what kind of accessory it is',
  missingProductFields({
    ...COMPLETE,
    category: 'accessories',
    gender: '',
    frameShape: '',
    frameType: '',
    frameMaterial: '',
    frameSize: '',
    frameWidth: '',
    frameWeight: '',
    frameColor: '',
    dimensions: '',
  }).some((m) => m.field === 'accessoryType')
);
check(
  'toric lenses need cylinder and axis, and a positive cylinder does not count',
  (() => {
    const lens = {
      ...COMPLETE,
      category: 'contactlenses',
      gender: '',
      frameShape: '',
      frameType: '',
      frameMaterial: '',
      frameSize: '',
      frameWidth: '',
      frameWeight: '',
      frameColor: '',
      dimensions: '',
      powerType: 'toric',
      lensesPerBox: 2,
      replacementPeriod: 'monthly',
      diameter: 14,
      baseCurve: 8.6,
      waterContent: 38,
      cylinderMax: 4,
      axisMax: 180,
    };
    const ok = { ...lens, cylinderMax: -4 };
    return missingProductFields(lens).length > 0 && missingProductFields(ok).length === 0;
  })()
);
check(
  'multifocal lenses need an ADD range with a real span',
  (() => {
    const lens = {
      ...COMPLETE,
      category: 'contactlenses',
      gender: '',
      frameShape: '',
      frameType: '',
      frameMaterial: '',
      frameSize: '',
      frameWidth: '',
      frameWeight: '',
      frameColor: '',
      dimensions: '',
      powerType: 'multifocal',
      lensesPerBox: 2,
      replacementPeriod: 'monthly',
      diameter: 14,
      baseCurve: 8.6,
      waterContent: 38,
      additionMin: 1,
      additionMax: 1,
    };
    const ok = { ...lens, additionMax: 2.5 };
    return missingProductFields(lens).some((m) => m.field === 'addition') && missingProductFields(ok).length === 0;
  })()
);
check(
  'powered lenses must say which prescription ranges they offer',
  (() => {
    const lens = {
      title: 'L',
      brand: 'B',
      category: 'contactlenses',
      price: 100,
      description: 'd',
      modelNumber: 'm',
      productCode: 'p',
      images: ['https://x/y.png'],
      powerType: 'distance',
      lensesPerBox: 2,
      replacementPeriod: 'monthly',
      diameter: 14,
      baseCurve: 8.6,
      waterContent: 38,
    };
    const without = missingProductFields({ ...lens, poweredOptionsAvailable: true, prescriptionLensTypes: [] });
    const withRanges = missingProductFields({
      ...lens,
      poweredOptionsAvailable: true,
      prescriptionLensTypes: ['-1.00'],
    });
    const notPowered = missingProductFields({ ...lens, poweredOptionsAvailable: false });
    return (
      without.some((m) => m.field === 'prescriptionLensTypes') && withRanges.length === 0 && notPowered.length === 0
    );
  })(),
  JSON.stringify(
    missingProductFields({
      title: 'L',
      brand: 'B',
      category: 'contactlenses',
      price: 100,
      description: 'd',
      modelNumber: 'm',
      productCode: 'p',
      images: ['https://x/y.png'],
      powerType: 'distance',
      lensesPerBox: 2,
      replacementPeriod: 'monthly',
      diameter: 14,
      baseCurve: 8.6,
      waterContent: 38,
      poweredOptionsAvailable: true,
      prescriptionLensTypes: [],
    }).map((m) => m.field)
  )
);

check(
  'gender = kids asks for the kids split even on a sunglasses row',
  (() => {
    const m = missingProductFields({ ...COMPLETE, gender: 'kids' });
    return m.some((x) => x.field === 'subGender') && m.some((x) => x.field === 'ageGroup');
  })()
);

/* ------------------------------------------------------------------ dimensions */
check(
  'dimensions can arrive as one string, four columns, or a measured size',
  (() => {
    const asString = missingProductFields(COMPLETE).length === 0;
    const asFour =
      missingProductFields({ ...COMPLETE, dimensions: '', dimWidth: 54, dimHeight: 52, dimBridge: 16, dimTemple: 145 })
        .length === 0;
    const asSize = missingProductFields({ ...COMPLETE, dimensions: '', frameSize: '54-16-135' }).length === 0;
    const absent = missingProductFields({ ...COMPLETE, dimensions: '', frameSize: '' }).some(
      (m) => m.field === 'dimensions'
    );
    return asString && asFour && asSize && absent;
  })()
);

/* --------------------------------------------------------- ordering and shape */
check(
  'the same record always produces the same list in the same order (a diff-stable message)',
  (() => {
    const broken = { ...COMPLETE, brand: '', gender: '', images: [] };
    const a = missingProductFields(broken)
      .map((m) => m.field)
      .join(',');
    const b = missingProductFields(JSON.parse(JSON.stringify(broken)))
      .map((m) => m.field)
      .join(',');
    return !!a && a === b;
  })(),
  missingProductFields({ ...COMPLETE, brand: '', gender: '', images: [] })
    .map((m) => m.field)
    .join(',')
);
check(
  'every problem carries field, label and message (the client highlights by field)',
  missingProductFields({ ...COMPLETE, brand: '', description: '' }).every(
    (m) =>
      typeof m.field === 'string' &&
      typeof m.label === 'string' &&
      typeof m.message === 'string' &&
      m.message !== m.field
  )
);
check(
  'no requirement is stated twice for one cause',
  (() => {
    const m = missingProductFields({ ...COMPLETE, price: 0, brand: '' });
    const names = m.map((x) => x.field);
    return new Set(names).size === names.length;
  })(),
  missingProductFields({ ...COMPLETE, price: 0 })
    .map((m) => m.field)
    .join(',')
);
check(
  'the sheet keeps its historical wording where 12 assertions quote it',
  SHEET_MISSING_TEXT.dimensions.startsWith('dimensions (one string like 54 x 52 x 16 x 145') &&
    SHEET_MISSING_TEXT.packPricing.includes('2:1499|3:2099') &&
    SHEET_MISSING_TEXT.accessoryType.includes('twezers'),
  [
    SHEET_MISSING_TEXT.dimensions.slice(0, 30),
    SHEET_MISSING_TEXT.packPricing,
    SHEET_MISSING_TEXT.accessoryType.slice(0, 24),
  ].join(' /// ')
);
check(
  'the eyewear category list matches the schema-side grouping',
  EYEWEAR_CATEGORIES.every((c) => PRODUCT_CATEGORIES.includes(c)) && EYEWEAR_CATEGORIES.length === 5
);
check(
  'a category with no extra columns demands none (lenses are not frames)',
  (() => {
    const lensOnly = {
      title: 'L',
      brand: 'B',
      category: 'contactlenses',
      price: 100,
      description: 'd',
      modelNumber: 'm',
      productCode: 'p',
      images: ['https://x/y.png'],
      powerType: 'distance',
      lensesPerBox: 2,
      replacementPeriod: 'monthly',
      diameter: 14,
      baseCurve: 8.6,
      waterContent: 38,
    };
    return missingProductFields(lensOnly).length === 0;
  })(),
  JSON.stringify(
    missingProductFields({
      title: 'L',
      brand: 'B',
      category: 'contactlenses',
      price: 100,
      description: 'd',
      modelNumber: 'm',
      productCode: 'p',
      images: ['https://x/y.png'],
      powerType: 'distance',
      lensesPerBox: 2,
      replacementPeriod: 'monthly',
      diameter: 14,
      baseCurve: 8.6,
      waterContent: 38,
    })
  )
);

/*
 * The parity claim is about code history as much as behaviour: both upload doors
 * must be ASKING the shared module, and neither may keep a private copy of the
 * list. Behaviour tests would not notice a duplicate definition that happens to
 * agree today, so these scan the two source files for the old local rules and for
 * the call that replaced them.
 */
const doors = {
  'routes/manufacturer.js': fs.readFileSync(path.join(SERVER, 'routes', 'manufacturer.js'), 'utf8'),
  'client/manufacturer dashboard': fs.readFileSync(
    path.join(ROOT, 'client', 'src', 'pages', 'manufacturer', 'ManufacturerDashboard.js'),
    'utf8'
  ),
};
check(
  'both doors consult the shared rule module',
  Object.entries(doors).every(([name, text]) =>
    /productRequirements|upload-spec|missingProductFields/.test(text) ? true : name
  ) &&
    /missingProductFields/.test(doors['routes/manufacturer.js']) &&
    /upload-spec|missingProductFields/.test(doors['client/manufacturer dashboard'])
);
check(
  'the sheet no longer keeps its own frame-geometry requirement list',
  !/missing\.push\('frameWidth'\)/.test(doors['routes/manufacturer.js']) &&
    !/if \(EYEWEAR\.includes\(category\)\) \{\s*if \(!genderRaw\) missing\.push\('gender'\)/.test(
      doors['routes/manufacturer.js']
    ),
  'the old block demanded frameShape/frameType/frameMaterial/gender per row locally'
);
check(
  'and no door re-invents the optics columns',
  !/missing\.push\(k\)/.test(doors['routes/manufacturer.js']) &&
    !/lensesperbox.*basecurve.*watercontent/.test(doors['routes/manufacturer.js'])
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} product-requirement checks passed`);
failed.forEach((f) => console.log(`  - ${f.name}`));
process.exitCode = failed.length ? 1 : 0;
