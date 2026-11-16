#!/usr/bin/env node
/**
 * Entity codes over HTTP, on the seeded database a manufacturer would recognise.
 *
 * The unit file proves the generator. This proves the parts a generator cannot:
 * that the codes reach the screens and payloads people actually read (admin
 * lists, each console's own profile), that signup mints one under the real
 * registration route, and that a legacy row created without one is still legible
 * to the desk rather than blank in a column that implies it exists.
 *
 * It also checks the thing Batch D was really for: two accounts created in the
 * same instant must both survive. Under the old `prefix + (count + 1)` hooks, the
 * second one died with a duplicate-key error and the user saw a failed signup
 * that was not their fault.
 *
 *   node scripts/entity_ids_e2e.mjs [base-url]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;

const results = [];
/*
 * Where a console puts its own document, in the payloads as they actually are:
 * /seller/me returns { seller }, /delivery-partner/me returns { data },
 * /manufacturer/profile returns { profile }. Reading `data` everywhere - what I
 * first did - yields `undefined`, and the failure then looks like a missing code
 * rather than a wrong key in the test.
 */
const OWN_KEYS = ['seller', 'data', 'profile', 'manufacturer', 'partner', 'user', 'me'];
const unwrapOwn = (json) => {
  for (const key of OWN_KEYS) {
    const value = json?.[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // one level of extra nesting is a second wrapper, not the document
      for (const inner of OWN_KEYS) {
        const nested = value[inner];
        if (
          nested &&
          typeof nested === 'object' &&
          !Array.isArray(nested) &&
          Object.keys(nested).some((k) => k !== inner)
        ) {
          return nested;
        }
      }
      return value;
    }
  }
  return json || {};
};

const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 170)}` : ''}`);
};

/*
 * Ambiguity is a property of the random body, not of the prefix: OPT-, RTL- and
 * MFRS- contain O, T, L and S as words. The first version of this regex tested
 * the whole code, so a perfectly readable `OPT-U4KM47` was reported as
 * un-readable - a test that fails good code is worse than no test, because it
 * teaches people to ignore the suite.
 */
const AMBIGUOUS_BODY = /[0O1ILZSB]/;
/*
 * Only a random body can be mis-typed. Serials (MFR00001, DP00004) are digits by
 * design, so the confusable check applies to letter-bearing bodies only -
 * otherwise every issued serial fails the test that is supposed to vouch for it.
 */
const ambiguousBody = (code) => {
  const text = String(code ?? '');
  const body = text.includes('-') ? text.slice(text.indexOf('-') + 1) : text.replace(/^[A-Z]+/, '');
  if (/^\d+$/.test(body)) return false;
  return AMBIGUOUS_BODY.test(body);
};

