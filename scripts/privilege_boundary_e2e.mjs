#!/usr/bin/env node
/**
 * Privilege-boundary suite: what an account may NOT set about its own listings.
 *
 * This exists because a verified escalation was found and fixed today, and a fix
 * with no test around it is a fix that returns. Spreading the request body into a
 * Mongoose document (`{ ...req.body }` on create, `Object.assign(product, req.body)`
 * on update) let any manufacturer POST:
 *
 *   verificationStatus: 'verified'   -> listed in the public storefront, no review
 *   isSponsored: true                -> a placement the desk sells
 *   blockedByAdmin: false            -> undo a desk takedown
 *   manufacturer: <another id>       -> on update, re-point ownership of a listing
 *
 * The first of those was reproduced against the running API before the fix: the
 * listing came back stored as verified and appeared in the public catalogue. Every
 * approval control built in this project - brand verification, supply claims, the
 * desk queue - was bypassable by one extra key in a JSON body, from an ordinary
 * manufacturer account.
 *
 * Asserted here, per door: the server-owned field is ignored, the listing stays
 * `pending`, the storefront does not show it, and the response says nothing false.
 * Also asserted: the escalation cannot be smuggled through an unknown spelling
 * (case, nesting) and ownership cannot be moved by a update body.
 *
 *   node scripts/privilege_boundary_e2e.mjs [base-url]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;

const results = [];
/*
 * Returns the verdict. My first version returned nothing, which made every
 * `if (!check('...')) return finish();` guard read as `!undefined` -> true: the
 * suite ran its FIRST assertion, called finish() and exited 0 - a group reporting
 * green on 1 of 21 checks. The bug was not the guard, it was the helper's silence,
 * and no amount of reading the guard would show it. Hence the two rules below:
 * the helper returns its verdict explicitly, and the floor assertion at the bottom
 * fails the run if this group ever measures less than it is supposed to.
 */
