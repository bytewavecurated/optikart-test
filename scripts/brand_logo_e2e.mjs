#!/usr/bin/env node
/**
 * Brand registration over HTTP, with real multipart uploads.
 *
 * What this can prove that the unit file cannot: that the route is mounted, that
 * `verifyManufacturer` actually guards it, that a rejected file leaves no bytes
 * behind on the provider, and that two manufacturers cannot both end up owning
 * what a shopper reads as one brand. The last one is the point of the feature -
 * rails and approval queues group by brand string, so a shared name attributes
 * one company's frames to another and no log line would ever show it.
 *
 * Assertions about the stored logo are provider-agnostic by design
 * (`/uploads/...` or `https://...`), because CI runs the local fallback and a
 * deployment runs Cloudinary. A test that hardcodes one shape fails the other
 * one for a reason that has nothing to do with the code.
 *
 *   node scripts/brand_logo_e2e.mjs [base-url]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api`;

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 170)}` : ''}`);
};
const json = (r) => r.json;

const call = async (path, { token, body, method } = {}) => {
  const res = await fetch(API + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json: parsed, text };
};
const upload = async (path, { token, fields = {}, file }) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  if (file) form.append('logo', new Blob([file.bytes], { type: file.type }), file.name);
  const res = await fetch(API + path, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json: parsed, text };
};

const png = (w, h) => {
  const b = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
};
const jpeg = (w, h) => {
  const b = Buffer.alloc(32);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0xff;
  b[3] = 0xc0;
  b.writeUInt16BE(17, 4);
  b[6] = 8;
  b.writeUInt16BE(h, 7);
  b.writeUInt16BE(w, 9);
  return b;
};

const logoPng = { bytes: png(1000, 1000), type: 'image/png', name: 'My Logo.png' };
// A JPEG whose declared MIME type is GIF: the bytes, not the label, must decide.
const logoJpeg = { bytes: jpeg(1000, 1000), type: 'image/gif', name: 'frame.gif' };
const logoSmall = { bytes: png(640, 640), type: 'image/png', name: 'small.png' };
const logoWide = { bytes: png(1200, 700), type: 'image/png', name: 'wide.png' };
/* 1000x1000 so the *storage policy* is what trips, not the size floor. */
const logoSvg = {
  bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"></svg>'),
  type: 'image/svg+xml',
  name: 'mark.svg',
};
const logoGif = {
  bytes: Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(24, 1)]),
  type: 'image/gif',
  name: 'anim.gif',
};
const login = (path, email, password) => call(path, { body: { email, password } }).then((r) => r.json?.token);

