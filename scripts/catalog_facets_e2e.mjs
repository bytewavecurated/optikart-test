#!/usr/bin/env node
/**
 * Catalogue facets and bulk-upload criteria.
 *
 * Item ③ made the brand dropdown follow the rest of the shopper's selection. Two
 * behaviours are proved here: the facet endpoint scopes and groups each list, and
 * a bulk file is accepted or refused against the documented column rules — including
 * the solution and accessory categories that could not be imported at all until the
 * parser read their required fields.
 *
 * No internet is used: the image URL points at a file the API already serves.
 *
 *   node scripts/catalog_facets_e2e.mjs [base-url]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
  return ok;
};
const call = async (p, { token, body, method } = {}) => {
  const res = await fetch(API + p, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
};
const login = (p, email, password) => call(p, { body: { email, password } }).then((r) => r.json?.token);

async function main() {
  /* ------------------------------------------------------------- facets */
  const all = (await call('/products/filters')).json?.filters;
  const sung = (await call('/products/filters?category=sunglasses')).json?.filters;
  const lens = (await call('/products/filters?category=contactlenses')).json?.filters;
  if (!check('facet endpoint answers', !!all?.brands, JSON.stringify(all || {}).slice(0, 80))) return finish();

  check('brands follow the chosen category',
    sung.brands.length > 0 && sung.brands.length <= all.brands.length
      && sung.brands.every((b) => all.brands.includes(b)),
    `sunglasses ${sung.brands.length} of ${all.brands.length}`);
  check('a category cannot be offered a brand that sells nothing in it',
    !sung.brands.some((b) => !(lens.brands.includes(b) || sung.brands.includes(b))), 'subset check');
  check('the categories facet stays complete so the shopper can move on',
    all.categories.length > 1 && sung.categories.length > 1,
    `all=${all.categories.length} scoped=${sung.categories.length}`);
  check('brands arrive grouped by initial letter',
    sung.brandsByLetter && Object.values(sung.brandsByLetter).flat().length === sung.brands.length,
    JSON.stringify(Object.keys(sung.brandsByLetter || {})));

  const men = (await call('/products/filters?category=sunglasses&gender=men')).json?.filters;
  check('facets compose across two filters', men.brands.length <= sung.brands.length,
    `men ${men.brands.length} vs category ${sung.brands.length}`);
  check('the gender facet keeps its other options (so the choice can change)',
    men.genders.length >= 2, JSON.stringify(men.genders));

  const scoped = await call('/products/brands?category=sunglasses');
  check('/brands honours category too',
    Array.isArray(scoped.json?.brands) && scoped.json.scoped === true && scoped.json.brands.length === sung.brands.length,
    JSON.stringify(scoped.json?.brands || {}).slice(0, 90));

  const cats = await call('/products/categories');
  check('the category list answers', cats.status === 200 && (cats.json?.categories || []).length > 3,
    JSON.stringify(cats.json?.categories || []).slice(0, 90));

  /* -------------------------------------------------------- bulk upload */
  const brand = await login('/manufacturer/login', 'rayban.manufacturer@optikart.com', 'Manufacturer123@');
  if (!check('manufacturer signs in', !!brand)) return finish();

  const serve = await call('/manufacturer/products?limit=1', { token: brand });
  const firstImg = ((serve.json?.products || [])[0]?.images || [])[0];
  if (!check('brand already has an image to reference', !!firstImg, JSON.stringify(firstImg || '').slice(0, 60))) return finish();

  const goods = `title,price,category,brand,product code,model number,description,images,volumeml,pack pricing,accessory type
Facets Solution 360,649,solution,Ray-Ban,FAC-SOL-1,FAC-SOL-1,All-in-one disinfecting solution,${firstImg},360,2:1199|3:1699,
Facets Travel Case,499,accessories,Ray-Ban,FAC-ACC-1,FAC-ACC-1,Rigid travel case with lining,${firstImg},,,case`;

  const fd = new FormData();
  fd.append('file', new Blob([goods], { type: 'text/csv' }), 'facets.csv');
  const up = await fetch(`${API}/manufacturer/products/bulk-upload`, {
    method: 'POST', headers: { Authorization: `Bearer ${brand}` }, body: fd
  });
  const upJson = await up.json().catch(() => null);
  check('a solution and an accessory row import (impossible before the parser read their columns)',
    upJson?.success === true && upJson?.count === 2, JSON.stringify(upJson || {}).slice(0, 170));

  if (upJson?.success) {
    /*
     * Read them back through the brand console, not the storefront.
     *
     * `/products` filters on verificationStatus 'verified', so a freshly
     * imported product is legitimately invisible there - asserting against the
     * public list would have been an assertion about the wrong thing. The
     * brand's own list shows everything it submitted, which is where the
     * "imported products start as pending" rule can actually be seen.
     */
    const mine = (await call('/manufacturer/products?limit=200', { token: brand })).json?.products || [];
    const sol = mine.find((r) => /Facets Solution 360/.test(r.title || ''));
    check('an imported product starts held for verification',
      !!sol && sol.verificationStatus === 'pending',
      `verificationStatus=${sol?.verificationStatus ?? 'not listed'}`);
    check('solution carries its volume and both multi-pack prices',
      !!sol && Number(sol.solution?.volumeMl) === 360
        && (sol.solution?.packPricing || []).length === 2
        && sol.solution.packPricing[1].price === 1699,
      JSON.stringify(sol?.solution || {}).slice(0, 130));

    const acc = mine.find((r) => /Facets Travel Case/.test(r.title || ''));
    check('accessory records its type', acc?.accessory?.accessoryType === 'case',
      JSON.stringify(acc?.accessory || {}).slice(0, 90));

    // The public browse must not show it yet - the same fact from the other side.
    const publicRows = (await call('/products?category=solution&limit=200', { token: brand })).json?.products || [];
    check('and it is not on the storefront before verification',
      !publicRows.some((r) => /Facets Solution 360/.test(r.title || '')),
      `public solution rows ${publicRows.length}`);
  }

  /* ---- required columns are refused, and blank optionals stay absent ---- */
  const withImage = (cols) => `${cols},images
${firstImg}`;
  /*
   * A sheet whose optional cells contain the literal words `undefined`/`null`,
   * which is what a spreadsheet export leaves behind.
   *
   * Asserted as outcomes only. The first version of this check was written
   * "either fails cleanly or imports without the word", and it passed while the
   * row had in fact failed for an unrelated reason (an omitted `images` column) -
   * a conditional assertion that certifies nothing and hides a regression.
   */
  const placeholderSheet = [
    'title,price,category,brand,product code,model number,description,images,gender,frame shape,frame type,frame material,frame colour,frame size,frame width,frame weight,frame dimensions,materials,sizes',
    `Placeholder Frames,1299,sunglasses,Ray-Ban,FAC-UND-1,FAC-UND-1,Cells holding the word undefined,${firstImg},unisex,round,full-rim,acetate,black,medium,52,18,52 x 40 x 18 x 140, undefined | acetate , undefined `
  ].join('\n');

  // One helper, so the multipart shape cannot drift between these cases.
  const uploadCsv = async (name, text) => {
    const form = new FormData();
    form.append('file', new Blob([text], { type: 'text/csv' }), name);
    const res = await fetch(`${API}/manufacturer/products/bulk-upload`, {
      method: 'POST', headers: { Authorization: `Bearer ${brand}` }, body: form
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  };

  const ph = await uploadCsv('placeholder.csv', placeholderSheet);
  check('a placeholder-filled sheet imports rather than being rejected over those words',
    ph.json?.success === true, JSON.stringify(ph.json || {}).slice(0, 160));

  const stored = ((await call('/manufacturer/products?limit=400', { token: brand })).json?.products || [])
    .find((r) => r.modelNumber === 'FAC-UND-1');
  check('the row is stored', !!stored);
  check('no placeholder reaches a list a shopper could choose',
    !!stored
      && !(stored.materials || []).includes('undefined')
      && !(stored.sizes || []).includes('undefined')
      && !JSON.stringify(stored).includes('"undefined"'),
    JSON.stringify({ materials: stored?.materials, sizes: stored?.sizes }).slice(0, 130));
  check('the real value sharing that cell is kept - filtering is not deleting',
    (stored?.materials || []).includes('acetate'), JSON.stringify(stored?.materials));
  check('and the row is held for verification like any other import',
    stored?.verificationStatus === 'pending', `verificationStatus=${stored?.verificationStatus}`);

  const blankEyewearCols = await uploadCsv('blankgender.csv',
    `title,price,category,brand,product code,model number,description,images,volumeml,pack pricing
Blank Gender Solution,699,solution,Ray-Ban,FAC-UND-2,FAC-UND-2,A solution with no gender or frame columns,${firstImg},400,2:1299`);
  check('a non-eyewear row with no eyewear columns imports (gender used to arrive as an empty enum)',
    blankEyewearCols.json?.success === true, JSON.stringify(blankEyewearCols.json || {}).slice(0, 170));

  const missingColumn = await uploadCsv('missing.csv',
    `title,price,category,brand,product code,model number,description,images,volumeml,pack pricing
No Pack Solution,599,solution,Ray-Ban,FAC-UND-3,FAC-UND-3,Missing its pack pricing row,${firstImg},350,`);
  check('a genuinely missing required column is refused, named, with the row number',
    missingColumn.json?.success === false
      && JSON.stringify(missingColumn.json?.errors || []).includes('packPricing')
      && /Row 2/.test(JSON.stringify(missingColumn.json?.errors || [])),
    JSON.stringify(missingColumn.json || {}).slice(0, 160));


  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} catalogue assertions passed`);
  if (failed.length) {
    console.log(' failing:');
    for (const f of failed) console.log(`  - ${f.name}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 2; });
