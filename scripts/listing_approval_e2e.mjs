#!/usr/bin/env node
/**
 * Brand supply-claim suite: a listing of somebody else's brand is a claim about
 * your supply, and it must not sell until the brand and the platform both say so.
 *
 * The behaviour being pinned down is the one no test covered: a manufacturer's
 * retailer could toggle a brand product into their own store and the copy
 * inherited the brand record's `verified` status, so it was buyable immediately -
 * whether or not the brand had ever supplied them. Nothing in the data
 * distinguishes a liquidation purchase from a supplied one, which is precisely
 * why the platform has to ask rather than infer.
 *
 *   node scripts/listing_approval_e2e.mjs [base-url]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
  return ok;
};

const call = async (path, { token, body, method } = {}) => {
  const res = await fetch(API + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text };
};
const login = (path, email, password) => call(path, { body: { email, password } }).then((r) => r.json?.token);

async function main() {
  const brand = await login('/manufacturer/login', 'rayban.manufacturer@optikart.com', 'Manufacturer123@');
  const retailer = await login('/manufacturer-seller/login', 'rayban.retailer1@optikart.com', 'Retailer123@');
  const seller = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  const admin = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  if (!check('brand, retailer, seller and admin sign in', !!(brand && retailer && seller && admin))) return finish();

  /*
   * The brand's own catalogue, not a brand-name search: `?brand=Ray-Ban` also
   * answers with rows carrying the label but no link to this manufacturer
   * document, and those are not the brand's to approve.
   */
  const owned = await call('/manufacturer/products?limit=10', { token: brand });
  const brandProducts = (owned.json?.products || owned.json?.data || []).filter((x) => x._id);
  const brandProduct = brandProducts[0];
  if (!check('the brand has a product to claim', !!brandProduct, JSON.stringify(owned.json).slice(0, 110))) return finish();

  /* ---------------------------------------------------------- declaring */
  const noProof = await call(`/manufacturer-seller/products/${brandProduct._id}/toggle`, {
    token: retailer, body: { price: 1590 }
  });
  check('listing without saying where the stock came from is refused',
    noProof.status === 400 && noProof.json?.reason === 'proof_kind_required', noProof.text);

  const vagueOther = await call(`/manufacturer-seller/products/${brandProduct._id}/toggle`, {
    token: retailer, body: { price: 1590, proofKind: 'other', proofNote: 'got it' }
  });
  check('a vague "other" source is refused, not queued',
    vagueOther.status === 400 && vagueOther.json?.reason === 'note_required', vagueOther.text);

  const purchaseNoRef = await call(`/manufacturer-seller/products/${brandProduct._id}/toggle`, {
    token: retailer, body: { price: 1590, proofKind: 'manufacturer_purchase' }
  });
  check('a claimed purchase needs a reference the brand can look up',
    purchaseNoRef.status === 400 && purchaseNoRef.json?.reason === 'reference_required', purchaseNoRef.text);

  const declared = await call(`/manufacturer-seller/products/${brandProduct._id}/toggle`, {
    token: retailer,
    body: {
      price: 1590,
      proofKind: 'manufacturer_purchase',
      proofReference: 'INV-2026-00451',
      proofNote: 'bought against the March order'
    }
  });
  const clone = declared.json?.product || {};
  check('a proper declaration is accepted', declared.status === 201, declared.text);
  check('the declared listing is not sellable yet',
    declared.json?.state === 'awaiting_manufacturer' && clone.verificationStatus === 'pending',
    `${declared.json?.state} / ${clone.verificationStatus}`);
  check('it is not merely hidden but unverified',
    clone.isListed === false && clone.listing?.manufacturerReview?.status === 'pending',
    JSON.stringify(clone.listing?.manufacturerReview));

  const publicList = (await call('/products?limit=100', { token: null })).json;
  const ids = (publicList.products || []).map((x) => String(x._id));
  check('an unapproved copy does not reach the storefront',
    !ids.includes(String(clone._id)), `found ${clone._id} in ${ids.length} public products`);

  /* ---------------------------------------------------- brand decides */
  const queue = await call('/manufacturer/listing-requests', { token: brand });
  const mine = (queue.json?.requests || []).find((r) => String(r.id) === String(clone._id));
  check('the brand sees the claim', queue.status === 200 && !!mine,
    `queue ${(queue.json?.requests || []).length}`);
  check('the brand sees what was claimed',
    mine?.listing?.sellerProof?.reference === 'INV-2026-00451', JSON.stringify(mine?.listing?.sellerProof));
  check('the queue is labelled by how it reached the buyer, not by a table name',
    mine?.listingKind === 'storefront', mine?.listingKind);

  const premature = await call('/admin/listing-approvals/decide', {
    token: admin, body: { listingKind: 'storefront', listingId: clone._id, decision: 'approve' }
  });
  check('the platform cannot verify before the brand has approved',
    premature.status === 400 && premature.json?.reason === 'brand_first', premature.text);

  const otherBrand = await call('/manufacturer/listing-requests/decide', {
    token: retailer, body: { listingKind: 'storefront', listingId: clone._id, decision: 'approve' }
  });
  check('only the brand can answer for the brand', otherBrand.status === 401 || otherBrand.status === 403,
    `status ${otherBrand.status}`);

  const approved = await call('/manufacturer/listing-requests/decide', {
    token: brand, body: { listingKind: 'storefront', listingId: clone._id, decision: 'approve', reason: 'supplied in March' }
  });
  check('brand approval moves it to the platform, not to the customers',
    approved.json?.state === 'awaiting_admin', approved.text);

  const stillHidden = (await call(`/products/${clone._id}`, { token: null })).json;
  check('brand-approved alone still does not make it buyable',
    (stillHidden?.product?.verificationStatus || stillHidden?.verificationStatus) !== 'verified', JSON.stringify(stillHidden).slice(0, 90));

  const adminQueue = await call('/admin/listing-approvals', { token: admin });
  const awaiting = (adminQueue.json?.awaitingVerification || []).find((r) => String(r.id) === String(clone._id));
  check('the platform queue shows the claim with the brand answer attached',
    !!awaiting && awaiting.listing?.manufacturerReview?.status === 'approved',
    JSON.stringify(awaiting?.listing?.manufacturerReview));
  check('the rows that predate the rule are shown as never confirmed',
    Array.isArray(adminQueue.json?.grandfathered), (adminQueue.json?.grandfathered || []).length);

  const verified = await call('/admin/listing-approvals/decide', {
    token: admin, body: { listingKind: 'storefront', listingId: clone._id, decision: 'approve' }
  });
  check('platform verification is what makes it live',
    verified.json?.state === 'live', verified.text);
  const nowVisible = (await call(`/products/${clone._id}`, { token: null })).json;
  check('and it is then genuinely buyable',
    (nowVisible?.product?.verificationStatus || nowVisible?.verificationStatus) === 'verified', JSON.stringify(nowVisible).slice(0, 80));

  /* -------------------------------------------------- pause and re-declare */
  const paused = await call(`/manufacturer-seller/products/${brandProduct._id}/toggle`, {
    token: retailer, body: { reason: 'out of stock this month' }
  });
  check('toggling off pauses instead of deleting',
    paused.json?.state === 'paused', paused.text);

  const surviving = await call(`/products/${clone._id}`, { token: retailer });
  const keptRow = surviving.json?.product || surviving.json;
  check('a paused listing keeps the configuration the seller chose',
    keptRow && Number(keptRow.price) === 1590, `price ${keptRow?.price}`);

  const resumeBlind = await call(`/manufacturer-seller/products/${brandProduct._id}/toggle`, {
    token: retailer, body: { price: 1590 }
  });
  check('resuming without a fresh declaration is refused',
    resumeBlind.status === 400 && resumeBlind.json?.reason === 'proof_kind_required', resumeBlind.text);

  const resumed = await call(`/manufacturer-seller/products/${brandProduct._id}/toggle`, {
    token: retailer, body: { price: 1590, proofKind: 'other', proofNote: 'bought the remainder from a closing shop' }
  });
  check('resuming re-enters the queue instead of restoring stale permission',
    resumed.json?.state === 'awaiting_manufacturer', resumed.text);
  const afterResume = (await call(`/products/${clone._id}`, { token: retailer })).json;
  const rl = (afterResume?.product || afterResume)?.listing || {};
  check('the earlier approvals did not survive the pause',
    rl?.adminReview?.status === 'none' && rl?.declarationCount >= 2,
    JSON.stringify({ admin: rl?.adminReview?.status, count: rl?.declarationCount }));

  /* ------------------------------------------------- the stock claim path */
  const secondProduct = brandProducts[1] || brandProducts[0];
  const stockClaim = await call('/seller-stock', {
    token: seller,
    body: {
      productId: secondProduct._id,
      sellingPrice: 1499,
      variants: [{ color: 'Matte Black', size: 'M', stock: 3 }],
      proofKind: 'other',
      proofNote: 'secondary distributor lot, invoice attached in email'
    }
  });
  const stockRow = stockClaim.json?.data || {};
  check('a seller claiming brand stock goes through the same two doors',
    stockClaim.json?.state === 'awaiting_manufacturer' && stockRow.isListed === false,
    `${stockClaim.json?.state} / listed ${stockRow.isListed}`);

  const forceListed = await call(`/seller-stock/${stockRow._id}`, {
    token: seller, body: { isListed: true }, method: 'PUT'
  });
  check('an unapproved claim cannot be listed by editing the row directly',
    forceListed.json?.data?.isListed === false, JSON.stringify(forceListed.json?.data?.listing));

  const stockQueue = await call('/manufacturer/listing-requests', { token: brand });
  const stockEntry = (stockQueue.json?.requests || []).find((r) => String(r.id) === String(stockRow._id));
  check('the brand sees the routing-side claim too', !!stockEntry && stockEntry.listingKind === 'stock',
    JSON.stringify(stockEntry?.listing?.sellerProof));

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} supply-claim assertions passed`);
  if (failed.length) {
    console.log(' failing:');
    for (const f of failed) console.log(`  - ${f.name}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 2; });
