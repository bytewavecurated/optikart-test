#!/usr/bin/env node
/**
 * Catalogue and access smoke test.
 *
 * Covers the three things that were silently broken: a manufacturer product that
 * could never be saved, a bulk sheet whose first row disappeared, and routes that
 * answered for the wrong role. Run it against a seeded development database:
 *
 *   node scripts/catalog_access_e2e.mjs [base-url]
 *
 * It creates products and images under server/uploads/products; it does not delete
 * anything outside its own probe rows.
 */
import zlib from 'node:zlib';

const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
  return ok;
};

async function call(path, { token, body, method, headers } = {}) {
  const res = await fetch(API + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html error pages */ }
  return { status: res.status, json, text };
}

const login = (path, email, password) => call(path, { body: { email, password } }).then((r) => r.json?.token);

/** Smallest valid PNG, built by hand so the test has no binary fixtures. */
function png(w, h) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(8 + body.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), 4 + body.length);
    return out;
  };
  const raw = [];
  for (let y = 0; y < h; y++) raw.push(Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x66)]));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', (() => { const b = Buffer.alloc(13); b.writeUInt32BE(w, 0); b.writeUInt32BE(h, 4); b[8] = 8; b[9] = 2; return b; })()),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(raw))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

async function uploadImages(token, files) {
  const boundary = 'qowaveboundary';
  const parts = files.map((f) => Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="${f.name}"\r\nContent-Type: ${f.type}\r\n\r\n`),
    f.data,
    Buffer.from('\r\n')
  ]));
  const body = Buffer.concat([...parts, Buffer.from(`--${boundary}--\r\n`)]);
  const res = await fetch(`${API}/manufacturer/products/upload-images`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, Authorization: `Bearer ${token}` },
    body
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
  const mfg = await login('/manufacturer/login', 'rayban.manufacturer@optikart.com', 'Manufacturer123@');
  const seller = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  const customer = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  const admin = (await call('/admin/auth/login', { body: { email: 'samedayopticians@gmail.com', password: 'Sameday123@' } })).json?.token;
  if (!check('role logins succeed', !!(mfg && seller && customer && admin))) return finish();

  // ---- products carry a name, which the whole catalogue UI reads
  const listed = (await call('/products?limit=5')).json?.products || [];
  check('public catalogue rows carry a name', listed.length > 0 && listed.every((p) => !!p.name),
    JSON.stringify(listed.slice(0, 2).map((p) => p.name)));

  // ---- device uploads
  const up = await uploadImages(mfg, [
    { name: 'one.png', type: 'image/png', data: png(20, 20) },
    { name: 'two.png', type: 'image/png', data: png(24, 16) },
    { name: 'not-an-image.png', type: 'image/png', data: Buffer.from('#!/bin/sh\necho nope\n'.repeat(4)) }
  ]);
  check('uploads accept real pictures', up.json?.urls?.length === 2, JSON.stringify(up.json?.urls || []).slice(0, 90));
  check('uploads reject a disguised file', (up.json?.rejected || []).length === 1, (up.json?.rejected || [''])[0].slice(0, 80));
  check('uploads reject a missing session', (await fetch(`${API}/manufacturer/products/upload-images`, { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=x' }, body: Buffer.from(`--x--\r\n`) })).status === 401);

  if (up.json?.urls?.length) {
    const served = await fetch(BASE + up.json.urls[0]);
    check('uploaded picture is served back', served.status === 200 && (served.headers.get('content-type') || '').includes('image'),
      `${served.status} ${served.headers.get('content-type')}`);
  }

  // ---- the single-product form, which used to be unable to save at all
  const created = await call('/manufacturer/products', {
    token: mfg,
    body: {
      title: 'Access Probe Frame', description: 'manufacturer product without a seller', price: 3299,
      brand: 'Ray-Ban', modelNumber: 'AP-1', productCode: 'AP-1-SKU', stock: 8, category: 'eyeglasses',
      gender: 'unisex', frameShape: 'Round', frameType: 'Full Rim', frameMaterial: 'metal',
      frameSize: '52-17-140', images: up.json?.urls || []
    }
  });
  const made = created.json?.product || {};
  check('manufacturer can save a product with no seller', created.json?.success === true, (created.json?.message || created.text || '').slice(0, 90));
  check('measured frame size is bucketed, not rejected', ['small', 'medium', 'large', 'extra-large'].includes(made.frameSize), `frameSize=${made.frameSize}`);
  check('measurements survive in dimensions', made.dimensions?.temple === 140, JSON.stringify(made.dimensions));
  check('name mirrors the title', made.name === 'Access Probe Frame', String(made.name));

  const visible = (await call('/manufacturer/products', { token: mfg })).json?.products || [];
  check('owner sees the product they created', visible.some((p) => p.title === 'Access Probe Frame'));

  // each product keeps its own images
  const second = await call('/manufacturer/products', {
    token: mfg,
    body: {
      title: 'Access Probe Frame Two', description: 'second listing must not inherit images', price: 3399,
      brand: 'Ray-Ban', modelNumber: 'AP-2', productCode: 'AP-2-SKU', stock: 3, category: 'eyeglasses',
      gender: 'unisex', frameShape: 'Round', frameType: 'Full Rim', frameMaterial: 'metal',
      frameSize: '56-18-145', images: [(up.json?.urls || [])[0]].filter(Boolean)
    }
  });
  const madeTwo = second.json?.product || {};
  check('images stay per product', (madeTwo.images || []).length === 1 && (made.images || []).length === 2,
    `${(made.images || []).length} vs ${(madeTwo.images || []).length}`);

  // ---- bulk upload must import every data row of the sheet
  // Resolve the workbook library from server/node_modules, so the script runs
  // from the repository root rather than only from inside server/.
  const { createRequire } = await import('node:module');
  const { fileURLToPath } = await import('node:url');
  const pathMod = await import('node:path');
  const here = pathMod.dirname(fileURLToPath(import.meta.url));
  let xlsx = null;
  try {
    xlsx = createRequire(pathMod.join(here, '..', 'server', 'noop.js'))('xlsx');
  } catch { /* xlsx missing: the bulk checks below are skipped */ }
  if (xlsx?.utils?.book_new) {
    const rows = [
      { title: 'Bulk One', description: 'row one of the sheet', price: 2001, brand: 'Ray-Ban', category: 'eyeglasses', modelNumber: 'B-1', productCode: 'BP-1', gender: 'unisex', stock: 5, frameShape: 'Round', frameType: 'Full Rim', frameMaterial: 'metal', frameSize: '52-17-140', dimensions: '52 x 40 x 17 x 140', frameColor: 'Black', frameWidth: 138, frameWeight: 24, images: (up.json?.urls || []).map((u) => `${BASE}${u}`).join('|') },
      { title: 'Bulk Two', description: 'row two of the sheet', price: 2002, brand: 'Ray-Ban', category: 'eyeglasses', modelNumber: 'B-2', productCode: 'BP-2', gender: 'unisex', stock: 5, frameShape: 'Round', frameType: 'Full Rim', frameMaterial: 'metal', frameSize: '56-18-145', dimensions: '56 x 42 x 18 x 145', frameColor: 'Gold', frameWidth: 138, frameWeight: 24, images: (up.json?.urls || []).map((u) => `${BASE}${u}`).join('|') },
      { title: 'Bulk Three', description: 'row three of the sheet', price: 2003, brand: 'Ray-Ban', category: 'eyeglasses', modelNumber: 'B-3', productCode: 'BP-3', gender: 'unisex', stock: 5, frameShape: 'Square', frameType: 'Half Rim', frameMaterial: 'acetate', frameSize: '50-15-135', dimensions: '50 x 38 x 15 x 135', frameColor: 'Tortoise', frameWidth: 138, frameWeight: 24, images: (up.json?.urls || []).map((u) => `${BASE}${u}`).join('|') }
    ];
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rows), 'Products');
    const buf = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const boundary = 'qowavebulk';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="probe.xlsx"\r\nContent-Type: application/octet-stream\r\n\r\n`),
      buf, Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    const res = await fetch(`${API}/manufacturer/products/bulk-upload`, {
      method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, Authorization: `Bearer ${mfg}` }, body
    });
    const json = await res.json().catch(() => ({}));
    check('bulk upload imports every row', json.count === rows.length,
    `${json.count}/${rows.length} ${(json.errors || [json.message || '']).join(' | ').slice(0, 180)}`);

    const mine = (await call('/manufacturer/products', { token: mfg })).json?.products || [];
    const bulked = mine.filter((p) => /^Bulk /.test(p.title || ''));
    // Re-runs against the same database accumulate probe rows, so the assertion is
    // "every row of this sheet arrived", not an exact catalogue size.
    check('every row of the sheet is present', bulked.length >= rows.length,
      `${bulked.length} found, ${rows.length} in the sheet`);
    check('bulk dimensions parsed from the composite string',
      bulked.every((p) => (p.dimensions?.width || 0) > 0 && (p.dimensions?.temple || 0) > 0),
      JSON.stringify(bulked.map((p) => p.dimensions)));
    check('imported rows carry a name too', bulked.every((p) => !!p.name),
      JSON.stringify(bulked.map((p) => p.name)));

    // A word the schema does not know must come back as that row's problem, not
    // as a 500 that loses the whole file.
    const bad = [
      { ...rows[0], title: 'Bad Shape One', productCode: 'BAD-1', modelNumber: 'BAD-1', frameShape: 'Hexagonium' }
    ];
    const badWb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(badWb, xlsx.utils.json_to_sheet(bad), 'Products');
    const badBuf = xlsx.write(badWb, { bookType: 'xlsx', type: 'buffer' });
    const badRes = await fetch(`${API}/manufacturer/products/bulk-upload`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, Authorization: `Bearer ${mfg}` },
      body: Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="bad.xlsx"\r\nContent-Type: application/octet-stream\r\n\r\n`),
        badBuf, Buffer.from(`\r\n--${boundary}--\r\n`)
      ])
    });
    const badJson = await badRes.json().catch(() => ({}));
    check('an unknown frame shape is reported per row, not as a 500',
      badRes.status === 400 && (badJson.errors || []).some((e) => /frameShape/.test(e)),
      `${badRes.status} ${(badJson.errors || [badJson.message || '']).join(' | ').slice(0, 150)}`);
  } else {
    console.log('SKIP  xlsx is not installed under server/, bulk checks skipped');
  }

  // ---- access hierarchy: wrong role must not be served, no token must not 500
  const probes = [
    ['/manufacturer/products', customer, 403],
    ['/manufacturer/products', seller, 403],
    ['/manufacturer/products', null, 401],
    ['/executive/dashboard', customer, 403],
    ['/executive/dashboard', mfg, 403],
    ['/admin/orders', customer, 403],
    // A seller token on an admin route is refused by the customer-token check
    // that comes first in the chain; the answer is "not permitted", not 500.
    ['/delivery-partner/unassigned', seller, 403],
    ['/admin/orders', seller, 403],
    ['/delivery-partner/unassigned', admin, 200],
    ['/manufacturer/products', mfg, 200]
  ];
  for (const [path, token, expect] of probes) {
    const r = await call(path, { token });
    const who = { [customer]: 'customer', [seller]: 'seller', [mfg]: 'manufacturer', [admin]: 'admin' }[token] || 'none';
    check(`${who} -> ${path} answers ${expect}`, r.status === expect, `got ${r.status} ${(r.json?.message || '').slice(0, 60)}`);
  }

  // Tidy up only the rows and products this script created, so a repeat run
  // starts from the seeded catalogue rather than accumulating probes.
  for (const title of ['Access Probe Frame', 'Access Probe Frame Two', 'Bulk One', 'Bulk Two', 'Bulk Three']) {
    const found = ((await call('/manufacturer/products', { token: mfg })).json?.products || [])
      .filter((p) => p.title === title);
    for (const p of found) await call(`/manufacturer/products/${p._id}`, { token: mfg, method: 'DELETE' });
  }

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} catalogue/access assertions passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 2; });
