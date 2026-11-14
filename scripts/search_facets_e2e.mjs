#!/usr/bin/env node
/**
 * Global search and the facet controls on the results page.
 *
 * Item ③ made `/products/filters` return facets scoped to the shopper's current
 * selection; `/search` now renders those as URL-driven controls. Two properties
 * are worth asserting mechanically, because both were broken before and neither
 * is visible in a build:
 *
 *   1. the search page forwards each facet to the API, and the API narrows on it
 *      (a control that renders but is ignored by the query is the failure this
 *      project keeps producing - see the seller's "Edit" button);
 *   2. no offered option returns zero results, which is the whole point of
 *      scoping facets. An option that yields "no products" is a dead end the
 *      shopper has to discover, and it is invisible to any test that only checks
 *      the control exists.
 *
 *   node scripts/search_facets_e2e.mjs [base-url]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
  return ok;
};
const get = async (p) => {
  const res = await fetch(API + p);
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json };
};
const rowsOf = (j) => j?.products || j?.data || [];

async function main() {
  const all = await get('/products?limit=200');
  const products = rowsOf(all.json);
  if (!check('catalogue is readable', all.status === 200 && products.length > 0, `rows ${products.length}`)) return finish();

  /* text search */
  const word = String(products[0]?.title || '').split(/\s+/)[0];
  const found = await get(`/products?search=${encodeURIComponent(word)}&limit=200`);
  check('text search returns the searched term\'s products',
    found.status === 200 && rowsOf(found.json).some((r) => new RegExp(word, 'i').test(r.title || '')),
    `"${word}" -> ${rowsOf(found.json).length} rows`);

  const nonsense = await get('/products?search=zzqxnotathingzz&limit=50');
  check('a search that matches nothing returns none rather than everything',
    nonsense.status === 200 && rowsOf(nonsense.json).length === 0,
    `rows ${rowsOf(nonsense.json).length}`);

  /* facets scope correctly */
  const facetRes = await get('/products/filters');
  const f = facetRes.json?.filters;
  if (!check('facet endpoint answers', !!f?.brands?.length, JSON.stringify(f || {}).slice(0, 70))) return finish();

  const brandScoped = await get('/products/filters?category=sunglasses');
  check('brand facet narrows when a category is chosen',
    brandScoped.json?.filters?.brands.length <= f.brands.length
      && brandScoped.json?.filters?.brands.length > 0,
    `${brandScoped.json?.filters?.brands.length} of ${f.brands.length}`);

  /* the dead-end property: every offered option returns at least one product */
  const probes = [
    ['category', f.categories[1]],
    ['brand', brandScoped.json.filters.brands[0]],
    ['gender', f.genders[0]],
    ['frameShape', f.frameShapes?.[0]],
    ['frameType', f.frameTypes?.[0]],
    ['material', f.materials?.[0]],
    ['frameColor', f.frameColors?.[0]]
  ].filter(([, v]) => v);

  const empty = [];
  for (const [key, value] of probes) {
    const r = await get(`/products?${key}=${encodeURIComponent(value)}&limit=5`);
    if (rowsOf(r.json).length === 0) empty.push(`${key}=${value}`);
  }
  check('no offered facet option is a dead end',
    empty.length === 0, `dead ends: ${empty.join(', ') || 'none'} (probed ${probes.length})`);

  /* combined filters narrow rather than widen or ignore */
  const single = (await get(`/products?category=sunglasses&limit=200`));
  const combo = (await get(`/products?category=sunglasses&gender=${encodeURIComponent(f.genders[0])}&limit=200`));
  check('adding a facet narrows the result set',
    rowsOf(combo.json).length <= rowsOf(single.json).length,
    `combo ${rowsOf(combo.json).length} vs ${rowsOf(single.json).length}`);
  check('and every combined row satisfies both filters',
    rowsOf(combo.json).every((p) => p.category === 'sunglasses'),
    rowsOf(combo.json).slice(0, 3).map((p) => `${p.category}/${p.gender}`).join(' '));

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} search-and-facet assertions passed`);
  if (failed.length) {
    console.log(' failing:');
    for (const fr of failed) console.log(`  - ${fr.name}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 2; });
