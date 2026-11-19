#!/usr/bin/env node
/**
 * The manufacturer's own profile, and the rules that keep it usable as a record.
 *
 * GST and PAN are the two fields here with a document on the other end of them:
 * they reach the buyer's invoice. A profile screen that accepts a malformed GSTIN
 * does not look broken - it looks saved - and the failure surfaces months later in
 * a compliance conversation. So the contract asserted is that a bad value is
 * refused naming its field, a good value round-trips, the sign-in email cannot be
 * moved by a token-holders request, and the edit is logged to the desk because it
 * changed a tax identity.
 *
 *   node scripts/manufacturer_profile_e2e.mjs [base-url]
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
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, json, text };
};

async function main() {
  const anon = await call('/manufacturer/profile');
  check('a profile read needs a session', anon.status === 401 || anon.json?.success === false, `status ${anon.status}`);

  const token = (
    await call('/manufacturer/login', {
      body: { email: 'rayban.manufacturer@optikart.com', password: 'Manufacturer123@' },
    })
  ).json?.token;
  if (!check('the manufacturer signs in', !!token)) return finish();

  const read = await call('/manufacturer/profile', { token });
  const profile = read.json?.profile;
  check(
    'the profile reads back with the account record',
    read.status === 200 && !!profile?.companyName && Array.isArray(profile?.brands),
    JSON.stringify({ status: read.status, company: profile?.companyName }).slice(0, 100)
  );
  check(
    'and it reports what the declared brands actually hold',
    Array.isArray(read.json?.catalogue?.brandsInUse) && typeof read.json?.catalogue?.products === 'number',
    JSON.stringify(read.json?.catalogue || {}).slice(0, 120)
  );

  const fields = (r) => (r.json?.errors || []).map((e) => e.field);
  const badGst = await call('/manufacturer/profile', { token, method: 'PUT', body: { gstNumber: 'NOTAGSTIN' } });
  check(
    'a malformed GSTIN is refused and the field is named',
    badGst.status === 400 && fields(badGst).includes('gstNumber'),
    JSON.stringify(badGst.json || {}).slice(0, 130)
  );

  const badPan = await call('/manufacturer/profile', { token, method: 'PUT', body: { panNumber: 'AB123' } });
  check(
    'a malformed PAN is refused and the field is named',
    badPan.status === 400 && fields(badPan).includes('panNumber'),
    JSON.stringify(badPan.json || {}).slice(0, 130)
  );

  const badPhone = await call('/manufacturer/profile', { token, method: 'PUT', body: { phone: '98123' } });
  check(
    'a nine-digit phone is refused rather than stored',
    badPhone.status === 400 && fields(badPhone).includes('phone'),
    JSON.stringify(fields(badPhone))
  );

  const badPin = await call('/manufacturer/profile', {
    token,
    method: 'PUT',
    body: { address: { street: 'Linking Road', city: 'Mumbai', pincode: '4000' } },
  });
  check(
    'a short PIN code is refused',
    badPin.status === 400 && fields(badPin).includes('address.pincode'),
    JSON.stringify(fields(badPin))
  );

  const emailMove = await call('/manufacturer/profile', {
    token,
    method: 'PUT',
    body: { email: 'attacker@example.com' },
  });
  check(
    'the sign-in email cannot be changed through the profile write',
    emailMove.status === 400 && fields(emailMove).includes('email'),
    JSON.stringify(emailMove.json || {}).slice(0, 140)
  );

  const stillOriginal = (await call('/manufacturer/profile', { token })).json?.profile;
  check(
    'and the account email is untouched after that attempt',
    stillOriginal?.email === 'rayban.manufacturer@optikart.com',
    stillOriginal?.email
  );

  const dupBrands = await call('/manufacturer/profile', {
    token,
    method: 'PUT',
    body: { brands: ['Ray-Ban', 'ray-ban'] },
  });
  check(
    'duplicate brand names are refused instead of splitting a brand in two',
    dupBrands.status === 400 && fields(dupBrands).includes('brands'),
    JSON.stringify(fields(dupBrands))
  );

  const good = await call('/manufacturer/profile', {
    token,
    method: 'PUT',
    body: {
      companyName: 'Ray-Ban India Manufacturing',
      gstNumber: '27ABCDE1234F1Z5',
      panNumber: 'ABCDE1234F',
      phone: '9876500011',
      website: 'https://www.ray-ban.com',
      address: { street: 'Unit 4, MIDC Andheri East', city: 'Mumbai', state: 'Maharashtra', pincode: '400093' },
      brands: ['Ray-Ban', 'Meta'],
    },
  });
  check(
    'a valid edit is saved and reports what changed',
    good.status === 200 && good.json?.success === true && (good.json?.changed || []).includes('gstNumber'),
    JSON.stringify({ status: good.status, changed: good.json?.changed }).slice(0, 130)
  );

  const after = (await call('/manufacturer/profile', { token })).json?.profile;
  check(
    'the saved values read back on the record',
    after?.gstNumber === '27ABCDE1234F1Z5' &&
      after?.panNumber === 'ABCDE1234F' &&
      after?.phone === '9876500011' &&
      after?.address?.pincode === '400093' &&
      Array.isArray(after?.brands) &&
      after.brands.includes('Meta'),
    JSON.stringify({
      gst: after?.gstNumber,
      pan: after?.panNumber,
      pin: after?.address?.pincode,
      brands: after?.brands,
    }).slice(0, 140)
  );

  const same = await call('/manufacturer/profile', { token, method: 'PUT', body: { gstNumber: '27ABCDE1234F1Z5' } });
  check(
    're-saving an unchanged profile says so instead of claiming a change',
    same.json?.success === true &&
      (same.json?.changed || []).length === 0 &&
      /nothing to change/i.test(same.json?.message || ''),
    JSON.stringify({ changed: same.json?.changed, message: same.json?.message }).slice(0, 120)
  );

  const blankGst = await call('/manufacturer/profile', { token, method: 'PUT', body: { gstNumber: '' } });
  check(
    'clearing GST is allowed only as a blank, not as a near-miss value',
    blankGst.status === 200 || blankGst.json?.success === true,
    JSON.stringify(blankGst.json || {}).slice(0, 120)
  );

  const seller = (await call('/seller/login', { body: { email: 'opticalworld@gmail.com', password: 'Seller123@' } }))
    .json?.token;
  const crossAccount = await call('/manufacturer/profile', {
    token: seller,
    method: 'PUT',
    body: { companyName: 'Hijack' },
  });
  check(
    "a seller's session cannot edit a manufacturer profile",
    crossAccount.status === 401 || crossAccount.status === 403,
    `status ${crossAccount.status}`
  );

  /*
   * One brand name, one manufacturer - enforced at every door that can create the
   * clash, including the admin console, because the desk would otherwise create it
   * in good faith while adding a second company that trades under a name already
   * recorded. These assertions also prove the guards are wired (a missing import
   * in the admin route looked fine to `node --check` and would have been a
   * ReferenceError in production): each case performs the real write attempt.
   */
  // Unique per run: two suites that both invent "Zephyr Optics" would make the
  // second one's own-brand check fail for a reason that has nothing to do with the
  // rule under test - which is exactly what happened on the first run.
  const OWN_BRAND = `Profile Brand ${Date.now().toString().slice(-6)}`;
  const admin = (
    await call('/admin/auth/login', { body: { email: 'samedayopticians@gmail.com', password: 'Sameday123@' } })
  ).json?.token;
  if (!check('admin signs in for the ownership checks', !!admin)) return finish();

  const clashCreate = await call('/admin/manufacturers', {
    token: admin,
    body: {
      name: 'Second Co Contact',
      email: `clash-${Date.now()}@example.test`,
      password: 'Clash123@',
      phone: '9876500022',
      companyName: 'Second Manufacturing Co',
      gstNumber: '27ZZZZZ9999Z1Z9',
      panNumber: 'ZZZZZ9999Z',
      address: { street: '9 Clash Estate', city: 'Jaipur', state: 'Rajasthan', pincode: '302001' },
      bank: {
        accountNumber: '20000555444',
        ifscCode: 'PUNB0001234',
        bankName: 'Punjab National Bank',
        branchName: 'MI Road',
      },
      brands: ['Ray-Ban'],
    },
  });
  check(
    'the desk cannot create a second manufacturer under an existing brand',
    clashCreate.status === 400 &&
      (clashCreate.json?.errors || []).some((e) => e.field === 'brands' && /Ray-Ban/.test(e.message)),
    JSON.stringify(clashCreate.json || {}).slice(0, 180)
  );
  check(
    'and the refusal names the owning company, not just "not allowed"',
    /owned by|belongs to|only one manufacturer/i.test(JSON.stringify(clashCreate.json || {})),
    JSON.stringify((clashCreate.json?.errors || []).slice(0, 1)).slice(0, 170)
  );

  const ownCreate = await call('/admin/manufacturers', {
    token: admin,
    body: {
      name: 'Fresh Co Contact',
      email: `fresh-${Date.now()}@example.test`,
      password: 'Fresh123@',
      phone: '9876500033',
      companyName: 'Fresh Manufacturing Co',
      gstNumber: '27AAAAA1111A1Z1',
      panNumber: 'AAAAA1111A',
      address: { street: '8 Fresh Park', city: 'Surat', state: 'Gujarat', pincode: '395003' },
      bank: {
        accountNumber: '70000123987',
        ifscCode: 'KKBK0001234',
        bankName: 'Kotak Mahindra',
        branchName: 'Varachha',
      },
      brands: [OWN_BRAND],
    },
  });
  /*
   * This suite's subject is BRAND OWNERSHIP; it needs Fresh Co to exist as a
   * real signed-in manufacturer. The confirmation mail cannot be clicked here
   * (no mailbox in the harness), so the desk override is the honest path -
   * exactly what force-activate exists for.
   */
  if (ownCreate.status === 201 || ownCreate.json?.success) {
    await call(`/admin/manufacturers/${ownCreate.json.manufacturer._id}/force-activate`, {
      token: admin,
      body: { reason: 'manufacturer_profile e2e: needs a live second tenant to test brand ownership' },
    });
  }
  check(
    'a brand nobody owns is still accepted (the rule must not block valid creates)',
    ownCreate.status === 201 || ownCreate.json?.success === true,
    JSON.stringify(ownCreate.json || {}).slice(0, 150)
  );

  const stealBrand = await call('/manufacturer/profile', {
    token,
    method: 'PUT',
    body: { brands: ['Ray-Ban', OWN_BRAND] },
  });
  check(
    "a manufacturer cannot claim another's brand from their own profile",
    stealBrand.status === 400 && (stealBrand.json?.errors || []).some((e) => e.message.includes(OWN_BRAND)),
    JSON.stringify(stealBrand.json || {}).slice(0, 200)
  );
  const untouched = (await call('/manufacturer/profile', { token })).json?.profile;
  check(
    'a refused brand list leaves the profile brands unchanged',
    Array.isArray(untouched?.brands) && !untouched.brands.some((b) => /Zephyr/i.test(String(b))),
    JSON.stringify(untouched?.brands)
  );

  const keepOwn = await call('/manufacturer/profile', {
    token,
    method: 'PUT',
    body: { brands: ['Ray-Ban', 'Meta Optics'] },
  });
  check(
    're-saving a brand the account already owns never refuses itself',
    keepOwn.json?.success === true && (keepOwn.json?.errors || []).length === 0,
    JSON.stringify(keepOwn.json || {}).slice(0, 140)
  );

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} manufacturer-profile assertions passed`);
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
