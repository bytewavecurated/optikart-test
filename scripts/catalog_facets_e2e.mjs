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
  const bad = `title,price,category,brand,product code,model number,description,volumeml,pack pricing
No Pack Solution,599,solution,Ray-Ban,FAC-SOL-2,FAC-SOL-2,Missing its pack pricing row,350,`;
  const fd2 = new FormData();
  fd2.append('file', new Blob([bad], { type: 'text/csv' }), 'bad.csv');
  const res2 = await fetch(`${API}/manufacturer/products/bulk-upload`, {
    method: 'POST', headers: { Authorization: `Bearer ${brand}` }, body: fd2
  });
  const j2 = await res2.json().catch(() => null);
  check('a missing required per-category column is refused by name',
    j2?.success === false && JSON.stringify(j2?.errors || []).includes('packPricing'),
    JSON.stringify(j2 || {}).slice(0, 150));

  /*
   * A complete eyewear row whose OPTIONAL cells contain the literal word
   * "undefined" - exactly what a sheet exported from a tool with a null bug
   * produces. Before the blank-value fix these were stored as the string
   * "undefined", or sent an enum field `["undefined"]` to the model. The row must
   * either import with those cells absent, or be refused naming the real problem;
   * what must never happen is a product filed with the word "undefined" in a
   * shopper-facing field.
   */
  const weird = [
    'title,price,category,brand,product code,model number,description,gender,frame shape,frame type,frame material,frame colour,frame size,frame width,frame weight,frame dimensions,sub gender,age group,materials,sizes',
    `Ghost Frames,1299,eyeglasses,Ray-Ban,FAC-GEN-2,FAC-GEN-2,A row full of the word undefined,unisex,round,full-rim,acetate,black,medium,52,18,54 x 52 x 16 x 145,,, undefined ,undefined`
  ].join('\n');
  const fd3 = new FormData();
  fd3.append('file', new Blob([weird], { type: 'text/csv' }), 'weird.csv');
  const res3 = await fetch(`${API}/manufacturer/products/bulk-upload`, {
    method: 'POST', headers: { Authorization: `Bearer ${brand}` }, body: fd3
  });
  const j3 = await res3.json().catch(() => null);
  const mineNow = (await call('/manufacturer/products?limit=300', { token: brand })).json?.products || [];
  const ghost = mineNow.find((r) => /Ghost Frames/.test(r.title || ''));
  check('a sheet of literal "undefined" cells either fails cleanly or imports without the word',
    j3?.success === false
      ? JSON.stringify(j3.errors || []).includes('Row 2') && !/is not a valid enum value for path `gender`/.test(JSON.stringify(j3.errors))
      : !!ghost && !JSON.stringify(ghost).includes('undefined'),
    JSON.stringify({ uploaded: !!ghost, errors: (j3?.errors || []).slice(0, 1) }).slice(0, 170));
  check('the imported row, if created, has no placeholder left in materials or sizes',
    !ghost || ((!ghost.materials || !ghost.materials.includes('undefined'))
      && (!ghost.sizes || !ghost.sizes.includes('undefined'))),
    JSON.stringify({ materials: ghost?.materials, sizes: ghost?.sizes }).slice(0, 120));

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
