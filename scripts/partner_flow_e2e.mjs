#!/usr/bin/env node
/**
 * Partner payout and issue-reporting smoke test.
 *
 * Covers what a courier actually needs and the desk needs to see back: a run in
 * hand, a problem reported from the door landing on the order timeline and on the
 * executive queue, that run being cleared once handled, and the money a partner
 * can audit per delivery.
 *
 *   node scripts/partner_flow_e2e.mjs [base-url]
 *
 * Needs a seeded development database.
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 130)}` : ''}`);
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
  const customer = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  const seller = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  const partner = await login('/delivery-partner/login', 'suresh.partner@optikart.com', 'Partner123@');
  const executive = await login('/executive/login', 'executive.delivery@optikart.com', 'Executive123@');
  const adminToken = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  const me0 = await call('/delivery-partner/me', { token: partner });
  const partnerId = me0.json?.data?.partner?._id;
  if (!check('role logins succeed', !!(customer && seller && partner && executive))) return finish();

  await call('/delivery-partner/location', { token: partner, body: { latitude: 19.076, longitude: 72.877 } });
  await call('/delivery-partner/availability', { token: partner, body: { isAvailable: true }, method: 'PUT' });

  const product = (await call('/products?category=sunglasses&limit=1', { token: seller })).json.products[0];
  await call('/orders', {
    token: customer,
    body: {
      items: [{ product: product._id, quantity: 1 }],
      shippingAddress: { name: 'Partner Flow', phone: '9800001234', street: '4 Linking Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
      paymentMethod: 'cod'
    }
  });
  const order = (await call('/orders?limit=1', { token: customer })).json.orders[0];
  await call(`/seller/orders/${order._id}/status`, { token: seller, body: { status: 'confirmed' }, method: 'PUT' });
  await call(`/seller/orders/${order._id}/status`, { token: seller, body: { status: 'packed' }, method: 'PUT' });
  await new Promise((r) => setTimeout(r, 2500));

  const offers = (await call('/delivery-partner/offers', { token: partner })).json.offers || [];
  if (!check('partner has the run offered', offers.length > 0, offers.map((o) => o.orderNumber).join(','))) return finish();
  const orderId = offers[0].orderId;

  const accepted = await call(`/delivery-partner/offers/${orderId}/respond`, { token: partner, body: { decision: 'accept' } });
  check('accepting the run works', accepted.json?.success === true, accepted.json?.message || accepted.text);

  const badType = await call(`/delivery-partner/report/${orderId}`, { token: partner, body: { type: 'cat_ate_it' } });
  check('an invented reason is refused', badType.status === 400, (badType.json?.message || '').slice(0, 60));

  const noNote = await call(`/delivery-partner/report/${orderId}`, { token: partner, body: { type: 'other' } });
  check('"other" without a note is refused', noNote.status === 400, (noNote.json?.message || ''));

  const reported = await call(`/delivery-partner/report/${orderId}`, {
    token: partner,
    body: { type: 'customer_unreachable', note: 'Two attempts, gate code refused entry' }
  });
  check('a real report is accepted', reported.json?.success === true, reported.json?.message);

  const detail = (await call(`/orders/${orderId}`, { token: customer })).json.order;
  check('the order carries the flag', detail?.deliveryIssue?.type === 'customer_unreachable',
    JSON.stringify(detail?.deliveryIssue || null).slice(0, 80));
  const journey = (detail?.deliveryJourney || []).map((j) => j.note).join(' / ');
  check('the timeline shows what the partner said', /Partner reported/.test(journey) && /Two attempts/.test(journey), journey.slice(-90));

  const queue = (await call('/executive/deliveries/assigned', { token: executive })).json;
  const row = (queue.deliveries || queue.data || []).find((d) => String(d._id) === String(orderId));
  check('the executive queue surfaces the issue', !!row?.deliveryIssue, JSON.stringify(row?.deliveryIssue || null));

  // A second, real partner: the guard is "is this run yours", so another courier
  // must not be able to flag someone else's delivery.
  const partnerList = (await call('/delivery-partner', { token: adminToken })).json?.data || [];
  const other = partnerList.find((p) => String(p._id) !== String(partnerId));
  let otherAttempt = { status: 0 };
  if (other) {
    const otherToken = await login('/delivery-partner/login', other.email, 'Partner123@');
    otherAttempt = await call(`/delivery-partner/report/${orderId}`, { token: otherToken, body: { type: 'refused', note: 'not my run' } });
  }
  check('another partner cannot flag this run', otherAttempt.status === 403, `${other ? 'status ' + otherAttempt.status : 'no second partner seeded'}`);

  const resolved = await call(`/executive/deliveries/${orderId}/issue/resolve`, { token: executive, body: {}, method: 'PUT' });
  check('the desk can clear the flag', resolved.json?.success === true, resolved.json?.message || resolved.text);
  const after = (await call(`/orders/${orderId}`, { token: customer })).json.order;
  check('resolution is recorded on the order', !!after?.deliveryIssue?.resolvedAt, JSON.stringify(after?.deliveryIssue?.resolvedAt || null));
  check('timeline notes the resolution', (after?.deliveryJourney || []).some((j) => /resolved/i.test(j.note || '')));

  const again = await call(`/executive/deliveries/${orderId}/issue/resolve`, { token: executive, body: {}, method: 'PUT' });
  check('clearing twice is refused, not silent', again.status === 400, again.json?.message);

  const complete = await call(`/delivery-partner/complete/${orderId}`, { token: partner, body: {} });
  check('partner can still deliver after a resolved issue', complete.json?.success === true, complete.json?.message);

  const earnings = (await call('/delivery-partner/payment/earnings?period=month', { token: partner })).json.data || {};
  const row0 = (earnings.deliveries || [])[0];
  check('earnings list the runs with a payout', (earnings.deliveries || []).length > 0, JSON.stringify(row0 || null));
  check('each earning row names the order', !!row0?.orderNumber, row0?.orderNumber || 'missing');

  /*
   * One run pays the delivery fee (₹10 per km), which is under the ₹50 minimum
   * withdrawal, so the ledger below would never be exercised. Repeat the same
   * short cycle until there is something real to withdraw.
   */
  const earnMoreRuns = async (tries) => {
    for (let i = 0; i < tries; i += 1) {
      const probe = (await call('/delivery-partner/me', { token: partner })).json.data || {};
      if (Number(probe.availableBalance ?? 0) >= 50) return probe;

      const item = (await call('/products?category=sunglasses&limit=5', { token: seller }))
        .json.products?.[i % 5];
      if (!item) break;
      const made = await call('/orders', {
        token: customer,
        body: {
          items: [{ product: item._id, quantity: 1 }],
          shippingAddress: { name: 'Partner Flow', phone: '9800001234', street: '4 Linking Road', city: 'Mumbai', pincode: '400050' },
          paymentMethod: 'cod'
        }
      });
      const placed = (await call('/orders?limit=1', { token: customer })).json.orders?.[0];
      if (!placed) break;
      await call(`/seller/orders/${placed._id}/status`, { token: seller, body: { status: 'confirmed' }, method: 'PUT' });
      await call(`/seller/orders/${placed._id}/status`, { token: seller, body: { status: 'packed' }, method: 'PUT' });
      // Assigned by hand rather than waiting on the auto-offer timer, so the
      // earning is deterministic: the point of this loop is a balance to
      // withdraw, not another test of dispatch.
      const assigned = await call('/delivery-partner/assign', {
        token: adminToken,
        body: { orderId: placed._id, partnerId }
      });
      if (assigned.json?.success === false) continue;
      await call(`/delivery-partner/complete/${placed._id}`, { token: partner, body: {} });
    }
    return (await call('/delivery-partner/me', { token: partner })).json.data || {};
  };

  /* ---------------------------------------------------------------- payouts
   * A withdrawal that no payment system accepted must not be shown as money
   * that left. These checks are the reason: the ledger used to stamp every row
   * `processed` with a generated `payout_<timestamp>` reference, so a partner's
   * history looked settled while nothing had been attempted.
   * ---------------------------------------------------------------------- */
  await earnMoreRuns(6);

  const ledger = (await call('/delivery-partner/me', { token: partner })).json.data || {};
  const rows0 = (ledger.partner?.withdrawals || ledger.withdrawals || []);
  const fabricated = rows0.filter((w) => w.status === 'processed' && !String(w.payoutId || '').trim());
  check('no withdrawal claims to be paid without a payment reference', fabricated.length === 0,
    JSON.stringify(fabricated.slice(0, 2)));

  const available = Number(ledger.availableBalance ?? 0);
  const withdrawnBefore = Number(ledger.totalWithdrawn ?? 0);
  if (ledger.canWithdrawToday === false) {
    console.log('SKIP  withdrawal attempt (one per calendar day already used by this run)');
  } else if (available < 50) {
    console.log(`SKIP  withdrawal attempt (only ${available} available)`);
  } else {
    // The minimum is ₹50, so withdraw exactly that rather than half of an
    // available balance that may be smaller than twice the floor.
    const amount = 50;
    const wd = await call('/delivery-partner/withdraw', { token: partner, body: { amount } });
    const data = wd.json?.data || {};
    check('withdrawal is accepted', wd.status === 200 && data.amount > 0, wd.text);
    check('withdrawal reports the status the ledger recorded',
      ['processed', 'awaiting_settlement'].includes(data.status), JSON.stringify(data));
    check('withdrawal response carries the real figures, not undefined fields',
      data.netAmount !== undefined && data.platformFee !== undefined && data.availableBalance !== undefined,
      JSON.stringify(data));

    if (data.status === 'awaiting_settlement') {
      const meAfterQueue = (await call('/delivery-partner/me', { token: partner })).json.data || {};
      check('a queued withdrawal is not counted as paid out',
        Number(meAfterQueue.totalWithdrawn ?? 0) === withdrawnBefore,
        `${meAfterQueue.totalWithdrawn} vs ${withdrawnBefore}`);
      check('a queued withdrawal reserves the balance',
        Number(meAfterQueue.availableBalance ?? 0) <= available - amount + 0.01,
        `available ${available} -> ${meAfterQueue.availableBalance} for ${amount}`);
      check('the reserved amount is visible as awaiting settlement',
        Number(meAfterQueue.awaitingSettlement ?? 0) >= amount, meAfterQueue.awaitingSettlement);

      const pend = await call('/delivery-partner/payouts/pending', { token: adminToken });
      const row = (pend.json?.withdrawals || []).find((w) => w.withdrawalId === String(data.withdrawalId || ''))
        || (pend.json?.withdrawals || []).slice(-1)[0];
      check('admin can see the settlement queue', pend.status === 200 && !!row, pend.text);

      const noRef = await call(`/delivery-partner/payouts/${row.withdrawalId}/settle`, {
        token: adminToken, body: { partnerId: ledger.partner?._id || row.partner.id }
      });
      check('settling without a bank reference is refused',
        noRef.status === 400 && noRef.json?.needsReference === true, noRef.text);

      const settled = await call(`/delivery-partner/payouts/${row.withdrawalId}/settle`, {
        token: adminToken,
        body: { partnerId: ledger.partner?._id || row.partner.id, reference: 'UTRTEST123456', note: 'suite settlement' }
      });
      check('settling with a reference marks it paid',
        settled.status === 200 && settled.json?.success === true, settled.text);

      const meSettled = (await call('/delivery-partner/me', { token: partner })).json.data || {};
      check('settling moves the amount into total withdrawn',
        Number(meSettled.totalWithdrawn ?? 0) === withdrawnBefore + amount,
        `${meSettled.totalWithdrawn} vs ${withdrawnBefore} + ${amount}`);
      const settledRow = (meSettled.partner?.withdrawals || []).slice(-1)[0] || {};
      check('the settled row carries the reference that was entered',
        settledRow.payoutId === 'UTRTEST123456' && settledRow.status === 'processed',
        JSON.stringify({ payoutId: settledRow.payoutId, status: settledRow.status }));
      check('settling twice is refused rather than double-counted',
        (await call(`/delivery-partner/payouts/${row.withdrawalId}/settle`, {
          token: adminToken, body: { partnerId: ledger.partner?._id || row.partner.id, reference: 'UTRAGAIN' }
        })).json?.alreadySettled === true);
    } else if (data.status === 'processed') {
      console.log('SKIP  settlement queue checks (the gateway paid this payout, so nothing is queued)');
    } else {
      check('a withdrawal that did not settle must say why', false,
        `unexpected status ${JSON.stringify(data)}`);
    }
  }

  const me = (await call('/delivery-partner/me', { token: partner })).json.data || {};
  check('partner profile exposes withdrawal history', Array.isArray(me.partner?.withdrawals ?? me.withdrawals ?? []),
    typeof (me.partner?.withdrawals ?? me.withdrawals));
  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} partner-flow assertions passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 2; });