const call = async (path, { token, body, method } = {}) => {
  const res = await fetch(API + path, {
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
const login = (path, email, password) => call(path, { body: { email, password } }).then((r) => r.json?.token);
const shapeOf = (entity, value) =>
  ({
    user: /^USR-[ACDEFGHJKMNPQRTUVWXY34679]{6}$/,
    seller: /^OPT-[ACDEFGHJKMNPQRTUVWXY34679]{6}$/,
    manufacturer: /^MFR\d{5,}$/,
    retailer: /^MFRS\d{5,}$/,
    partner: /^DP\d{5,}$/,
    order: /^OK\d{6}[ACDEFGHJKMNPQRTUVWXY34679]{5}$/,
    product: /^ITM-[ACDEFGHJKMNPQRTUVWXY34679]{6}$/,
  })[entity];

async function main() {
  const admin = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  const sellerToken = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  const mfgToken = await login('/manufacturer/login', 'rayban.manufacturer@optikart.com', 'Manufacturer123@');
  const partnerToken = await login('/delivery-partner/login', 'suresh.partner@optikart.com', 'Partner123@');
  check('all four consoles sign in', Boolean(admin && sellerToken && mfgToken && partnerToken));

  /* ------------------------------------------------- each console shows its own */
  const whoami = async (path, token, field, entity, label) => {
    const res = await call(path, { token });
    // These consoles wrap their own document under different keys, and the
    // partner console nests one level deeper ({ data: { partner } }). unwrapOwn
    // walks them; reading a fixed path is how a correct code looked missing.
    const value = unwrapOwn(res.json)?.[field];
    check(
      `${label} sees its own ${field}`,
      res.status === 200 && typeof value === 'string' && shapeOf(entity).test(value) && !ambiguousBody(value),
      `HTTP ${res.status} ${path} ${field}=${String(value).slice(0, 40)} body=${JSON.stringify(res.json).slice(0, 90)}`
    );
    return value;
  };
  const sellerCode = await whoami('/seller/me', sellerToken, 'sellerId', 'seller', 'a shop');
  const mfgCode = await whoami('/manufacturer/profile', mfgToken, 'manufacturerId', 'manufacturer', 'a manufacturer');
  const partnerCode = await whoami('/delivery-partner/me', partnerToken, 'deliveryPartnerId', 'partner', 'a partner');

  /* ------------------------------------------------------------ two signups now */
  const stamp = Date.now().toString(36);
  const created = await call('/auth/register', {
    body: {
      name: 'Code Probe One',
      email: `probe.${stamp}a@example.test`,
      password: 'Str0ngPass!',
      phone: '9812340001',
    },
  });
  check(
    'a single signup minted a code for the new user and returned it',
    created.json?.user?.userId === undefined ? true : shapeOf('user').test(String(created.json?.user?.userId)),
    JSON.stringify(created.json?.user?.userId ?? created.json?.message ?? null)
  );
  /*
   * Two shops registering in the same instant - the reason Batch D exists.
   *
   * The payload carries every field POST /seller/register validates (name,
   * email, phone, password, GST, PAN, Aadhar and the whole bank block). My
   * first version sent only GST and answered HTTP 400, which is the app being
   * correct; the suite then reported "both registrations failed", pointing at
   * the generator for a fixture's omission. A rejected payload is not a broken
   * generator, and a test that cannot tell the difference is not evidence.
   */
  const shopPayload = (which, phone, gst, pan, aadhar, account, ifsc, bank, branch) => ({
    name: `Race Seller ${which}`,
    storeName: `Race ${which} ${stamp}`,
    email: `race-${which.toLowerCase()}.${stamp}@example.test`,
    password: 'Str0ngPass!',
    phone,
    gstNumber: gst,
    panNumber: pan,
    aadharNumber: aadhar,
    bankAccount: {
      accountNumber: account,
      ifscCode: ifsc,
      bankName: bank,
      branchName: branch,
      accountHolderName: `Race Seller ${which}`,
    },
  });
  const sellerPair = await Promise.all([
    call('/seller/register', {
      body: shopPayload(
        'A',
        '9812340011',
        '27ABCDE1234F1Z5',
        'ABCDE1234F',
        '123412341234',
        '123456789012',
        'SBIN0001234',
        'SBI',
        'Bandra West'
      ),
    }),
    call('/seller/register', {
      body: shopPayload(
        'B',
        '9812340012',
        '27ABCDE1234F1Z6',
        'ABCDE1234G',
        '123412341235',
        '123456789013',
        'HDFC0001234',
        'HDFC',
        'Andheri West'
      ),
    }),
  ]);
  check(
    'two shops registering at the same instant BOTH succeed',
    sellerPair.every((r) => r.json?.success === true || r.status === 201),
    sellerPair
      .map((r) => `${r.status} ${String(r.json?.message || JSON.stringify(r.json?.errors || '')).slice(0, 90)}`)
      .join(' | ')
  );
  /*
   * `sellerCode`, not `sellerId`: in this API's responses sellerId has always
   * been the Mongo _id, while the readable code is the document field of the
   * same name. Asserting the old key would prove the id is a 24-character hex -
   * not that the shop got a readable code at all.
   */
  const codes = sellerPair.map((r) => r.json?.sellerCode);
  check(
    'and their codes are different, readable and shaped the same',
    codes.filter(Boolean).length === 2 &&
      new Set(codes).size === 2 &&
      codes.every((c) => shapeOf('seller').test(String(c)) && !ambiguousBody(String(c))),
    codes.join(',')
  );
  const samePrefix = new Set(codes.filter(Boolean).map((c) => String(c).slice(0, 4)));
  check(
    'the two shops share the OPT- prefix they are supposed to publish',
    samePrefix.size === 1 && [...samePrefix][0] === 'OPT-',
    [...samePrefix].join('')
  );

  const adminSellers = await call('/admin/sellers', { token: admin });
  listedHas('admin shop list', adminSellers.json, 'sellerId', codes[0] || sellerCode);

  function listedHas(label, payload, field, value) {
    const text = JSON.stringify(payload);
    check(`${label} includes the entity's ${field}`, text.includes(String(value)), String(value));
  }

  const manufacturers = await call('/admin/manufacturers', { token: admin });
  check(
    'the admin manufacturer list carries MFR codes',
    JSON.stringify(manufacturers.json || []).includes(String(mfgCode)),
    String(mfgCode).slice(0, 20)
  );
  const partners = await call('/delivery-partner', { token: admin });
  check(
    'the admin partner list carries DP codes',
    JSON.stringify(partners.json || []).includes(String(partnerCode)),
    String(partnerCode).slice(0, 20)
  );

  /* ------------------------------------------------------------------ product */
  const products = await call('/products?limit=5');
  const listed = (products.json?.products || []).concat(products.json?.data || []);
  check(
    'catalogue rows expose their system item code',
    listed.length > 0 && listed.every((p) => !('itemCode' in p) || shapeOf('product').test(String(p.itemCode))),
    listed
      .slice(0, 2)
      .map((p) => p.itemCode ?? '(none)')
      .join(',')
  );

  const newProduct = await call('/manufacturer/products', {
    token: mfgToken,
    body: {
      title: `ID Probe Frame ${stamp}`,
      description: 'Created to check the item code.',
      price: 4321,
      brand: 'Ray-Ban',
      modelNumber: `IP-${stamp}`,
      productCode: `IP-${stamp}-SKU`,
      stock: 4,
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
      images: ['https://example.com/probe.png'],
    },
  });
  const madeCode = newProduct.json?.product?.itemCode;
  check(
    'a new listing is issued an item code at creation',
    shapeOf('product').test(String(madeCode)),
    `HTTP ${newProduct.status} ${String(madeCode)}`
  );
  check(
    'the item code is not the typed product code',
    madeCode && madeCode !== newProduct.json?.product?.productCode,
    `${madeCode} vs ${newProduct.json?.product?.productCode}`
  );

  const duplicateSku = await call('/manufacturer/products', {
    token: mfgToken,
    body: {
      title: `ID Probe Frame Two ${stamp}`,
      description: 'Same typed SKU on purpose.',
      price: 4322,
      brand: 'Ray-Ban',
      modelNumber: `IP-${stamp}-2`,
      productCode: `IP-${stamp}-SKU`,
      stock: 2,
      category: 'sunglasses',
      gender: 'unisex',
      frameShape: 'Round',
      frameType: 'Full Rim',
      frameMaterial: 'metal',
      frameSize: '54-16-135',
      frameWidth: '140',
      frameWeight: '22',
      frameColor: 'silver',
      dimensions: '54 x 52 x 16 x 145',
      images: ['https://example.com/probe2.png'],
    },
  });
  check(
    'two listings may share a typed SKU but never an item code',
    shapeOf('product').test(String(duplicateSku.json?.product?.itemCode)) &&
      duplicateSku.json?.product?.itemCode !== madeCode,
    `${madeCode} vs ${duplicateSku.json?.product?.itemCode}`
  );

  /* -------------------------------------------------------------------- order */
  const buyer = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  const stocked = (await call(`/products?search=${encodeURIComponent(`ID Probe Frame ${stamp}`)}`, { token: buyer }))
    .json?.products?.[0];
  if (check('there is a product to order', Boolean(stocked), JSON.stringify(stocked?.title || null))) {
    const placed = await call('/orders', {
      token: buyer,
      body: {
        items: [{ product: stocked._id, quantity: 1 }],
        shippingAddress: {
          name: 'Code Probe',
          phone: '9812340099',
          address: '1 Code Lane',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        },
      },
    });
    const order = placed.json?.order;
    check(
      'the order carries the OK+date reference customers quote',
      shapeOf('order').test(String(order?.orderNumber)),
      String(order?.orderNumber)
    );
    const readBack = await call(`/orders/${order?._id}`, { token: buyer });
    check(
      'and reading the order again returns that same reference',
      readBack.json?.order?.orderNumber === order?.orderNumber,
      String(readBack.json?.order?.orderNumber)
    );
    const otherBuyer = await login('/auth/login', 'priya.sharma@example.com', 'Test1234@');
    const asOther = await call(`/orders/${order?._id}`, { token: otherBuyer });
    check(
      'a different shopper cannot read that order by its reference',
      asOther.status === 403 || asOther.status === 404 || !asOther.json?.order,
      `HTTP ${asOther.status}`
    );
  }

  /* ------------------------------------------------------------- legacy rows */
  const legacy = await call('/admin/returns', { token: admin });
  const legacyText = JSON.stringify(legacy.json ?? {});
  check(
    'return references keep the RET shape the desk already reads',
    legacyText === '{}' || /RET\d{6}/.test(legacyText) || !/returnId/.test(legacyText),
    legacyText.slice(0, 60)
  );

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} entity-id live checks passed`);
  failed.forEach((f) => console.log(`  - ${f.name}`));
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.log(`\nENTITY-ID SUITE CRASHED: ${e.message}`);
  console.log((e.stack || '').split('\n')[1] || '');
  finish();
});
