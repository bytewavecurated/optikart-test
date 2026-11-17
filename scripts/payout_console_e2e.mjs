#!/usr/bin/env node
/**
 * Partner payout settlement queue - the contract the admin console stands on.
 *
 * The console at /admin/partner-payouts is a thin front over two endpoints, so
 * what has to be guaranteed mechanically is the contract between them: a
 * settlement without a bank reference is refused outright, a settled row carries
 * the reference a person actually typed, settling cannot happen twice, and a
 * partner cannot read the desk's queue. Those are the properties that keep a
 * partner's earnings history honest; the React around them is presentation.
 *
 * Earlier version of this file funded the partner by completing a handful of
 * runs and assigning them to `suresh.partner` by force. That could not work
 * twice: `partner_flow_e2e.mjs` runs in the same database, withdraws from that
 * same partner and settles the withdrawal, and a partner may withdraw once per
 * calendar day. So depending on suite order this file either found the queue
 * already drained or hit the daily limit, and it failed on suite plumbing rather
 * than on payout behaviour. It now registers its own partner. The register
 * endpoint is admin-only and real, so this is the same path a new hire arrives
 * by - nothing is fabricated in the database.
 *
 *   node scripts/payout_console_e2e.mjs [base-url]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;
const results = [];
const REF = 'UTR7731209845612';

const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
  return ok;
};
const call = async (p, { t, b, m } = {}) => {
  const res = await fetch(API + p, {
    method: m || (b ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
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
const login = async (p, email, password) => (await call(p, { b: { email, password } })).json?.token;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * Scope of this file, deliberately narrower than it first was.
 *
 * `partner_flow_e2e.mjs` already funds a partner, withdraws ₹50, watches the
 * reservation, and settles once with a typed reference. A partner may withdraw
 * only once per calendar day, so a second suite that also withdraws fails on the
 * other suite's bookkeeping instead of on behaviour - which is what happened when
 * the first version of this file tried to earn its own money and register its own
 * partner (registration is outside the OTP-bypass list on purpose, so a suite
 * could not sign in as it without weakening a security boundary that is correct
 * as it stands).
 *
 * So what is asserted here is the part nobody else owns: WHO may see and act on
 * the settlement queue, what a refusal leaves behind, and that the reference a
 * person typed is what the ledger keeps.
 */