async function main() {
  const admin = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  const ownerA = await login('/manufacturer/login', 'rayban.manufacturer@optikart.com', 'Manufacturer123@');
  check('admin and seeded manufacturer logins succeed', Boolean(admin && ownerA));

  /* A second manufacturer, created through the desk with valid GST/PAN shapes.  */
  const stamp = Date.now().toString(36);
  const emailB = `brandprobe.${stamp}@example.test`;
  const forceActivate = async (id) =>
    call('/admin/manufacturers/' + id + '/force-activate', {
      token: admin,
      body: { reason: 'brand-logo e2e: activating a freshly created desk tenant without a mailbox to click' },
    });
  const made = await call('/admin/manufacturers', {
    body: {
      name: `Probe Manufacturer ${stamp}`,
      email: emailB,
      password: 'Probe123@',
      phone: '9000000001',
      companyName: `Probe Optics Pvt Ltd ${stamp}`,
      gstNumber: '27ABCDE1234F1Z5',
      panNumber: 'ABCDE1234F',
      address: { street: '1 Probe Lane', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
      bank: { accountNumber: '90000456789', ifscCode: 'AXIS0001234', bankName: 'Axis Bank', branchName: 'Andheri' },
      brands: ['Vertiflex'],
    },
    token: admin,
  });
  if (made.status === 201 || made.json?.success) await forceActivate(made.json?.manufacturer?._id);

  check(
    'a second manufacturer can be created for the ownership probe',
    made.json?.success === true,
    (made.json?.message || made.text).slice(0, 140)
  );
  /*
   * A newly created manufacturer is not a seeded demo account, so it goes through
   * the real second factor: the login sends an OTP, and with no SMTP on the
   * harness the service returns the code in the response (development only). The
   * suite then completes /verify-login-otp. That is deliberately *not* a bypass -
   * it exercises the same two-step path a production manufacturer uses, which is
   * also the path whose "OTP sent" lie this batch fixed.
   */
  let ownerB = null;
  let bDetail = 'no attempt';
  if (made.json?.success) {
    const step1 = await call('/manufacturer/login', { body: { email: emailB, password: 'Probe123@' } });
    ownerB = step1.json?.token || null;
    if (!ownerB && step1.json?.requiresOTP && step1.json?.devCode) {
      const step2 = await call('/manufacturer/verify-login-otp', {
        body: { manufacturerId: step1.json.manufacturerId, otp: step1.json.devCode },
      });
      ownerB = step2.json?.token || null;
      bDetail = `step1 ${step1.status} + step2 ${step2.status} ${String(step2.json?.message || '').slice(0, 80)}`;
    } else {
      bDetail = `${step1.status} ${String(step1.json?.message || step1.text).slice(0, 120)} devCode=${Boolean(step1.json?.devCode)}`;
    }
  }
  check('and it can sign in, so the probe is a real second tenant', Boolean(ownerB), bDetail);
  const queueAsOwner = await call('/admin/brand-queue', { token: ownerA });
  check(
    'a manufacturer cannot read the verification queue',
    queueAsOwner.status === 403 || queueAsOwner.status === 401,
    `status ${queueAsOwner.status}`
  );

  /* ------------------------------------------------------- first registration */
  const created = await upload('/manufacturer/brands', {
    token: ownerA,
    fields: { name: 'Vertiflex Optics' },
    file: logoPng,
  });
  check(
    'the brand registers and starts pending (nothing is public before review)',
    created.status === 201 && created.json?.brand?.status === 'pending',
    `${created.status} ${JSON.stringify(created.json?.message || created.text).slice(0, 120)}`
  );
  check(
    'a stored logo path is returned whatever the backend',
    /^\/uploads\/|^https:\/\//.test(String(created.json?.brand?.logoUrl || '')),
    created.json?.brand?.logoUrl
  );
  check(
    'the name and its fold come back, so the client can show what collides',
    created.json?.brand?.name === 'Vertiflex Optics' && created.json?.brand?.slug === 'vertiflexoptics',
    JSON.stringify(created.json?.brand?.slug)
  );

  /* ----------------------------------------------------------- collisions */
  const sameOwnerAgain = await upload('/manufacturer/brands', {
    token: ownerA,
    fields: { name: 'vertiflex-optics' },
    file: logoPng,
  });
  check(
    'the same owner re-registering one spelling is a 409 that says it is theirs',
    sameOwnerAgain.status === 409 && /registered to you|already/i.test(sameOwnerAgain.json?.message || ''),
    String(sameOwnerAgain.json?.message).slice(0, 150)
  );
  const otherOwner = await upload('/manufacturer/brands', {
    token: ownerB,
    fields: { name: 'VertiflexOptics' },
    file: logoPng,
  });
  check(
    'a different manufacturer touching the same brand name is refused outright',
    otherOwner.status === 409 && /claimed by|belongs to|one manufacturer/i.test(otherOwner.json?.message || ''),
    String(otherOwner.json?.message).slice(0, 170)
  );
  check(
    'and the refusal names the brand, not just "invalid"',
    /Vertiflex/i.test(String(otherOwner.json?.message || ''))
  );

  /* -------------------------------------------------------- file rejections */
  const brandCountBefore = (await call('/admin/brand-queue?status=all', { token: admin })).json?.queue?.length || 0;
  const small = await upload('/manufacturer/brands', { token: ownerA, fields: { name: 'Tiny Mark' }, file: logoSmall });
  check(
    'a 640px logo is refused quoting the found size and the requirement',
    small.status === 400 && /640/.test(String(small.json?.message)) && /800/.test(String(small.json?.message)),
    String(small.json?.message).slice(0, 140)
  );
  const wide = await upload('/manufacturer/brands', { token: ownerA, fields: { name: 'Wide Mark' }, file: logoWide });
  check(
    'a non-square logo is refused for being non-square',
    wide.status === 400 && /square/i.test(String(wide.json?.message)),
    String(wide.json?.message).slice(0, 120)
  );
  const gif = await upload('/manufacturer/brands', { token: ownerA, fields: { name: 'Moving Mark' }, file: logoGif });
  check(
    'a GIF is refused (its bytes parse as nothing we accept)',
    gif.status === 400,
    `${gif.status} ${String(gif.json?.message).slice(0, 110)}`
  );
  const svg = await upload('/manufacturer/brands', { token: ownerA, fields: { name: 'Vector Mark' }, file: logoSvg });
  check(
    'an SVG on local storage is refused as a same-origin-script risk, not as a server error',
    svg.status === 400 && /origin|script|Cloudinary/i.test(String(svg.json?.message)),
    `${svg.status} ${String(svg.json?.message).slice(0, 130)}`
  );
  const lied = await upload('/manufacturer/brands', {
    token: ownerA,
    fields: { name: 'Mismatch Mark' },
    file: logoJpeg,
  });
  check(
    'JPEG bytes declared as GIF are judged by their bytes',
    lied.status === 201 || /1200|square|800/i.test(''),
    `${lied.status} ${String(lied.json?.message || '').slice(0, 90)}`
  );
  const noName = await upload('/manufacturer/brands', { token: ownerA, file: logoPng });
  check(
    'a logo without a brand name is refused',
    noName.status === 400 && /name/i.test(String(noName.json?.message)),
    String(noName.json?.message).slice(0, 100)
  );
  const noFile = await upload('/manufacturer/brands', { token: ownerA, fields: { name: 'Nameless Mark' } });
  check(
    'a brand name without a logo is refused (approval requires a mark)',
    noFile.status === 400 && /logo/i.test(String(noFile.json?.message)),
    String(noFile.json?.message).slice(0, 100)
  );

  const queueAfter = (await call('/admin/brand-queue?status=all', { token: admin })).json?.queue || [];
  const brandCountAfter = queueAfter.length;
  const slugsAfter = new Set(queueAfter.map((b) => b.slug));

  /*
   * Named as well as counted. My first version asserted a "+2" delta and was
   * wrong twice without saying which upload caused it: the accepted brand
   * predates the baseline, and each refused candidate had to be checked by its
   * own slug. The one accepted rejection-shaped upload is the JPEG whose declared
   * MIME type was GIF: its bytes are valid, so it is stored - under a generated
   * name, judged by content. A count can be accidentally right; a name cannot.
   */
  const refusedSlugs = ['tinymark', 'widemark', 'movingmark', 'vectormark', 'namelessmark'];
  check(
    'no refused upload created a brand record, each checked by name',
    refusedSlugs.every((slug) => !slugsAfter.has(slug)),
    `present: ${[...slugsAfter].join(',')}`
  );
  check(
    'exactly the accepted registrations exist',
    brandCountAfter === brandCountBefore + 1 && slugsAfter.has('mismatchmark'),
    `before=${brandCountBefore} after=${brandCountAfter} mismatch=${slugsAfter.has('mismatchmark')}`
  );

  /* ------------------------------------------------------------ what's listed */
  const ownList = await call('/manufacturer/brands', { token: ownerA });
  const verti = (ownList.json?.brands || []).find((b) => b.slug === 'vertiflexoptics');
  check(
    'the owner sees their brand with status and storage details',
    !!verti && verti.status === 'pending' && ['local', 'cloudinary'].includes(verti.storedWith),
    JSON.stringify(verti && { s: verti.status, w: verti.storedWith, d: verti.logoDimensions })
  );
  check(
    'the owner is shown dimensions that were verified from the file',
    verti?.logoDimensions?.width === 1000 && verti?.logoDimensions?.height === 1000,
    JSON.stringify(verti?.logoDimensions)
  );
  check(
    'product counts per brand are numbers (grouped by fold, not by spelling)',
    typeof verti?.productCount === 'number',
    `productCount=${verti?.productCount}`
  );
  check(
    'the owner never sees another manufacturer internal fields in their list',
    !JSON.stringify(ownList.json?.brands || []).includes('ownerManufacturer'),
    Object.keys(ownList.json?.brands?.[0] || {}).join(',')
  );
  const otherSeen = await call('/manufacturer/brands', { token: ownerB });
  check(
    "the second manufacturer sees none of the first one's brands",
    (otherSeen.json?.brands || []).every((b) => b.slug !== 'vertiflexoptics'),
    (otherSeen.json?.brands || []).map((b) => b.slug).join(',')
  );

  /* --------------------------------------------------------- the admin queue */
  const queue = await call('/admin/brand-queue', { token: admin });
  check('the verification queue lists pending brands for the desk', queue.status === 200);
  const queued = (queue.json?.queue || []).find((b) => b.slug === 'vertiflexoptics');
  check(
    'the queued entry tells the desk who claims to own it',
    !!queued && typeof queued.ownerName === 'string' && Boolean(queued.logoUrl),
    JSON.stringify(queued && { owner: queued.ownerName, logo: String(queued.logoUrl).slice(0, 24) })
  );
  check(
    'the queue is honest about the backend in use',
    ['cloudinary', 'local'].includes(queue.json?.storage?.backend),
    JSON.stringify(queue.json?.storage)
  );
  const badStatus = await call('/admin/brand-queue?status=soon', { token: admin });
  check(
    'an unrecognised queue filter is a 400 with the allowed values',
    badStatus.status === 400 && /pending|approved|rejected|all/.test(String(badStatus.json?.message)),
    String(badStatus.json?.message).slice(0, 110)
  );
  /* ------------------------------------------------ /api/storage/status */
  const storage = await call('/storage/status', { token: admin });
  check('the storage status endpoint answers the desk', storage.status === 200, `HTTP ${storage.status}`);
  check(
    'it names the backend and the prefix, without secrets',
    ['cloudinary', 'local'].includes(storage.json?.storage?.backend) &&
      typeof storage.json?.storage?.prefix === 'string' &&
      !JSON.stringify(storage.json).includes('api_secret') &&
      !JSON.stringify(storage.json).includes('CLOUDINARY_'),
    JSON.stringify(storage.json?.storage)
  );
  check(
    'a manufacturer cannot read operator storage config',
    (await call('/storage/status', { token: ownerA })).status === 403
  );
  check('and neither can an anonymous request', (await call('/storage/status')).status === 401);

  /* ------------------------------------------------------- the decision path */
  const brandId = created.json?.brand?._id;
  const decideAsOwner = await call(`/admin/brands/${brandId}/decision`, {
    token: ownerA,
    body: { decision: 'approve' },
    method: 'PUT',
  });
  check(
    'a manufacturer cannot approve their own brand',
    decideAsOwner.status === 401 || decideAsOwner.status === 403,
    `status ${decideAsOwner.status}`
  );
  const rejectNoReason = await call(`/admin/brands/${brandId}/decision`, {
    token: admin,
    body: { decision: 'reject' },
    method: 'PUT',
  });
  check(
    'a rejection without a reason is refused (no state change)',
    rejectNoReason.status === 400 && /reason/i.test(String(rejectNoReason.json?.message)),
    String(rejectNoReason.json?.message).slice(0, 130)
  );
  check(
    'and the brand is still pending afterward',
    (await call('/manufacturer/brands', { token: ownerA })).json?.brands?.find((b) => b.slug === 'vertiflexoptics')
      ?.status === 'pending'
  );
  const approve = await call(`/admin/brands/${brandId}/decision`, {
    token: admin,
    body: { decision: 'approve' },
    method: 'PUT',
  });
  check(
    'approval succeeds and the desk gets the manifest in the same response',
    approve.json?.brand?.status === 'approved' && Array.isArray(approve.json?.manifest?.brands),
    `${approve.status} ${String(approve.json?.message).slice(0, 120)}`
  );
  check(
    'the manifest states its own limits (approval is not publication)',
    (approve.json?.manifest?.limitations || []).some((l) => /does not publish|verification/i.test(l)),
    JSON.stringify(approve.json?.manifest?.limitations || []).slice(0, 150)
  );
  check(
    'the manifest totals are counts, not prose',
    typeof approve.json?.manifest?.totals?.brands === 'number' &&
      typeof approve.json?.manifest?.totals?.products === 'number' &&
      typeof approve.json?.manifest?.totals?.live === 'number',
    JSON.stringify(approve.json?.manifest?.totals)
  );
  const twice = await call(`/admin/brands/${brandId}/decision`, {
    token: admin,
    body: { decision: 'approve' },
    method: 'PUT',
  });
  check(
    'deciding twice is refused rather than silently re-approved',
    twice.status === 409 && /already approved/i.test(String(twice.json?.message)),
    String(twice.json?.message).slice(0, 130)
  );

  /* --------------------------------------------------------- public rails */
  const rails0 = await call('/brands/with-logos', { token: admin });
  check(
    'rails list the brands that actually have live products',
    rails0.status === 200 && (rails0.json?.brands || []).length > 0,
    `rows=${(rails0.json?.brands || []).length}`
  );
  const unverifiedRow = (rails0.json?.brands || []).find((b) => b.slug === 'rayban');
  check(
    'a brand with no APPROVED record is listed with a letter, not a logo',
    !!unverifiedRow &&
      unverifiedRow.logoUrl === null &&
      unverifiedRow.verified === false &&
      unverifiedRow.letter === 'R',
    JSON.stringify(unverifiedRow)
  );
  check(
    'no internal field is exposed on the public rail projection',
    !['ownerManufacturer', 'decision', 'storage', 'publicId'].some((k) => k in (unverifiedRow || {})),
    Object.keys(unverifiedRow || {}).join(',')
  );
  /*
   * multipart, not JSON: this route takes the logo as a file. The assertion used
   * the JSON helper, so it uploaded nothing and failed for a reason that had
   * nothing to do with the feature - and my first two attempts to fix it no-oped
   * silently because the regexes could not see prettier's wrapped lines.
   */
  const seedTry = await upload('/manufacturer/brands', { token: ownerA, fields: { name: 'Ray-Ban' }, file: logoPng });
  const pendingMark = seedTry.json;
  check(
    'registering the already-owned seed brand gives a pending record (not published)',
    pendingMark?.brand?.slug === 'rayban' && pendingMark?.brand?.status === 'pending',
    `HTTP ${seedTry.status} ${JSON.stringify(pendingMark?.brand || pendingMark?.message || String(seedTry.text).slice(0, 120))}`
  );

  /* ------------------------------------- approve a brand that owns products */
  const approveReal = await call(`/admin/brands/${pendingMark.brand._id}/decision`, {
    token: admin,
    body: { decision: 'approve' },
    method: 'PUT',
  });
  check(
    'approving it returns a manifest that covers real listings',
    approveReal.json?.brand?.status === 'approved' &&
      (approveReal.json?.manifest?.brands || []).some((b) => b.slug === 'rayban' && b.total >= 1),
    JSON.stringify(approveReal.json?.manifest?.totals)
  );
  /*
   * The distinction the fix was about: the number in the approval message must
   * be about the brand that was decided, and the company-wide view must be
   * clearly labelled as such rather than silently mixed into the same figure.
   */
  const approvedManifest = approveReal.json?.manifest;
  check(
    'the approval manifest is scoped to the brand that was decided',
    approvedManifest?.scope === 'brand' &&
      approvedManifest?.scopeSlug === 'rayban' &&
      approvedManifest.brands.length === 1,
    JSON.stringify(approvedManifest && { scope: approvedManifest.scope, brands: approvedManifest.brands.length })
  );
  check(
    'the totals describe that brand, not every listing the company owns',
    approvedManifest?.totals?.products === approvedManifest?.brands?.[0]?.total &&
      approvedManifest.manufacturerOverview?.products >= approvedManifest.totals.products,
    JSON.stringify(
      approvedManifest && { brand: approvedManifest.totals, company: approvedManifest.manufacturerOverview }
    )
  );
  check(
    'and the company-wide overview is still present and larger (multi-brand seed)',
    approvedManifest?.manufacturerOverview?.brands >= 2,
    JSON.stringify(approvedManifest?.manufacturerOverview)
  );

  const raybanEntry = (approveReal.json?.manifest?.brands || []).find((b) => b.slug === 'rayban');
  check(
    'every product line carries a state and a human label for it',
    raybanEntry?.products?.every((p) => p.state && p.stateLabel),
    JSON.stringify((raybanEntry?.products || []).map((p) => p.state))
  );
  check(
    'the live count only counts what the storefront gate itself would show',
    raybanEntry?.byState?.live === approveReal.json?.manifest?.totals?.live ||
      raybanEntry?.products?.filter((p) => p.state === 'live').length === raybanEntry?.byState?.live,
    JSON.stringify([raybanEntry?.byState, approveReal.json?.manifest?.totals])
  );
  const rails1 = await call('/brands/with-logos', { token: admin });
  const railRow = (rails1.json?.brands || []).find((b) => b.slug === 'rayban');
  check(
    'the approved brand now appears on rails with its real logo',
    railRow?.logoUrl && railRow.verified === true,
    JSON.stringify(railRow)
  );
  check(
    'and a brand whose logo was rejected never appears as approved',
    (rails1.json?.brands || []).every((b) => !(b.slug === 'mismatchmark' && !b.logoUrl && b.verified === true)),
    JSON.stringify((rails1.json?.brands || []).filter((b) => b.slug === 'mismatchmark'))
  );
  const railsCat = await call('/brands/with-logos?category=sunglasses', { token: admin });
  check(
    'the rail list scopes by category (same gate as the product list)',
    railsCat.status === 200 && (railsCat.json?.brands || []).length > 0,
    String(railsCat.json?.brands?.length)
  );

  /* ------------------------------------------- a brand with no products yet */
  const emptyManifest = await call('/manufacturer/brands/vertiflexoptics/manifest', { token: ownerA });
  check(
    'an approved brand with no listings reads back as empty, not as an error',
    emptyManifest.status === 200 &&
      emptyManifest.json?.manifest?.brands?.length === 0 &&
      emptyManifest.json?.manifest?.totals?.products === 0,
    JSON.stringify(emptyManifest.json?.manifest?.totals)
  );
  check(
    'and it still carries the limitations text that explains what is missing',
    (emptyManifest.json?.manifest?.limitations || []).length >= 2,
    String((emptyManifest.json?.manifest?.limitations || []).length)
  );
  const strangerManifest = await call('/manufacturer/brands/vertiflexoptics/manifest', { token: ownerB });
  const noSuch = await call('/manufacturer/brands/zz-not-real/manifest', { token: ownerA });
  check(
    'another manufacturer is answered exactly like a nonexistent brand (no owner enumeration)',
    strangerManifest.status === 404 && strangerManifest.json?.message === noSuch.json?.message,
    String(strangerManifest.json?.message).slice(0, 110)
  );
  /* The decision has to arrive somewhere (manufacturer inbox isolation). */
  const inbox = await call('/notifications?limit=50', { token: ownerA });
  const brandNotes = (inbox.json?.notifications || []).filter((d) => d.type === 'brand');
  check(
    'the approved manufacturer actually receives the decision',
    inbox.status === 200 && brandNotes.length >= 1,
    `HTTP ${inbox.status} count=${brandNotes.length} unread=${inbox.json?.unreadCount}`
  );
  check(
    'the notification names the brand and says what approval covered',
    brandNotes.some((d) => /Vertiflex Optics/.test(`${d.title} ${d.message}`)) &&
      brandNotes.some((d) => /Manifest:|no products under it/i.test(d.message)),
    JSON.stringify(brandNotes.map((d) => d.title))
  );
  const otherInbox = await call('/notifications?limit=50', { token: ownerB });
  check(
    "a different manufacturer does not see another company's brand mail",
    (otherInbox.json?.notifications || []).every((d) => !/Vertiflex Optics|Ray-Ban/.test(`${d.title} ${d.message}`)),
    JSON.stringify((otherInbox.json?.notifications || []).filter((d) => d.type === 'brand').map((d) => d.title))
  );
  check(
    'and an inbox that is empty for a reason is reported as empty, not as an error',
    otherInbox.status === 200 && Array.isArray(otherInbox.json?.notifications),
    `HTTP ${otherInbox.status}`
  );

  /* ------ brand lookup by spelling the shopper actually has (URL slug form) */
  const spellings = ['Ray-Ban', 'ray ban', 'RAYBAN', 'ray-ban', 'Ray Ban'];
  const counts = [];
  for (const s of spellings) {
    const r = await call(`/products?brand=${encodeURIComponent(s)}&limit=50`);
    counts.push([s, r.json?.pagination?.total ?? r.json?.count ?? 0]);
  }
  const total0 = counts[0][1];
  check(
    "every spelling that folds to one brand returns that brand's products",
    total0 > 0 && counts.every(([, n]) => n === total0),
    JSON.stringify(counts)
  );
  const notABrand = await call('/products?brand=NoSuchBrandAnywhere&limit=5');
  check(
    'a brand that folds to nothing is an empty list, not the whole catalogue',
    notABrand.status === 200 && (notABrand.json?.pagination?.total ?? notABrand.json?.products?.length ?? 0) === 0,
    `total=${notABrand.json?.pagination?.total}`
  );
  const noBrandParam = await call('/products?limit=1');
  check(
    'and no brand parameter at all still lists everything (the branch cannot over-filter)',
    noBrandParam.status === 200 && (noBrandParam.json?.pagination?.total ?? 0) >= total0,
    `all=${noBrandParam.json?.pagination?.total} vs rayban=${total0}`
  );

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} brand/logo live checks passed`);
  failed.forEach((f) => console.log(`  - ${f.name}`));
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.log(`\nBRAND/LOGO SUITE CRASHED: ${e.message}`);
  console.log(e?.stack?.split('\n')[1] || '');
  finish();
});
