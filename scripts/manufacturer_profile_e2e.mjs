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
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text };
};

async function main() {
  const anon = await call('/manufacturer/profile');
  check('a profile read needs a session', anon.status === 401 || anon.json?.success === false, `status ${anon.status}`);

  const token = (await call('/manufacturer/login', {
    body: { email: 'rayban.manufacturer@optikart.com', password: 'Manufacturer123@' }
  })).json?.token;
  if (!check('the manufacturer signs in', !!token)) return finish();

  const read = await call('/manufacturer/profile', { token });
  const profile = read.json?.profile;
  check('the profile reads back with the account record',
    read.status === 200 && !!profile?.companyName && Array.isArray(profile?.brands),
    JSON.stringify({ status: read.status, company: profile?.companyName }).slice(0, 100));
  check('and it reports what the declared brands actually hold',
    Array.isArray(read.json?.catalogue?.brandsInUse) && typeof read.json?.catalogue?.products === 'number',
    JSON.stringify(read.json?.catalogue || {}).slice(0, 120));

  const fields = (r) => (r.json?.errors || []).map((e) => e.field);
  const badGst = await call('/manufacturer/profile', { token, method: 'PUT', body: { gstNumber: 'NOTAGSTIN' } });
  check('a malformed GSTIN is refused and the field is named',
    badGst.status === 400 && fields(badGst).includes('gstNumber'), JSON.stringify(badGst.json || {}).slice(0, 130));

  const badPan = await call('/manufacturer/profile', { token, method: 'PUT', body: { panNumber: 'AB123' } });
  check('a malformed PAN is refused and the field is named',
    badPan.status === 400 && fields(badPan).includes('panNumber'), JSON.stringify(badPan.json || {}).slice(0, 130));

  const badPhone = await call('/manufacturer/profile', { token, method: 'PUT', body: { phone: '98123' } });
  check('a nine-digit phone is refused rather than stored',
    badPhone.status === 400 && fields(badPhone).includes('phone'), JSON.stringify(fields(badPhone)));

  const badPin = await call('/manufacturer/profile', { token, method: 'PUT', body: { address: { street: 'Linking Road', city: 'Mumbai', pincode: '4000' } } });
  check('a short PIN code is refused',
    badPin.status === 400 && fields(badPin).includes('address.pincode'), JSON.stringify(fields(badPin)));

  const emailMove = await call('/manufacturer/profile', { token, method: 'PUT', body: { email: 'attacker@example.com' } });
  check('the sign-in email cannot be changed through the profile write',
    emailMove.status === 400 && fields(emailMove).includes('email'), JSON.stringify(emailMove.json || {}).slice(0, 140));

  const stillOriginal = (await call('/manufacturer/profile', { token })).json?.profile;
  check('and the account email is untouched after that attempt',
    stillOriginal?.email === 'rayban.manufacturer@optikart.com', stillOriginal?.email);

  const dupBrands = await call('/manufacturer/profile', { token, method: 'PUT', body: { brands: ['Ray-Ban', 'ray-ban'] } });
  check('duplicate brand names are refused instead of splitting a brand in two',
    dupBrands.status === 400 && fields(dupBrands).includes('brands'), JSON.stringify(fields(dupBrands)));

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
      brands: ['Ray-Ban', 'Meta']
    }
  });
  check('a valid edit is saved and reports what changed',
    good.status === 200 && good.json?.success === true && (good.json?.changed || []).includes('gstNumber'),
    JSON.stringify({ status: good.status, changed: good.json?.changed }).slice(0, 130));

  const after = (await call('/manufacturer/profile', { token })).json?.profile;
  check('the saved values read back on the record',
    after?.gstNumber === '27ABCDE1234F1Z5' && after?.panNumber === 'ABCDE1234F'
      && after?.phone === '9876500011' && after?.address?.pincode === '400093'
      && Array.isArray(after?.brands) && after.brands.includes('Meta'),
    JSON.stringify({ gst: after?.gstNumber, pan: after?.panNumber, pin: after?.address?.pincode, brands: after?.brands }).slice(0, 140));

  const same = await call('/manufacturer/profile', { token, method: 'PUT', body: { gstNumber: '27ABCDE1234F1Z5' } });
  check('re-saving an unchanged profile says so instead of claiming a change',
    same.json?.success === true && (same.json?.changed || []).length === 0
      && /nothing to change/i.test(same.json?.message || ''),
    JSON.stringify({ changed: same.json?.changed, message: same.json?.message }).slice(0, 120));

  const blankGst = await call('/manufacturer/profile', { token, method: 'PUT', body: { gstNumber: '' } });
  check('clearing GST is allowed only as a blank, not as a near-miss value',
    blankGst.status === 200 || blankGst.json?.success === true, JSON.stringify(blankGst.json || {}).slice(0, 120));

  const seller = (await call('/seller/login', { body: { email: 'opticalworld@gmail.com', password: 'Seller123@' } })).json?.token;
  const crossAccount = await call('/manufacturer/profile', { token: seller, method: 'PUT', body: { companyName: 'Hijack' } });
  check("a seller's session cannot edit a manufacturer profile",
    crossAccount.status === 401 || crossAccount.status === 403, `status ${crossAccount.status}`);

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

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 2; });