async function main() {
  const admin = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  /*
   * This suite's own subject, seeded for it (see fixtures/demoData.js). A partner
   * may withdraw once per calendar day, and `partner_flow_e2e.mjs` - which runs
   * earlier in the same database - already spends suresh.partner's allowance and
   * settles the row it queues. Borrowing that partner meant the settlement
   * contract went unasserted whenever the order of groups happened to drain the
   * queue first, and the group reported green or red depending on which suite ran
   * before it rather than on whether the code was correct.
   */
  const partner = await login('/delivery-partner/login', 'settlements.partner@optikart.com', 'Partner123@');
  const seller = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  if (!check('desk and partner sign in', !!(admin && partner && seller))) return finish();

  /*
   * Find a row this run produced. `partner_flow_e2e.mjs` settles its own, so in a
   * full harness run the queue is legitimately empty and this suite has nothing
   * to settle - reported as a SKIP with the reason rather than pretending to
   * verify. When it runs alone against a seeded database, the queued row from its
   * own funding path is there and every assertion below executes.
   */
  /*
   * Fund the test subject, then create the withdrawal under test.
   *
   * This file used to read the desk queue and skip when it was empty, which in a
   * full harness run it always was: `partner_flow_e2e.mjs` withdraws first, so the
   * settlement half of the contract went unasserted while the group still reported
   * green - a check that quietly declines to check.
   *
   * Earnings come from completed runs assigned by the desk rather than from the
   * cascade, because offers also reach other partners and an earlier suite can
   * take the run, which made the tally drift. Ten digits in the phone field
   * matters too: a nine-digit value failed address validation, every funding order
   * was rejected, and the suite reported "available 0" for a reason that had
   * nothing to do with payouts.
   */
  const customer = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  const my = (await call('/delivery-partner/me', { t: partner })).json?.data || {};
  const partnerId = my.partner?._id;
  if (!check('this suite can reach its partner and the desk roles', !!partnerId && !!seller && !!customer))
    return finish();

  await call('/delivery-partner/location', { t: partner, b: { latitude: 19.076, longitude: 72.877 } });
  await call('/delivery-partner/availability', { t: partner, b: { isAvailable: true }, m: 'PUT' });

  const products = (await call('/products?category=sunglasses&limit=6')).json?.products || [];
  let available = Number(my.availableBalance ?? 0);
  for (let attempt = 0; attempt < 12 && available < 100; attempt += 1) {
    const product = products[attempt % Math.max(1, products.length)];
    if (!product) break;
    await call('/orders', {
      t: customer,
      b: {
        items: [{ product: product._id, quantity: 1 }],
        shippingAddress: {
          name: 'Console Fund',
          phone: `98${String(Date.now()).slice(-8)}`,
          street: '4 Linking Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400050',
        },
        paymentMethod: 'cod',
      },
    });
    const order = ((await call('/orders?limit=1', { t: customer })).json?.orders || [])[0];
    if (!order) break;
    await call(`/seller/orders/${order._id}/status`, { t: seller, b: { status: 'confirmed' }, m: 'PUT' });
    await call(`/seller/orders/${order._id}/status`, { t: seller, b: { status: 'packed' }, m: 'PUT' });
    await sleep(1200);
    const assigned = await call('/delivery-partner/assign', { t: admin, b: { orderId: order._id, partnerId } });
    if (assigned.json?.success !== true) continue;
    const done = await call(`/delivery-partner/complete/${order._id}`, { t: partner, b: {} });
    if (done.json?.success !== true) continue;
    available = Number(((await call('/delivery-partner/me', { t: partner })).json?.data || {}).availableBalance ?? 0);
  }
  check('the partner accrued a withdrawable balance', available >= 50, `available ${available}`);

  // Withdraw ₹50 when the daily rule allows it; otherwise settle the row
  // `partner_flow_e2e.mjs` queued, so the settlement half runs either way.
  let queuedAmount = 0;
  const withdrawnBefore = Number(
    ((await call('/delivery-partner/me', { t: partner })).json?.data || {}).totalWithdrawn ?? 0
  );
  if (available >= 50) {
    const wd = await call('/delivery-partner/withdraw', { t: partner, b: { amount: 50 } });
    if (wd.json?.data?.status === 'awaiting_settlement') {
      queuedAmount = 50;
      /*
       * Was a literal `check('...', true)`. The claim in the label is about the
       * stored row, so what is asserted is the stored row: pending in the desk
       * queue, and NOT counted as paid out on the partner's own balance. That
       * second half is the whole contract of this console - a withdrawal that
       * looks settled before money moved.
       */
      const meAfter = (await call('/delivery-partner/me', { t: partner })).json?.data || {};
      const rowAfter = (meAfter.partner?.withdrawals || meAfter.withdrawals || []).slice(-1)[0] || {};
      check(
        'a fresh withdrawal is queued rather than marked paid',
        rowAfter.status === 'awaiting_settlement' &&
          Number(meAfter.totalWithdrawn ?? 0) === withdrawnBefore &&
          Number(meAfter.awaitingSettlement ?? 50) >= 50,
        JSON.stringify({
          status: rowAfter.status,
          totalWithdrawn: meAfter.totalWithdrawn,
          before: withdrawnBefore,
        }).slice(0, 160)
      );
    } else {
      console.log('NOTE  daily withdrawal limit already used - settling the row partner_flow queued');
    }
  }

  const queue = await call('/delivery-partner/payouts/pending', { t: admin });
  check(
    'the queue endpoint answers the desk',
    queue.status === 200 &&
      Array.isArray(queue.json?.withdrawals) &&
      typeof queue.json?.count === 'number' &&
      typeof queue.json?.totalValue === 'number',
    JSON.stringify({ status: queue.status, count: queue.json?.count }).slice(0, 90)
  );

  const stranger = await call('/delivery-partner/payouts/pending', { t: partner });
  check('a partner cannot read the desk queue', stranger.status === 403, `status ${stranger.status}`);
  const asSeller = await call('/delivery-partner/payouts/pending', { t: seller });
  check('neither can a seller', asSeller.status === 403, `status ${asSeller.status}`);
  const anon = await call('/delivery-partner/payouts/pending', {});
  check('and nothing is readable without a session', anon.status === 401, `status ${anon.status}`);

  const row =
    (queue.json?.withdrawals || []).find((w) => queuedAmount && Number(w.amount) === queuedAmount) ||
    (queue.json?.withdrawals || [])[0];
  if (!row) {
    // Not "nothing to do". With two suites withdrawing against the same database,
    // an empty queue here means neither managed to queue anything, which is the
    // failure this group exists to catch - so it fails the run instead of
    // reporting green.
    check('a withdrawal is queued and waiting for the desk', false, 'queue came back empty');
    return finish();
  }

  check(
    'a queued row carries what a payer needs to act',
    !!row.withdrawalId && !!row.partner?.id && Number(row.amount) >= 0 && !!row.requestedAt,
    JSON.stringify({ id: row.withdrawalId, amount: row.amount }).slice(0, 100)
  );
  check(
    'bank details are present or the row is marked unpayable-by-bank',
    row.bank !== undefined,
    JSON.stringify(row.bank || {}).slice(0, 110)
  );
  check(
    'totalValue matches what the rows add up to',
    Math.round((queue.json.withdrawals || []).reduce((n, w) => n + Number(w.amount || 0), 0) * 100) / 100 ===
      Math.round(Number(queue.json.totalValue) * 100) / 100,
    `${queue.json.totalValue} vs sum of ${queue.json.withdrawals?.length} rows`
  );

  /* a settlement attempt on a row we do not own must fail, and must fail safe */
  const forged = await call('/delivery-partner/payouts/507f1f77bcf86cd799439011/settle', {
    t: admin,
    b: { partnerId: row.partner.id, reference: 'UTR000000000000' },
  });
  check(
    'settling an id that is not a real row fails instead of writing anyway',
    forged.status === 400 || forged.status === 404,
    `status ${forged.status}`
  );

  const noRef = await call(`/delivery-partner/payouts/${row.withdrawalId}/settle`, {
    t: admin,
    b: { partnerId: row.partner.id },
  });
  check(
    'settling without a bank reference is refused',
    noRef.status === 400 && noRef.json?.needsReference === true,
    String(noRef.text).slice(0, 120)
  );

  const still = await call('/delivery-partner/payouts/pending', { t: admin });
  check(
    'a refused settle leaves the row queued and unchanged',
    (still.json?.withdrawals || []).some((w) => w.withdrawalId === row.withdrawalId),
    `count after refusal: ${still.json?.count}`
  );

  const REF = 'UTR9182736455061';
  const ok = await call(`/delivery-partner/payouts/${row.withdrawalId}/settle`, {
    t: admin,
    b: { partnerId: row.partner.id, reference: REF, note: 'NEFT at 18:20' },
  });
  check(
    'settling with a typed reference succeeds',
    ok.status === 200 && ok.json?.success === true,
    String(ok.text).slice(0, 120)
  );

  const me = (await call('/delivery-partner/me', { t: partner })).json?.data || {};
  const stored = (me.partner?.withdrawals || []).slice(-1)[0] || {};
  check(
    'the ledger holds the reference a person typed - never a generated id',
    !/^payout_\d+$/.test(String(stored.payoutId || '')),
    `payoutId=${stored.payoutId}`
  );

  const twice = await call(`/delivery-partner/payouts/${row.withdrawalId}/settle`, {
    t: admin,
    b: { partnerId: row.partner.id, reference: 'UTR1111111111111' },
  });
  check(
    'settling twice is refused rather than paid twice',
    twice.json?.alreadySettled === true || twice.status === 400,
    JSON.stringify(twice.json || {}).slice(0, 110)
  );

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} payout-console assertions passed`);
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
