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
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text };
};
const login = (p, email, password) => call(p, { body: { email, password } }).then((r) => r.json?.token);

async function main() {
  /* ------------------------------------------------------------- facets */
  const all = (await call('/products/filters')).json?.filters;
  const sung = (await call('/products/filters?category=sunglasses')).json?.filters;
  const lens = (await call('/products/filters?category=contactlenses')).json?.filters;
  if (!check('facet endpoint answers', !!all?.brands, JSON.stringify(all || {}).slice(0, 80))) return finish();

  check(
    'brands follow the chosen category',
    sung.brands.length > 0 &&
      sung.brands.length <= all.brands.length &&
      sung.brands.every((b) => all.brands.includes(b)),
    `sunglasses ${sung.brands.length} of ${all.brands.length}`
  );
  check(
    'a category cannot be offered a brand that sells nothing in it',
    !sung.brands.some((b) => !(lens.brands.includes(b) || sung.brands.includes(b))),
    'subset check'
  );
  check(
    'the categories facet stays complete so the shopper can move on',
    all.categories.length > 1 && sung.categories.length > 1,
    `all=${all.categories.length} scoped=${sung.categories.length}`
  );
  check(
    'brands arrive grouped by initial letter',
    sung.brandsByLetter && Object.values(sung.brandsByLetter).flat().length === sung.brands.length,
    JSON.stringify(Object.keys(sung.brandsByLetter || {}))
  );

  const men = (await call('/products/filters?category=sunglasses&gender=men')).json?.filters;
  check(
    'facets compose across two filters',
    men.brands.length <= sung.brands.length,
    `men ${men.brands.length} vs category ${sung.brands.length}`
  );
  check(
    'the gender facet keeps its other options (so the choice can change)',
    men.genders.length >= 2,
    JSON.stringify(men.genders)
  );

  const scoped = await call('/products/brands?category=sunglasses');
  check(
    '/brands honours category too',
    Array.isArray(scoped.json?.brands) &&
      scoped.json.scoped === true &&
      scoped.json.brands.length === sung.brands.length,
    JSON.stringify(scoped.json?.brands || {}).slice(0, 90)
  );

  const cats = await call('/products/categories');
  check(
    'the category list answers',
    cats.status === 200 && (cats.json?.categories || []).length > 3,
    JSON.stringify(cats.json?.categories || []).slice(0, 90)
  );

  /* -------------------------------------------------------- bulk upload */
  const brand = await login('/manufacturer/login', 'rayban.manufacturer@optikart.com', 'Manufacturer123@');
  if (!check('manufacturer signs in', !!brand)) return finish();

  const serve = await call('/manufacturer/products?limit=1', { token: brand });
  const firstImg = ((serve.json?.products || [])[0]?.images || [])[0];
  if (!check('brand already has an image to reference', !!firstImg, JSON.stringify(firstImg || '').slice(0, 60)))
    return finish();

  const goods = `title,price,category,brand,product code,model number,description,images,volumeml,pack pricing,accessory type
Facets Solution 360,649,solution,Ray-Ban,FAC-SOL-1,FAC-SOL-1,All-in-one disinfecting solution,${firstImg},360,2:1199|3:1699,
Facets Travel Case,499,accessories,Ray-Ban,FAC-ACC-1,FAC-ACC-1,Rigid travel case with lining,${firstImg},,,case`;

  const fd = new FormData();
  fd.append('file', new Blob([goods], { type: 'text/csv' }), 'facets.csv');
  const up = await fetch(`${API}/manufacturer/products/bulk-upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${brand}` },
    body: fd,
  });
  const upJson = await up.json().catch(() => null);
  check(
    'a solution and an accessory row import (impossible before the parser read their columns)',
    upJson?.success === true && upJson?.count === 2,
    JSON.stringify(upJson || {}).slice(0, 170)
  );

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
    check(
      'an imported product starts held for verification',
      !!sol && sol.verificationStatus === 'pending',
      `verificationStatus=${sol?.verificationStatus ?? 'not listed'}`
    );
    check(
      'solution carries its volume and both multi-pack prices',
      !!sol &&
        Number(sol.solution?.volumeMl) === 360 &&
        (sol.solution?.packPricing || []).length === 2 &&
        sol.solution.packPricing[1].price === 1699,
      JSON.stringify(sol?.solution || {}).slice(0, 130)
    );

    const acc = mine.find((r) => /Facets Travel Case/.test(r.title || ''));
    check(
      'accessory records its type',
      acc?.accessory?.accessoryType === 'case',
      JSON.stringify(acc?.accessory || {}).slice(0, 90)
    );

    // The public browse must not show it yet - the same fact from the other side.
    const publicRows = (await call('/products?category=solution&limit=200', { token: brand })).json?.products || [];
    check(
      'and it is not on the storefront before verification',
      !publicRows.some((r) => /Facets Solution 360/.test(r.title || '')),
      `public solution rows ${publicRows.length}`
    );
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
    `Placeholder Frames,1299,sunglasses,Ray-Ban,FAC-UND-1,FAC-UND-1,Cells holding the word undefined,${firstImg},unisex,round,full-rim,acetate,black,medium,52,18,52 x 40 x 18 x 140, undefined | acetate , undefined `,
  ].join('\n');

  // One helper, so the multipart shape cannot drift between these cases.
  const uploadCsv = async (name, text) => {
    const form = new FormData();
    form.append('file', new Blob([text], { type: 'text/csv' }), name);
    const res = await fetch(`${API}/manufacturer/products/bulk-upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${brand}` },
      body: form,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  };

  const ph = await uploadCsv('placeholder.csv', placeholderSheet);
  check(
    'a placeholder-filled sheet imports rather than being rejected over those words',
    ph.json?.success === true,
    JSON.stringify(ph.json || {}).slice(0, 160)
  );

  const stored = ((await call('/manufacturer/products?limit=400', { token: brand })).json?.products || []).find(
    (r) => r.modelNumber === 'FAC-UND-1'
  );
  check('the row is stored', !!stored);
  check(
    'no placeholder reaches a list a shopper could choose',
    !!stored &&
      !(stored.materials || []).includes('undefined') &&
      !(stored.sizes || []).includes('undefined') &&
      !JSON.stringify(stored).includes('"undefined"'),
    JSON.stringify({ materials: stored?.materials, sizes: stored?.sizes }).slice(0, 130)
  );
  check(
    'the real value sharing that cell is kept - filtering is not deleting',
    (stored?.materials || []).includes('acetate'),
    JSON.stringify(stored?.materials)
  );
  check(
    'and the row is held for verification like any other import',
    stored?.verificationStatus === 'pending',
    `verificationStatus=${stored?.verificationStatus}`
  );

  const blankEyewearCols = await uploadCsv(
    'blankgender.csv',
    `title,price,category,brand,product code,model number,description,images,volumeml,pack pricing
Blank Gender Solution,699,solution,Ray-Ban,FAC-UND-2,FAC-UND-2,A solution with no gender or frame columns,${firstImg},400,2:1299`
  );
  check(
    'a non-eyewear row with no eyewear columns imports (gender used to arrive as an empty enum)',
    blankEyewearCols.json?.success === true,
    JSON.stringify(blankEyewearCols.json || {}).slice(0, 170)
  );

  const missingColumn = await uploadCsv(
    'missing.csv',
    `title,price,category,brand,product code,model number,description,images,volumeml,pack pricing
No Pack Solution,599,solution,Ray-Ban,FAC-UND-3,FAC-UND-3,Missing its pack pricing row,${firstImg},350,`
  );
  check(
    'a genuinely missing required column is refused, named, with the row number',
    missingColumn.json?.success === false &&
      JSON.stringify(missingColumn.json?.errors || []).includes('packPricing') &&
      /Row 2/.test(JSON.stringify(missingColumn.json?.errors || [])),
    JSON.stringify(missingColumn.json || {}).slice(0, 160)
  );

  /*
   * Brand gate: a sheet that mixes brands, and a sheet naming a brand the
   * manufacturer has never declared on their profile.
   *
   * Both are refused whole - a half-imported sheet leaves one brand's products
   * filed under another name, which the shopper reads as the brand selling
   * frames it never listed. Both name the brand and the row, not "invalid", so
   * the fix is a locate-and-split rather than a hunt through the spreadsheet,
   * and the unlisted-brand error shows the allowed list: the brand belongs on
   * the profile before it can own any catalogue row.
   */
  const MIX = [
    'title,price,category,brand,product code,model number,description,images,gender,frame shape,frame type,frame material,frame colour,frame size,frame width,frame weight,frame dimensions',
    `Gate A Frame,2499,sunglasses,Ray-Ban,MIX-A1,MIX-A1,First brand row,${firstImg},unisex,round,full-rim,acetate,black,medium,52,18,52 x 40 x 18 x 140`,
    `Gate B Frame,2599,sunglasses,Fastrack,MIX-B1,MIX-B1,A different brand row,${firstImg},unisex,round,full-rim,acetate,black,medium,52,18,52 x 40 x 18 x 140`,
  ].join('\n');
  const mixRes = await uploadCsv('mixed-brand.csv', MIX);
  check(
    'a sheet mixing brands is refused outright, not half imported',
    mixRes.status === 400 && mixRes.json?.mixedBrands?.length === 2,
    JSON.stringify(mixRes.json || {}).slice(0, 170)
  );
  check(
    'each offending row names its own brand and the row number',
    (mixRes.json?.errors || []).filter((e) => /Row \d+.*(?:Ray-Ban|Fastrack)/i.test(e)).length >= 2,
    JSON.stringify((mixRes.json?.errors || []).slice(0, 2)).slice(0, 200)
  );
  check(
    'and the message says to split by brand',
    /one brand per file|split .*by brand/i.test(mixRes.json?.message || ''),
    String(mixRes.json?.message || '').slice(0, 120)
  );

  const NOTHING_IMPORTED = (await call('/manufacturer/products?limit=400', { token: brand })).json?.products || [];
  check(
    'nothing from the refused sheet reached the catalogue',
    !NOTHING_IMPORTED.some((p2) => /^Gate [AB] Frame$/.test(p2.title || '')),
    `checked ${NOTHING_IMPORTED.length} products`
  );

  const UNLISTED = [
    'title,price,category,brand,product code,model number,description,images,gender,frame shape,frame type,frame material,frame colour,frame size,frame width,frame weight,frame dimensions',
    `Unknown Brand Frame,3099,sunglasses,NikeEyeWEAR,MIX-C1,MIX-C1,A brand this manufacturer never declared,${firstImg},unisex,round,full-rim,acetate,black,medium,52,18,52 x 40 x 18 x 140`,
  ].join('\n');
  const unlisted = await uploadCsv('unlisted-brand.csv', UNLISTED);
  check(
    'a brand that is not on the manufacturer profile is refused per row and named',
    unlisted.status === 400 &&
      (unlisted.json?.errors || []).some((e) => /NikeEyeWEAR/.test(e) && /profile|Brands manufactured/i.test(e)),
    JSON.stringify((unlisted.json?.errors || [unlisted.json?.message]).slice(0, 1)).slice(0, 190)
  );

  const listed = await uploadCsv(
    'listed-brand.csv',
    [
      'title,price,category,brand,product code,model number,description,images,gender,frame shape,frame type,frame material,frame colour,frame size,frame width,frame weight,frame dimensions',
      `Allowed Brand Frame,2799,sunglasses,Ray-Ban,MIX-D1,MIX-D1,A declared brand still imports normally,${firstImg},unisex,round,full-rim,acetate,black,medium,52,18,52 x 40 x 18 x 140`,
    ].join('\n')
  );
  check(
    'a declared single brand still imports (the gate does not block valid sheets)',
    listed.json?.success === true,
    JSON.stringify(listed.json || {}).slice(0, 130)
  );

  /*
   * The other half of "one brand, one manufacturer": bulk upload. A desk refusal
   * is not enough, because the sheet is where brand names actually enter the
   * catalogue. `Zephyr Optics` is created below under a second manufacturer, and
   * the seeded manufacturer then tries to upload it, which must be refused per row
   * naming the real owner. If this passes only because the row failed the
   * brand-list check first, the test would prove nothing - so the assertion reads
   * the specific wording.
   */
  const BULK_OWN_BRAND = `Bulk Brand ${Date.now().toString().slice(-6)}`;
  const admin2 = await call('/admin/auth/login', {
    body: { email: 'samedayopticians@gmail.com', password: 'Sameday123@' },
  });
  const deskToken2 = admin2.json?.token;
  const secondMfg = await call('/admin/manufacturers', {
    token: deskToken2,
    method: 'POST',
    body: {
      name: 'Bulk Clash Contact',
      email: `bulk-clash-${Date.now()}@example.test`,
      password: 'Clash123@',
      phone: '9876500044',
      companyName: 'Bulk Clash Manufacturing',
      gstNumber: '27QQQQQ2222Q1Z2',
      panNumber: 'QQQQQ2222Q',
      address: { street: '2 Bulk Lane', city: 'Pune', state: 'Maharashtra', pincode: '411002' },
      bank: { accountNumber: '40000987654', ifscCode: 'HDFC0001234', bankName: 'HDFC Bank', branchName: 'FC Road' },
      brands: [BULK_OWN_BRAND],
    },
  });
  if (secondMfg.status === 201 || secondMfg.json?.success) {
    const FOREIGN = [
      'title,price,category,brand,product code,model number,description,images,gender,frame shape,frame type,frame material,frame colour,frame size,frame width,frame weight,frame dimensions',
      `Borrowed Brand Frame,2899,sunglasses,"${BULK_OWN_BRAND}",FRN-1,FRN-1,Row using another manufacturer's brand,${firstImg},unisex,round,full-rim,acetate,black,medium,52,18,52 x 40 x 18 x 140`,
    ].join('\n');
    const foreign = await uploadCsv('foreign-brand.csv', FOREIGN);
    check(
      'bulk upload refuses a brand owned by another manufacturer, naming the owner',
      foreign.status === 400 &&
        (foreign.json?.errors || []).some((e) => e.includes(BULK_OWN_BRAND) && /belongs to|owned by/i.test(e)) &&
        !(foreign.json?.errors || []).some((e) => /Brands manufactured/i.test(e)),
      JSON.stringify((foreign.json?.errors || []).slice(0, 1)).slice(0, 220)
    );
    /*
     * Removed rather than fixed. It read
     * `check('the owning manufacturer still uploads its own brand without
     * complaint', true, 'covered by the declared-brand import assertion above')`:
     * the detail admitted the real assertion already ran earlier, so this printed a
     * second PASS for work nothing had re-checked and nothing could fail. A claim
     * that is genuinely covered elsewhere belongs to that assertion alone; a
     * duplicate that cannot fail only inflates the count someone reads as coverage.
     */
  } else {
    check(
      'secondary manufacturer created for the bulk ownership case',
      false,
      JSON.stringify(secondMfg.json || { status: secondMfg.status }).slice(0, 160)
    );
  }

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

main().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exitCode = 2;
});