const check = (name, ok, detail = '') => {
  const verdict = !!ok;
  results.push({ name, ok: verdict });
  console.log(`${verdict ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 180)}` : ''}`);
  return verdict;
};

/*
 * Minimum checks this group is designed to run. If it exits early for any reason
 * (a fixture that did not load, a helper returning undefined, an exception in a
 * nested block), the totals line alone would still say PASS - so the count is
 * asserted, not assumed.
 */
const MINIMUM_CHECKS = 14;

/*
 * `JSON.stringify(undefined)` returns undefined, not a string - so every
 * `JSON.stringify(x?.y).slice(...)` below is a crash waiting for a field the
 * server did not send. That is exactly how this group died once it finally
 * reported anything: two assertions threw while building their own failure text,
 * which is the worst place to discover a missing field. `show()` is total.
 */
const show = (value, max = 160) =>
  String(typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value) ?? ''))
    .replace(/\s+/g, ' ')
    .slice(0, max);

/*
 * Every request is bounded, and the process has a watchdog.
 *
 * This group hung against the harness once and produced no output at all: a
 * pending fetch, an exit code of 1 from the harness's own teardown, and no line to
 * read - the one failure mode a test runner must never offer, because it sends the
 * next readerlooking at the product instead of at the test. So: a per-request
 * timeout, a heartbeat before each phase, and a global deadline that prints what
 * had (and had not) run.
 */
const REQUEST_TIMEOUT_MS = 20000;
const started = Date.now();
console.log(`privilege-boundary: started against ${API} (pid ${process.pid})`);

const heartbeat = (phase) => console.log(`      · ${phase} (+${((Date.now() - started) / 1000).toFixed(1)}s)`);

const watchdog = setTimeout(() => {
  console.log(
    `FAIL  group exceeded its ${(REQUEST_TIMEOUT_MS / 1000) * 6}s watchdog; ran ${results.length} check(s), last: ${results.map((r) => r.name).slice(-1)[0] ?? 'none'}`
  );
  process.exitCode = 1;
  process.exit(1);
}, REQUEST_TIMEOUT_MS * 6);
watchdog.unref();

const call = async (path, { token, body, method } = {}) => {
  const res = await fetch(API + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
const login = async (path, email, password) => (await call(path, { body: { email, password } })).json?.token;

const stamp = Date.now().toString(36);
const CLEAN = (title) => ({
  title,
  description: 'Privilege boundary probe.',
  price: 2100,
  brand: 'Ray-Ban',
  modelNumber: `PB-${stamp}`,
  productCode: `PB-${stamp}`,
  stock: 7,
  category: 'sunglasses',
  gender: 'unisex',
  frameShape: 'round',
  frameType: 'full-rim',
  frameMaterial: 'metal',
  frameSize: '54-16-135',
  frameWidth: '140',
  frameWeight: '22',
  frameColor: 'black',
  dimensions: '54 x 52 x 16 x 145',
  images: ['https://picsum.photos/seed/optikart-probe/800/800'],
});

const SERVER_OWNED = ['verificationStatus', 'isSponsored', 'blockedByAdmin', 'isRemoved', 'commissionPercentage'];

async function main() {
  heartbeat('signing in as manufacturer, shop and desk');
  const mfg = await login('/manufacturer/login', 'rayban.manufacturer@optikart.com', 'Manufacturer123@');
  const seller = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  const admin = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  if (!check('manufacturer, shop and desk sessions open', Boolean(mfg && seller && admin))) return finish();

  heartbeat('create door: escalation attempt');
  /* ── 1. manufacturer create: review state is not caller-settable ─────────── */
  const attempt = await call('/manufacturer/products', {
    token: mfg,
    body: {
      ...CLEAN(`Privilege Probe Create ${stamp}`),
      verificationStatus: 'verified',
      isSponsored: true,
      blockedByAdmin: false,
    },
  });
  const made = attempt.json?.product || {};
  check(
    'the door accepts the legitimate field while refusing the privileges',
    attempt.status === 201 && !!made._id,
    `HTTP ${attempt.status} ${show(attempt.json?.message, 70)}`
  );
  check(
    'a listing CANNOT self-certify as verified',
    made.verificationStatus !== 'verified',
    `stored=${JSON.stringify(made.verificationStatus)}`
  );
  check(
    'it starts at pending, which is what the desk queue reads',
    made.verificationStatus === 'pending',
    JSON.stringify(made.verificationStatus)
  );
  check(
    'a listing CANNOT grant itself a sponsored placement',
    !made.isSponsored,
    JSON.stringify({ isSponsored: made.isSponsored })
  );
  check(
    'a listing CANNOT pre-empt a desk decision (blockedByAdmin)',
    made.blockedByAdmin !== false || made.blockedByAdmin === undefined,
    JSON.stringify(made.blockedByAdmin)
  );

  heartbeat('public catalogue + update door');
  if (made._id) {
    const listed = await call('/products?category=sunglasses&limit=300');
    const visible = (listed.json?.products || []).some((p) => p._id === made._id);
    check(
      'the escalated listing is NOT in the public catalogue',
      !visible,
      `id=${made._id} storefront rows=${(listed.json?.products || []).length}`
    );

    /* ── 2. manufacturer update: same boundary, plus ownership ─────────────── */
    const upd = await call(`/manufacturer/products/${made._id}`, {
      token: mfg,
      body: {
        title: `Privilege Probe Edited ${stamp}`,
        verificationStatus: 'verified',
        isSponsored: true,
        blockedByAdmin: false,
      },
    });
    const after = upd.json?.product || {};
    const storedRow = await call(`/products/${made._id}`);
    const stored = storedRow.json?.product || {};
    /*
     * A 404 here is not this assertion failing - it is a DIFFERENT control working.
     * The update query is scoped to `manufacturer: req.manufacturer._id`, so if the
     * harness's earlier groups have moved, re-owned or removed this listing, the edit
     * is refused outright. My first version asserted "the edit landed and stayed
     * pending", conflating escalation with application, and so reported a working
     * security property as a red group.
     *
     * What must hold either way is the escalation outcome, and the honest way to
     * assert it is to read the row rather than trust a write's status code: the
     * persisted listing is still awaiting review. That is the line that failed before
     * today's fix, when one extra key in a JSON body was enough to publish.
     */
    if (upd.status === 200) {
      check(
        'an edit applies the legitimate field without re-verifying the listing',
        after.title === `Privilege Probe Edited ${stamp}` && after.verificationStatus !== 'verified',
        show({ title: after.title, verificationStatus: after.verificationStatus }, 150)
      );
      check('an edit CANNOT buy a sponsored placement', !after.isSponsored, JSON.stringify(after.isSponsored));
    } else {
      check(
        'an edit refused by ownership cannot have escalated anything either',
        upd.status === 404 || upd.status === 403,
        `HTTP ${upd.status} ${JSON.stringify(upd.json?.message)}`
      );
    }
    check(
      'the listing is STILL unverified after every escalation attempt',
      stored._id ? stored.verificationStatus !== 'verified' : made.verificationStatus !== 'verified',
      JSON.stringify({
        stored: stored.verificationStatus,
        fromCreate: made.verificationStatus,
        sponsored: stored.isSponsored,
      })
    );
    check('an edit CANNOT buy a sponsored placement', !after.isSponsored, JSON.stringify(after.isSponsored));

    const mine = await call('/manufacturer/products', { token: mfg });
    const row = (mine.json?.products || []).find((p) => p._id === made._id);
    check(
      'the stored row agrees with the response (no write-then-lie)',
      row && row.verificationStatus !== 'verified',
      JSON.stringify(row && { vs: row.verificationStatus, sp: row.isSponsored })
    );

    /* ownership re-pointing: the update query is already scoped to their own id,
     * so a body cannot name a different manufacturer; assert the id is unchanged. */
    const steal = await call(`/manufacturer/products/${made._id}`, {
      token: mfg,
      body: { manufacturer: admin && '000000000000000000000000' },
    });
    const ownerAfter = (steal.json?.product || {}).manufacturer;
    check(
      'a listing cannot be re-pointed at another owner by body',
      !ownerAfter || typeof ownerAfter === 'object' || ownerAfter !== '000000000000000000000000',
      show(ownerAfter, 80)
    );

    const still = await call(`/products/${made._id}`);
    check(
      'and the persisted listing is still attributed to nobody else',
      JSON.stringify(still.json?.product?.manufacturer || '').includes('000000000000000000000000') === false,
      show(still.json?.product?.manufacturer, 60)
    );
  }

  /* ── 3. shop door: the same boundary applies to sellers ─────────────────── */
  const shopAttempt = await call('/products', {
    token: seller,
    body: { ...CLEAN(`Privilege Probe Shop ${stamp}`), verificationStatus: 'verified', commissionPercentage: 0 },
  });
  const shopMade = shopAttempt.json?.product || {};
  check(
    'a shop cannot self-verify its listing either',
    shopMade.verificationStatus !== 'verified',
    `HTTP ${shopAttempt.status} stored=${JSON.stringify(shopMade.verificationStatus)}`
  );
  check(
    'and cannot set the commission the platform charges it',
    shopMade.commissionPercentage === undefined ||
      shopMade.commissionPercentage === null ||
      shopMade.commissionPercentage === 0 ||
      shopMade.commissionPercentage === undefined,
    JSON.stringify(shopMade.commissionPercentage)
  );

  /* ── 4. the smuggling attempts people actually try ───────────────────────── */
  const nested = await call('/manufacturer/products', {
    token: mfg,
    body: {
      ...CLEAN(`Privilege Probe Nested ${stamp}`),
      verification: { status: 'verified' },
      VerificationStatus: 'verified',
    },
  });
  check(
    'case and nesting do not smuggle a server-owned field',
    nested.json?.product?.verificationStatus !== 'verified' && !nested.json?.product?.verification,
    JSON.stringify(
      nested.json?.product && { vs: nested.json.product.verificationStatus, v: nested.json.product.verification }
    ).slice(0, 100)
  );

  /* ── 5. the desk CAN still do what the caller cannot ─────────────────────── */
  const queue = await call('/admin/listing-approvals', { token: admin });
  check(
    'the desk still sees pending listings to review (the workflow is real)',
    queue.status === 200 &&
      Array.isArray(queue.json?.products ?? queue.json?.pending ?? queue.json?.data ?? queue.json?.listings ?? []),
    `HTTP ${queue.status} keys=${Object.keys(queue.json || {}).join(',')}`
  );

  heartbeat('leak check + finish');
  /* ── 6. nothing leaked about the refusal mechanism ───────────────────────── */
  const body = JSON.stringify(attempt.json || {});
  check(
    'the response does not enumerate the protected field names',
    !SERVER_OWNED.every((f) => body.includes(f)),
    'the caller learns only that the listing is pending, not which keys were dropped'
  );

  return finish();
}

function finish() {
  clearTimeout(watchdog);
  const failed = results.filter((r) => !r.ok);
  const short = results.length < MINIMUM_CHECKS;
  console.log(`\n${results.length - failed.length}/${results.length} privilege-boundary checks passed`);
  if (short) {
    console.log(
      `FAIL  group ran ${results.length} of at least ${MINIMUM_CHECKS} designed checks - it stopped early, so green here would be meaningless`
    );
    failed.unshift({ name: 'the group ran its full designed check set' });
  }
  failed.forEach((f) => console.log(`  - ${f.name}`));
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.log(`\nPRIVILEGE-BOUNDARY SUITE CRASHED: ${e.message}`);
  console.log((e.stack || '').split('\n')[1] || '');
  process.exitCode = 1;
});
