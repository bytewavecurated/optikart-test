#!/usr/bin/env node
/**
 * Both upload doors, same rules, over HTTP.
 *
 * The pure unit proves the rule module is consistent. This proves the two doors
 * actually consult it, because a shared module nothing calls is a second list
 * with better branding. A manufacturer can create a product by filling the form
 * or by uploading a spreadsheet, and until now those two paths disagreed out loud:
 * the sheet demanded columns the form never mentioned, and the form accepted rows
 * the sheet would refuse, so the same catalogue entry had two eligibility rules
 * and the difference only surfaced as a product missing data nobody had been told
 * to provide.
 *
 * The method is deliberately boring: build one product shape, submit it through
 * each door, compare the field names each answer. Where answers must differ - the
 * sheet reports per row so a 200-line import stays usable - that is asserted as a
 * difference, not accepted silently.
 *
 *   node scripts/product_upload_parity_e2e.mjs [base-url]
 */
import path from 'node:path';
import { fileURLToPath as url } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(url(import.meta.url));
const require = createRequire(path.join(HERE, '..', 'server', 'noop.js'));
const xlsx = require('xlsx');
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 170)}` : ''}`);
};
const login = async (route, email, password) => {
  const res = await fetch(`${API}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return (await res.json()).token;
};
const post = async (route, token, body) => {
  const res = await fetch(`${API}${route}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};
let IMAGE_FALLBACK = 'https://example.com/parity.png';
const uploadSheet = async (token, rows) => {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rows), 'Products');
  const buf = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'application/octet-stream' }), 'parity.xlsx');
  const res = await fetch(`${API}/manufacturer/products/bulk-upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

const COMPLETE = {
  title: 'Parity Probe Frame',
  description: 'Sent through both upload doors to compare their answers.',
  price: 4990,
  brand: 'Ray-Ban',
  modelNumber: 'PARITY-MDL-1',
  productCode: 'PARITY-SKU-1',
  stock: 8,
  category: 'sunglasses',
  gender: 'unisex',
  frameShape: 'Round',
  frameType: 'Full Rim',
  frameMaterial: 'metal',
  frameSize: '54-16-135',
  frameWidth: '140',
  frameWeight: '22',
  frameColor: 'black',
  dimensions: '54 x 52 x 16 x 145',
  images: ['https://example.com/parity.png'],
};
const SHEET_ROW = {
  title: COMPLETE.title,
  description: COMPLETE.description,
  price: COMPLETE.price,
  brand: COMPLETE.brand,
  modelNumber: COMPLETE.modelNumber,
  productCode: COMPLETE.productCode,
  stock: COMPLETE.stock,
  category: 'sunglasses',
  gender: COMPLETE.gender,
  frameShape: COMPLETE.frameShape,
  frameType: COMPLETE.frameType,
  frameMaterial: COMPLETE.frameMaterial,
  frameSize: COMPLETE.frameSize,
  frameWidth: COMPLETE.frameWidth,
  frameWeight: COMPLETE.frameWeight,
  frameColor: COMPLETE.frameColor,
  dimensions: COMPLETE.dimensions,
  images: 'https://example.com/parity.png',
};

/** field names the sheet answers with; it prefixes each with the row it came from */
const sheetFields = (json) => {
  const problems = [...(json?.errors || []), ...(json?.rowProblems || []), ...(json?.results?.rejected || [])];
  const text = problems.join(' | ');
  const known = [
    'title',
    'description',
    'price',
    'brand',
    'modelNumber',
    'productCode',
    'images',
    'gender',
    'frameShape',
    'frameType',
    'frameMaterial',
    'frameSize',
    'frameWidth',
    'frameWeight',
    'frameColor',
    'dimensions',
  ];
  // The sheet's messages are prose ("Row 2: images are required - put one or
  // more | separated links"), so a word-boundary match is the honest test that
  // the field was named, rather than a pattern tied to one punctuation shape.
  return known.filter((f) => new RegExp(`\\b${f}\\b`, 'i').test(text));
};
const formFields = (json) =>
  (json?.missing || json?.errors || []).map((e) => (typeof e === 'string' ? e : e.field)).filter(Boolean);

/*
 * Both doors must be handed an image URL the server can actually fetch (see the
 * upload probe in main), so the fixture rewrites the placeholder link rather than
 * carrying a second copy of every row.
 */
const withImage = (row, image) => {
  const out = { ...row };
  if (Array.isArray(out.images)) out.images = out.images.map((i) => (i ? image : i));
  else if (typeof out.images === 'string') out.images = out.images ? image : '';
  return out;
};

async function main() {
  if (!['function', 'object'].includes(typeof xlsx?.utils?.book_new)) {
    console.log('SKIP  scripts/product_upload_parity_e2e.mjs (xlsx unavailable from server/node_modules)');
    process.exit(0);
  }

  const admin = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  const mfg = await login('/manufacturer/login', 'rayban.manufacturer@optikart.com', 'Manufacturer123@');
  check('manufacturer and admin sessions open', Boolean(admin && mfg), `admin=${Boolean(admin)} mfg=${Boolean(mfg)}`);

  /*
   * The bulk door downloads every image link before it saves anything - so a
   * fixture pointed at https://example.com/... was refused with "could not be
   * fetched (HTTP 404)", which is the door working correctly and my test being
   * wrong. The image used from here on is one this very server serves, obtained
   * through the same upload endpoint a manufacturer would use.
   */
  const pngBytes = (() => {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(100, 0);
    ihdr.writeUInt32BE(100, 4);
    ihdr[8] = 8;
    ihdr[9] = 0;
    const chunk = (type, data) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length, 0);
      const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(require('zlib').crc32 ? require('zlib').crc32(body) : 0, 0);
      return Buffer.concat([len, body, crc]);
    };
    return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', Buffer.alloc(12)), chunk('IEND', Buffer.alloc(0))]);
  })();
  let imageUrl = null;
  {
    const form = new FormData();
    form.append('images', new Blob([pngBytes], { type: 'image/png' }), 'parity.png');
    const up = await fetch(`${API}/manufacturer/products/upload-images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mfg}` },
      body: form,
    });
    const upJson = await up.json().catch(() => null);
    imageUrl = (upJson?.urls || [])[0] || null;
    if (imageUrl && imageUrl.startsWith('/')) imageUrl = `${BASE}${imageUrl}`;
  }
  check('the suite can produce an image the bulk door will actually fetch', Boolean(imageUrl), String(imageUrl));
  const IMAGE = imageUrl || 'https://example.com/parity.png';

  /* ------------------------------------------------------------ the specification */
  const spec = await fetch(`${API}/manufacturer/upload-spec`, { headers: { Authorization: `Bearer ${mfg}` } });
  const specJson = await spec.json().catch(() => null);
  check(
    'the specification endpoint answers the form',
    spec.status === 200 && Array.isArray(specJson?.spec?.upload),
    `HTTP ${spec.status}`
  );
  check(
    'it publishes the upload-level fields the doors enforce',
    specJson?.spec?.upload?.map((u) => u.field).join(',') ===
      'title,brand,category,price,description,modelNumber,productCode',
    (specJson?.spec?.upload || []).map((u) => u.field).join(',')
  );
  check(
    'it lists the frame measurements beside the categories that need them',
    ['frameSize', 'frameWidth', 'frameWeight', 'frameColor', 'dimensions'].every((f) =>
      (specJson?.spec?.uploadCategoryFields?.sunglasses || []).some((x) => x.field === f)
    ),
    (specJson?.spec?.uploadCategoryFields?.sunglasses || []).map((x) => x.field).join(',')
  );
  check(
    'and it is explicit that stock and MRP are not required (the two traps this batch met)',
    /out of stock/.test(specJson?.spec?.notRequired?.stock || '') &&
      /MRP/i.test(specJson?.spec?.notRequired?.mrp || ''),
    JSON.stringify(specJson?.spec?.notRequired)
  );
  check(
    'the spec points at the schema as the source of per-category rules',
    /models\/Product\.js/.test(JSON.stringify(specJson?.spec || {})),
    specJson?.spec?.source
  );
  const specDenied = await fetch(`${API}/manufacturer/upload-spec`);
  check(
    'the specification is not public (nor is the sheet that enforces it)',
    specDenied.status === 401 || specDenied.status === 403,
    `HTTP ${specDenied.status}`
  );

  /* ------------------------------------------------------------ both doors, no defect */
  const stamp = Date.now().toString(36);
  const goodForm = await post('/manufacturer/products', mfg, { ...COMPLETE, title: `Parity OK Form ${stamp}` });
  check(
    'a complete product is accepted by the single door',
    goodForm.status === 201 || goodForm.json?.success === true,
    `HTTP ${goodForm.status} ${JSON.stringify(goodForm.json?.message || goodForm.json?.missing || '')}`
  );
  const goodSheet = await uploadSheet(mfg, [withImage({ ...SHEET_ROW, title: `Parity OK Sheet ${stamp}` }, IMAGE)]);
  check(
    'and by the bulk door',
    goodSheet.json?.success !== false && !sheetFields(goodSheet.json).length,
    `HTTP ${goodSheet.status} ${JSON.stringify(goodSheet.json?.message || (goodSheet.json?.errors || []).slice(0, 1))}`
  );

  /* --------------------------------------------------------- both doors, one defect */
  const CASES = [
    { drop: 'modelNumber', label: 'Model number' },
    { drop: 'productCode', label: 'Product code' },
    { drop: 'description', label: 'Description' },
    { drop: 'images', label: 'Image links' },
    { drop: 'frameWidth', label: 'Frame width' },
  ];
  for (const { drop } of CASES) {
    const formBody = { ...COMPLETE, title: `Parity ${drop} form ${stamp}` };
    delete formBody[drop];
    if (drop === 'images') formBody.images = [];
    const sheetRow = withImage({ ...SHEET_ROW, title: `Parity ${drop} sheet ${stamp}` }, IMAGE);
    delete sheetRow[drop];
    if (drop === 'images') sheetRow.images = '';

    const f = await post('/manufacturer/products', mfg, formBody);
    const s = await uploadSheet(mfg, [sheetRow]);
    const ff = formFields(f.json);
    const sf = sheetFields(s.json);
    check(
      `omitting ${drop}: the single door refuses it and names the field`,
      f.status === 400 && ff.includes(drop === 'images' ? 'images' : drop),
      `HTTP ${f.status} ${JSON.stringify(ff)}`
    );
    check(
      `omitting ${drop}: the bulk door refuses the same row`,
      s.status !== 200 || s.json?.success === false || (s.json?.errors || s.json?.rowProblems || []).length > 0,
      `HTTP ${s.status} ${JSON.stringify((s.json?.errors || s.json?.rowProblems || [])[0] || s.json?.message || '').slice(0, 130)}`
    );
    check(
      `omitting ${drop}: both doors name the same field, not merely both refusing`,
      sf.includes(drop) && ff.includes(drop),
      `form=${JSON.stringify(ff)} sheet=${JSON.stringify(sf)}`
    );
    check(
      `omitting ${drop}: nothing is created in either door`,
      f.status === 400 && !(s.json?.created ?? s.json?.imported ?? 0),
      `form HTTP ${f.status}; sheet created=${JSON.stringify(s.json?.created ?? s.json?.imported ?? 0)}`
    );
  }

  /* ---------------------------------------------------------- garbage and 0-values */
  const zeroWidthForm = await post('/manufacturer/products', mfg, {
    ...COMPLETE,
    frameWidth: '0',
    title: `Parity width0 ${stamp}`,
  });
  check(
    'a frame width of 0 is refused as not-a-measurement (and not as blank)',
    zeroWidthForm.status === 400 &&
      /greater than 0/.test(JSON.stringify(zeroWidthForm.json?.missing || zeroWidthForm.json)),
    JSON.stringify(zeroWidthForm.json?.missing || zeroWidthForm.json?.message || '').slice(0, 150)
  );
  const junkWidthSheet = await uploadSheet(mfg, [
    withImage({ ...SHEET_ROW, title: `Parity widthJunk ${stamp}`, frameWidth: 'wide' }, IMAGE),
  ]);
  check(
    'the sheet refuses a non-number width as a bad value, not as a missing column',
    /must be a number greater than 0/.test(JSON.stringify(junkWidthSheet.json?.errors || [])) &&
      !/missing required frameWidth/.test(JSON.stringify(junkWidthSheet.json?.errors || [])),
    JSON.stringify((junkWidthSheet.json?.errors || []).slice(0, 2))
  );

  /* ------------------------------------------------------- per-category rules (schema) */
  const lensNoBaseCurve = await post('/manufacturer/products', mfg, {
    ...COMPLETE,
    title: `Parity Lens ${stamp}`,
    category: 'contactlenses',
    framesize: undefined,
    frameSize: undefined,
    frameWidth: undefined,
    frameWeight: undefined,
    frameColor: undefined,
    dimensions: undefined,
    gender: undefined,
    frameShape: undefined,
    frameType: undefined,
    frameMaterial: undefined,
  });
  check(
    'a lens with no optics is refused by the schema, and that refusal reaches the caller as 400',
    lensNoBaseCurve.status === 400 &&
      /contactLens|base curve|power type|replacement period|lenses per box|diameter/i.test(
        JSON.stringify(lensNoBaseCurve.json)
      ),
    `HTTP ${lensNoBaseCurve.status} ${JSON.stringify(lensNoBaseCurve.json?.message || lensNoBaseCurve.json?.missing || '').slice(0, 150)}`
  );
  check(
    'and it is reported per field so a page can highlight them',
    Array.isArray(lensNoBaseCurve.json?.missing) &&
      lensNoBaseCurve.json.missing.length > 0 &&
      lensNoBaseCurve.json.missing.every((m) => m.field && m.message),
    JSON.stringify((lensNoBaseCurve.json?.missing || []).slice(0, 2))
  );
  const unitWidth = await post('/manufacturer/products', mfg, {
    ...COMPLETE,
    frameWidth: '140mm',
    title: `Parity unitmm ${stamp}`,
  });
  check(
    'a width of "140mm" is refused as a non-number rather than saved as nothing',
    unitWidth.status === 400 &&
      (unitWidth.json?.missing || []).some((m) => m.field === 'frameWidth' && /must be a number/.test(m.message)),
    `HTTP ${unitWidth.status} ${JSON.stringify(unitWidth.json?.missing || '').slice(0, 140)}`
  );
  const leaked = JSON.stringify(unitWidth.json || {});
  check(
    'and the refusal does not recite our schema or Mongoose internals to the browser',
    !/Cast to |at path |type string|ObjectExpected|ValidationError/i.test(leaked),
    leaked.slice(0, 160)
  );

  /* ---------------------------------------------------------- the fields that are NOT required */
  const zeroStock = { ...COMPLETE, title: `Parity stock0 ${stamp}`, stock: 0 };
  const s0 = await post('/manufacturer/products', mfg, zeroStock);
  check(
    'stock 0 is accepted: it means out of stock, which is an answer',
    s0.status === 201 || s0.json?.success === true,
    `HTTP ${s0.status} ${JSON.stringify(s0.json?.missing || s0.json?.message || '').slice(0, 120)}`
  );

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} upload-parity checks passed`);
  if (failed.length) failed.forEach((f) => console.log(`  - ${f.name}`));
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.log(`\nUPLOAD-PARITY SUITE CRASHED: ${e.message}`);
  console.log((e.stack || '').split('\n')[1] || '');
  finish();
});
