# OptikArt — System

One file for the whole box: what the stack is, how money and identity move
through it, the live route map with the middleware each door actually runs,
every configuration flag, the demo credentials that exist **because they are
public**, deployment for containers and processes, what is knowingly left
undone, and what to build next in priority order.

This file replaces README/ARCHITECTURE/OPERATIONS/RECOMMENDATIONS/LOGINS/
PRODUCT_UPLOAD_SPEC (2025-11 consolidation). The route table is GENERATED —
`node scripts/generate-route-map.mjs` reads the mounted Express routers at
runtime; drift is a failing check (`--check`), not a stale paragraph.

---

## What it is

A multi-vendor eyewear marketplace: manufacturers publish catalogue, shops
(`Seller`) stock listed configurations at their own price, delivery partners
complete last-mile runs, staff/executive desks operate queues, the platform
takes commission (never a subscription). Sunglasses, eyeglasses, powered
eyewear, contact lenses (distance/toric/multifocal/colour/solutions/
accessories), per-listing returns windows, coupons, price-change approvals,
and real-time seller alerts over Socket.IO.

React 18 (CRA + react-app-rewired) · Express 4 (ESM, Node 22) · MongoDB +
Mongoose 7 · Socket.IO · Razorpay (customer capture + a second account for
partner payouts + RazorpayX settlements) · Shiprocket couriers · Nodemailer ·
Cloudinary (or refused local fallback) · OpenAI/Rekognition optional AI.

## Layout

```
server/     API: models, routes, services, middleware, fixtures (data-as-code)
client/     SPA: pages/ (45+), components/, contexts/, services/
scripts/    the verification harness: e2e suites, unit groups, audits
```

`server/server.js` mounts every router under `/api` and—when `client/build`
exists—serves the SPA from the same origin (requested per file, so a rebuild
needs no restart; a stale tracked `server/build/` is NOT the live bundle).

## Request path and middleware (what actually runs)

Order matters and is load-bearing:

1. `config/loadEnv.js` — imported before anything that reads `process.env`
   (ESM depth-first import order; a real historical bug, see file header).
2. CORS: explicit origin allow-list from `FRONTEND_URL`; never wildcard+credentials (security gate asserts).
3. `express.json/urlencoded` capped by `JSON_BODY_LIMIT` (default 1mb — uploads are multipart, capped separately per-file in `middleware/upload.js` 5MB).
4. `middleware/requestContext.js` — request id (echoed as `X-Request-Id`,
   links responses to log lines), per-route metrics (readable at
   `GET /api/admin/system/metrics`, surfaced on the admin dashboard), slow-call
   trail.
5. `middleware/errorSurface.js` — security headers (`nosniff`, `X-Frame-Options: DENY`, Referrer/Permissions-Policy, HSTS when production — the client container duplicates them at the edge: `client/nginx.conf` says they must stay in lockstep), last-error surfacing, and the deliberate omission of CSP (see Deferred).
6. `trust proxy` = numeric `TRUST_PROXY_HOPS` — never `true` (rate limiters
   key on client IP; permissive trust lets clients forge it).
7. `sessionGuard` on `/api/*` — revocation checks + console-role idle
   sign-out (`SESSION_IDLE_MINUTES`; customer sessions unaffected; the window
   is printed at boot because a mistyped value otherwise looks like
   "unstable console").
8. Per-route chains: `verifyToken | verifySeller | verifyAdmin |
verifyAnyPrincipal | verifyExecutive | verifyManufacturer |
verifyManufacturerSeller | verifyDeliveryPartner`, `validate.js`
   express-validator chains, `multer` per-purpose uploaders (memoryStorage on
   purpose — disk temping happened before the storage service decided, leaving
   refused files behind).
9. `routes/*` — thin HTTP adapters; invariants live in `services/*`.
10. Catch-all: SPA index (or the honest "Frontend not built" page), API
    unknowns = 404 JSON.
11. Socket.IO: `middleware/socketAuth.js` authenticates the handshake token
    with the same contract as HTTP (signature/expiry/revocation/liveness — the
    same three checks the HTTP guards enforce), joins rooms from verified
    identity only; `order_<id>` joins check participation in the Order
    document; client-emitted join/leave cannot widen membership. Browsers
    speaking websockets bypass CORS: this is the reason the gate is the socket
    layer and not the origin list.

The tables below carry the honest cost of these rules: every guard is on the
route line it actually protects, generated from the running stack — not from
someone's list of what should be there.

## Data model, in one pass

| Model                                       | Role                                        | The rule it carries                                                                                                                                                                             |
| ------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User                                        | customer; admins/staff are Users with roles | sessions revocable (jti hash list), `prescriptions[].isDefault` = active Rx, login OTPs stored-and-expiring, account lock 3/3min                                                                |
| Seller                                      | a shop                                      | KYC-complete record; own-variant stock in SellerStock; withdrawal/ledger not here (that's SellerPayout)                                                                                         |
| Manufacturer                                | brand owner                                 | onboarding state machine (pending_verification → pending_otp/update_requested → active); one brand, one owner (fold rule)                                                                       |
| ManufacturerSeller                          | brand retail console                        | separate principal; notifications address `retailer`                                                                                                                                            |
| DeliveryPartner                             | last-mile                                   | ledger: `totalEarnings/totalWithdrawn/withdrawals[]`, ₹10/km of leg, 1 cash withdrawal/day, COD collected at door reconciles to their cash                                                      |
| Product                                     | catalogue + variants                        | verification per product (pending→verified→data_incorrect); `seller` null for pure directory entries; poweredOptionsAvailable declares, listing decides; stock only moves through stockMovement |
| SellerStock                                 | who sells what                              | the marketplace's second truth: per-shop price, per-variant stock, `sellsWithPower` + `powerLensTypes`, listing approval state gates `isListed`; totalStock derived on save                     |
| Cart                                        | draft order                                 | server-truth cart for logged users                                                                                                                                                              |
| Order                                       | money + fulfilment                          | split one per seller at placement; COD completes on delivery; partnerQueue per leg; returns/exchanges restore EXACT variant                                                                     |
| OrderRouting                                | dispatch state                              | distance-capped (4.5km pickup, 23km leg), admin_required fallthrough is a QUEUE, not a black hole                                                                                               |
| Prescription                                | customer Rx                                 | typed powers + uploaded file; verified via staff queue                                                                                                                                          |
| PrescriptionVerification etc                | staff audit                                 | who checked what when                                                                                                                                                                           |
| Brand                                       | brand registry                              | fold `slug`, url `urlSlug`, logo from approved manufacturer manifests                                                                                                                           |
| Coupon/SaleEvent                            | pricing                                     | server-re-verified at order (never trusts client math)                                                                                                                                          |
| ReturnRequest                               | self-service returns                        | per-product windows and flags                                                                                                                                                                   |
| Notification (user/seller/retailer/partner) | inbox                                       | one field per account type — `recipientScopeFor(principal)` reads exactly one                                                                                                                   |
| PushSubscription / web-push                 | browser push                                | VAPID pair env-gated; fan-out on out-of-stock back in                                                                                                                                           |
| WishlistAlert                               | back-in-stock                               | wishlist price-drop + restock notices                                                                                                                                                           |
| RevokedSession                              | logout                                      | hashed jti, TTL-indexed expiry                                                                                                                                                                  |
| SiteContent/Banner/Blog/HelpArticle         | CMS                                         | admin-edited surfaces                                                                                                                                                                           |

The money path in one line: order captured/completed → COD flips delivered →
`settleDeliveredOrder()` books commission on merchandise subtotal only,
fulfilment cost to the seller's side, platform revenue = commission + fees +
customer delivery charge; partner pay = ₹10/km leg, ₹3/platform per started
₹50 of withdrawal; payouts report a REAL gateway id or stay honestly pending —
`transferFunds()` has no mock path anymore because a fabricated `tr_mock_*`
receipt was marking payouts complete against money that never moved.

## Upgrading an existing database (the login-500 trap, now closed)

Accounts created by a build older than `services/entityIds.js` carry codes from
the old base36 generator (letters like S that the deliberate no-lookalike
alphabet cannot issue). Shape validation on every write used to refuse those
stored values, so such an account could not even complete its own login (login
stamps lastLoginAt, the save re-validates). The write path now SELF-HEALS: the
first ordinary save re-mints a valid code once, logs the old→new transition, and
every later write is stable; `node server/scripts/backfill_entity_ids.mjs` does
the same sweep in one operator pass (reporting `filled` and `repaired`), and the
harness pins both behaviours as wire + unit assertions. Valid codes, once
assigned, are never rewritten - by either path.

## Configuration surface (every flag, what it does at runtime)

Everything reads `server/.env` (or the environment; `ENV_FILE` overrides the
path). Mandatory in production: `MONGODB_URI`, 32+-char non-placeholder
`JWT_SECRET`, working `SMTP_*` (the login second factor is mailed; without
mailboxes NOBODY can sign in again — including you). The boot refuses loudly;
that gate exists because quietly-unreachable accounts are the worst failure
this codebase has seen.

| Flag                                                                | Effect                                                                                                                                                                                             | Default        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| NODE_ENV                                                            | production arms every boot check below                                                                                                                                                             | development    |
| PORT                                                                | API bind                                                                                                                                                                                           | 5000           |
| MONGODB_URI / Mongo service                                         | data plane                                                                                                                                                                                         | —              |
| JWT_SECRET                                                          | session signing; boot-refused weak/short in production                                                                                                                                             | —              |
| FRONTEND_URL                                                        | CORS origin + mail link base + exact browser origin                                                                                                                                                | localhost:3000 |
| TRUST_PROXY_HOPS                                                    | numeric proxy depth (never true)                                                                                                                                                                   | prod:1         |
| AUTH_OTP_BYPASS                                                     | seeded-public-password logins skip the mailed OTP (non-prod only)                                                                                                                                  | true(dev)      |
| SESSION_IDLE_MINUTES                                                | console-role idle sign-out                                                                                                                                                                         | 60             |
| STORAGE_BACKEND                                                     | auto/cloudinary/local; local refused in production without next line + is warned when auto-fell-back                                                                                               | auto           |
| ALLOW_LOCAL_STORED_UPLOADS                                          | the acknowledge-to-use-disk flag (volume-backed installs)                                                                                                                                          | false          |
| JSON_BODY_LIMIT                                                     | parser ceiling for documents (uploads are separate)                                                                                                                                                | 1mb            |
| DNS_OVERRIDE                                                        | comma-list resolvers to FORCE; unset means the container's own resolv chain                                                                                                                        | unset          |
| SEED_ON_BOOT / ALLOW_DEMO_SEED                                      | inert interlocks — nothing seeds at boot in any environment; a production start with SEED_ON_BOOT=true and no ALLOW_DEMO_SEED refuses (stale runbook caught at boot, not by an empty screen later) | auto / false   |
| BOOTSTRAP_ADMIN_EMAIL/_PASSWORD/_NAME                               | the only account the installer creates (12+ char strong, idempotent, never logged; unset after first sign-in)                                                                                      | empty          |
| SMTP_{HOST,PORT,USER,PASS,SECURE}                                   | mail; ADMIN_EMAIL the operational sender fallback                                                                                                                                                  | —              |
| RAZORPAY_KEY_{ID,SECRET} / RAZORPAY2_* / RAZORPAYX_*                | customer capture / partner payouts / seller settlements — clients built lazily; unconfigured paths report NOT_CONFIGURED rather than booting half-blind                                            | —              |
| SHIPROCKET_*                                                        | courier; failure to reach the API is a routing outcome the desk sees, not a silent fallback                                                                                                        | —              |
| CLOUDINARY_{URL or CLOUD_NAME+API_KEY+API_SECRET, FOLDER}           | the storage service's single door                                                                                                                                                                  | —              |
| OPENAI_API_KEY / models / CHATBOT_*                                 | chatbot + prescription sanity; rule fallback when unconfigured                                                                                                                                     | —              |
| AWS__, GOOGLE_VISION_API_KEY, AZURE_FACE__, FACE_DETECTION_SERVICE  | face analysis alternatives (guidance still works unconfigured)                                                                                                                                     | —              |
| GOOGLE_SPEECH_API_KEY / AWS_TRANSCRIBE / SPEECH_RECOGNITION_SERVICE | voice search                                                                                                                                                                                       | —              |
| VAPID_*                                                             | browser push (generate: `npx web-push generate-vapid-keys`)                                                                                                                                        | —              |
| SENTRY_DSN, GOOGLE_ANALYTICS_ID                                     | optional observability                                                                                                                                                                             | —              |
| PARTNER_RANK_* / MAX_DELIVERY_LEG_KM / PARTNER_PICKUP_RADIUS_KM     | dispatch economics + weekly-rank window; unset/invalid values fall back to documented numbers, never to zero (zero radius = "ask nobody, ever")                                                    | see constants  |
| AI_ORDER_ASSIGNMENT                                                 | unanswered-offer fallback scoring                                                                                                                                                                  | off            |
| DEBUG_QUERIES / DANGEROUS_CONFIRM / REMOVE_DEMO_CATALOGUE           | operator switches; the last two gate destructive commands behind explicit yes                                                                                                                      | off            |

## Demo fixtures, staging and production

Nothing seeds at boot — the demo dataset deleted the eleven collections it
owns as its first act, and "database looks empty" (the old auto-trigger)
described a wrong `MONGODB_URI` just as well as a fresh install. Data creation:

| Entry                                                                      | What it is for                                                                                                                                            |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cd server && npm run fixtures:apply -- --expect-database=YOUR_SCRATCH_DB` | demo data into a THROWAWAY database; refuses non-empty collections, wrong db name even with --force.                                                      |
| `deprovision:demo` (`DANGEROUS_CONFIRM=yes [REMOVE_DEMO_CATALOGUE=yes]`)   | logins only by demo email; WITH the second flag also the full demo-content surface by collection (products, brands, stock, coupons, help articles, blogs) |
| `BOOTSTRAP_ADMIN_*`                                                        | the only production account path.                                                                                                                         |

After provisioning, real entities arrive through the app's own doors — the
screens are the structural contract.

## Deploying

### Containers (recommended)

```bash
cp server/.env.example .env      # JWT_SECRET, SMTP_*, FRONTEND_URL, CLOUDINARY_* …
docker compose up -d --build
docker compose ps                # api healthchecks /api/health: green == serving
```

- `client/Dockerfile` builds the CRA bundle (`REACT_APP_*` inlines at build
  time; leave unset for same-origin) and serves it via nginx, which
  reverse-proxies `/api`, `/uploads` and `/socket.io` (upgrade headers —
  without them seller alerts silently die; and the errorSurface headers —
  the document's protection must be set where the document is served).
  `client_max_body_size` sits ABOVE the app's own caps and never below.
- `server/Dockerfile` is non-root; `server/.env` never enters the image
  (`server/.dockerignore`).
- compose: mongo never published (one exposure of 27017 is an
  incident-report headline); JWT_SECRET missing fails the plan; env_file
  carries everything else; TRUST_PROXY_HOPS=1 for the client hop (+1 per
  TLS-terminating proxy IN FRONT of the client container).
- The only coupling is the nginx `upstream ... api:5000` line, which must equal the compose service key (`api`).
- TLS at the host edge (or add certificates here and let `Strict-Transport-
Security` come from the HTTPS listener; the client container serves plain
  HTTP behind it and the compose header explains why the API's :5000 should
  stay off the public interface).
- Backups: `scripts/backup-mongo.sh` (host cron) — atomic archive, dry-run
  restore verification, off-host sync optional, retention self-scoped.
  A volume is persistence; a backup is a copy that survives the volume.

### Single-origin process

Covered in depth in the OPERATIONS heritage below.

## Running the harness

```bash
node scripts/verify.mjs                    # isolated DB via server/.mongo.mjs (tracked;
                                           #  that file used to live ONLY on one laptop)
MONGODB_URI=mongodb://... node scripts/verify.mjs   # or a real mongod
```

42 groups: e2e suites over the running API + static audits + unit groups, and
`--check`-style self-pinning: no group can vanish from the list
(vacuous/orphan gate counts registrations against files), assertions that
cannot fail are themselves a failure, and controls that only announce success
(fire-and-forget buttons, mock money, delivered-with-no-mail statements) get
scanned out of the client by name. `generate-route-map.mjs --check` fails the
table in this file the moment the server and the docs disagree.

CI runs exactly `node scripts/verify.mjs` plus a client build, a dependency
audit floor (`--audit-level=high --omit=dev`) and the `containers` job that
builds the real images and walks nginx→API→health→socket on a throwaway
mongo — the story the Dockerfiles can't tell themselves until a deploy host
reads them as commands.

## Demo logins (public by design — throwaway databases only)

| Account                  | Email                            | Password         |
| ------------------------ | -------------------------------- | ---------------- |
| Customer                 | demo@optikart.com                | Demo123@         |
| Customer2                | testuser@optikart.com            | Test123@         |
| Shop                     | opticalworld@gmail.com           | Seller123@       |
| Vision Care Hub          | visioncare@gmail.com             | Seller123@       |
| Lens Studio              | lensstudio@gmail.com             | Seller123@       |
| Eye Fashion              | eyefashion@gmail.com             | Seller123@       |
| Admin                    | samedayopticians@gmail.com       | Sameday123@      |
| Staff (verifier)         | meera.staff@optikart.com         | Staff123@        |
| Executive                | rahul.deshpande@optikart.com     | Executive123@    |
| Manufacturer             | rayban.manufacturer@optikart.com | Manufacturer123@ |
| Mfg retail console       | rayban.retail@optikart.com       | Lensstore123@    |
| Delivery partner         | suresh.partner@optikart.com      | Partner123@      |
| Anjali partner (Gujarat) | anjali.partner@optikart.com      | Partner123@      |
| Settlement partner       | settlements.partner@optikart.com | Partner123@      |

These are the OTP-bypass allowlist (non-production only — see each role's
`isTestCredential` list); new accounts created through the desk are real:
they mail an OTP (or 503-honestly say no SMTP).

## Product upload surface (the spec condensed)

Two doors, one requirements module (`services/productRequirements.js`), and a
guidance endpoint (`GET /api/manufacturer/upload-spec`) that reads the same
module: the bulk sheet, the single-product form, and the manufacturer's
dashboard checklist cannot drift. Rules worth knowing: category is one value
per file; per-category attribute enums are validated from the model
(`genders`, frame shape/type/material — the bulk reader does NOT skip async
model hooks anymore, a defect that made `validateSync` under-check the very
rules the loop believed it enforced); per-listing `sell with price`
declaration and the 7-working-day emailed price-change approval sit on
SellerStock, not Product.

## What this system deliberately does NOT do (and what it now DOES)

This section changed status in the `58476c41`-..HEAD era and is rewritten to
say which, because 'open gap' prose that survives the fix becomes folklore:

1. Content-Security-Policy — **shipped with the measured rollout**: the
   policy is the exact set the production bundle proved it needs (asserted
   per-directive so a future edit cannot quietly un-break payments, fonts,
   inline styles or the socket), `CSP_MODE` chooses `enforce` (production
   default when unset — the gap was the ABSENT policy, not an unset flag),
   `report` (same policy, Report-Only, for staging the next change) or `off`.
   Violations posted by browsers land in a bounded per-directive ring on
   `GET /api/admin/system/metrics` — that ring is what turns the next policy
   edit from guesswork back into measurement. Pinned by
   `server/scripts/csp_mode_e2e.mjs` (14 checks).
2. aws-sdk v2 end-of-support — **gone**: no v2 dependency in the graph
   anymore, so no advisory and no boot-time end-of-support notice. Face
   detection runs on the lazy v3 client (no module load, no warning, and no
   construction-time credential check on unconfigured boxes); the v3 wire
   contract with the documented response shape, casing and real response
   bodies classified differently, is pinned by
   `scripts/face_shape_aws_mock_e2e.mjs`. **Honest residual**: the AWS
   SPEECH branch is an explicit refusal (the v2 path was a phantom that
   never returned the shape it read), and a refusal tested as behaviour is
   the fixable kind of wrong — the websocket integration, when the product
   wants it, replaces one sentence; Google/Azure work today.
3. Silent-simulation laundering — **closed**: a provider that IS configured
   and then fails now surfaces as a refusal with the reason, never a
   simulated answer wearing the label of a detection (the face path; pinned).
4. react-router advisory — unchanged by deliberate choice (declarative routes,
   static `to` targets only; the data-router path the advisory lives in is
   not reached at all by app code — re-check that sentence when someone
   adds `to={userInput}`).
5. Redis limiter store — **flag shipped with its two halves**: unset = the
   documented in-process behaviour, unchanged, limiter still tested; set =
   one external store for every limiter, and an UNREACHABLE or UNINSTALLED
   Redis causes the process to refuse to boot with the reason, rather than
   keep serving '200/15min' limits that are secretly 200/15min PER POD. What
   the suite does not claim: that it re-implemented protocol-level Redis
   semantics — the library's counting correctness is its own test surface;
   ours is the construction and the refusal (pinned by
   `server/scripts/redis_limiter_store_e2e.mjs`, with the reason for that
   scope written at the top of the suite).
6. Metrics durability — **improved to the honest size**: the rolling recent-
   errors window (last ~60, newest-first, bounded) and the CSP ring join the
   metrics panel; every read says, in its own words, that a deploy resets
   them. The durable answer remains metrics EXPORT, which is now the named
   'should' below, not a counter that quietly pretends to be durable.
7. Bulk dedupe (same row twice, two inserts), search spelling — still open,
   unchanged (not this session's asks, not silently 'fixed').

## Next, in priority order (and why)

**Must (production)**: rotate any credential that touched this repository's history (the
pre-rule `.env` commit; repo is public) and decide the history-purge question
deliberately — TLS at the edge + HSTS from the HTTPS listener,
`OPS_BACKUP_DIR` cron + off-host sync + a restore drill, the CSP observation
cycle (gap #1), Sentry or equivalent for cross-restart errors.

**Should**: Redis store behind the flag above (day one of scale-out);
`npm audit` floor already in CI — extend with automated Dockerfile/Helm
parity once a real orchestrator is chosen; e2e group per remaining page
family on the browser tooling the sweep used this session (the suite walks
the real login, cart, checkout, seller-desk journeys); deprovision-demo
scheduled on staging mirrors; OpenAPI export from the running router stack
the route-map script already holds (machine-readable contract for mobile).

**Can (product, Lenskart-shaped, in that order — every item uses data this
platform already stores, which is the selection rule)**: face-shape
restricted recommendations (`flatters` per frame → browse filter
"recommended for your face"); checkout power-accuracy backstop (implausible
pairs, repeated axes, big jumps from last order — ask, don't block);
contact-lens reorder reminders (`replacementPeriod × lensesPerBox` derived
exhaustion date, one-tap reorder N-5); `parentCheckout` unified tracking for
split orders; delivery promise at placement (distance + seller dispatch
history, shown BEFORE payment); store pickup (sellers have coordinates and
stock; removes the delivery leg entirely); active-prescription prefill —
shipped this round; back-in-stock + wishlist alerts surfacing in PDP rails,
order-review flow polish, PDP breadcrumb/SEO — shipped; invoice PDF for
sellers; seller return analytics; review moderation queue UI (data exists in
`staff.js` dashboard keys); corporate accounts program (the page exists, the
flow doesn't).

## Route map

The following is verbatim output of `node scripts/generate-route-map.mjs`
(45 mounts; every router's live stack with its middleware chain; direct app
routes last). It is current as of this commit — regenerate with the command
and re-paste, or wire the CI check.

<!-- generated by scripts/generate-route-map.mjs - do not hand-edit this table; regenerate. -->
<!-- generated mounts: 45; direct app routes: 5 -->

<!-- generated by scripts/generate-route-map.mjs - do not hand-edit this table; regenerate. -->
<!-- generated mounts: 45; direct app routes: 5 -->

### `/api/auth` — server/routes/auth.js

| `POST /api/auth/register` | <anonymous>, middleware, handleValidationErrors |
| `POST /api/auth/login` | <anonymous>, middleware, handleValidationErrors |
| `POST /api/auth/send-otp` | <anonymous> |
| `POST /api/auth/verify-otp` | <anonymous> |
| `POST /api/auth/verify-login-otp` | <anonymous> |
| `POST /api/auth/logout` | verifyToken |
| `GET /api/auth/session-policy` | verifyAnyPrincipal |
| `GET /api/auth/me` | verifyToken |
| `PUT /api/auth/update-profile` | verifyToken |
| `POST /api/auth/forgot-password` | <anonymous> |
| `POST /api/auth/reset-password` | <anonymous> |
| `GET /api/auth/prescriptions` | verifyToken |
| `POST /api/auth/prescription-upload` | verifyToken, multerMiddleware |
| `PUT /api/auth/prescriptions/:id/default` | verifyToken |
| `POST /api/auth/prescriptions` | verifyToken |
| `PUT /api/auth/prescriptions/:prescriptionId` | verifyToken |
| `DELETE /api/auth/prescriptions/:prescriptionId` | verifyToken |
| `GET /api/auth/addresses` | verifyToken |
| `POST /api/auth/addresses` | verifyToken |
| `PUT /api/auth/addresses/:addressId` | verifyToken |
| `DELETE /api/auth/addresses/:addressId` | verifyToken |

### `/api/admin/auth` — server/routes/adminAuth.js

| `POST /api/admin/auth/logout` | verifyToken |
| `POST /api/admin/auth/login` | <anonymous> |
| `POST /api/admin/auth/verify-otp` | <anonymous> |

### `/api/seller` — server/routes/seller.js

| `POST /api/seller/register` | <anonymous>, middleware, handleValidationErrors |
| `POST /api/seller/verify-phone` | public |
| `POST /api/seller/login` | <anonymous>, middleware, handleValidationErrors |
| `POST /api/seller/verify-login-otp` | <anonymous> |
| `POST /api/seller/logout` | verifySeller |
| `GET /api/seller/me` | verifySeller |
| `PUT /api/seller/update-profile` | verifySeller |
| `GET /api/seller/orders` | verifySeller |
| `PUT /api/seller/orders/:id/status` | verifySeller |
| `PUT /api/seller/orders/:id/pack` | verifySeller |
| `GET /api/seller/analytics` | verifySeller |
| `GET /api/seller/pickups` | verifySeller |
| `PUT /api/seller/products/:id/offer` | verifySeller |
| `DELETE /api/seller/products/:id/offer` | verifySeller |
| `GET /api/seller/inventory-alerts` | verifySeller |
| `GET /api/seller/inventory-alerts/unread-count` | verifySeller |
| `PUT /api/seller/inventory-alerts/:id/read` | verifySeller |
| `PUT /api/seller/inventory-alerts/read-all` | verifySeller |
| `POST /api/seller/inventory-alerts/check` | verifySeller |
| `GET /api/seller/payouts/history` | verifySeller |
| `GET /api/seller/inventory` | verifySeller |
| `POST /api/seller/inventory/:productId/variants` | verifySeller |
| `PUT /api/seller/inventory/:productId/variants/:variantId` | verifySeller |
| `DELETE /api/seller/inventory/:productId/variants/:variantId` | verifySeller |
| `POST /api/seller/inventory/bulk-variants` | verifySeller |
| `GET /api/seller/returns` | verifySeller |
| `POST /api/seller/returns/:id/approve` | verifySeller |
| `POST /api/seller/returns/:id/reject` | verifySeller |

### `/api/products` — server/routes/product.js

| `GET /api/products/` | optionalAuth |
| `GET /api/products/manufacturer-brands` | public |
| `GET /api/products/brands` | public |
| `GET /api/products/categories` | public |
| `GET /api/products/offers` | public |
| `GET /api/products/random` | public |
| `GET /api/products/filters` | public |
| `GET /api/products/:id/related` | public |
| `GET /api/products/:id` | public |
| `POST /api/products/` | verifySeller, middleware, handleValidationErrors |
| `PUT /api/products/:id` | verifySeller |
| `DELETE /api/products/:id` | verifySeller |
| `POST /api/products/:id/images` | verifySeller, multerMiddleware |

### `/api/orders` — server/routes/order.js

| `POST /api/orders/` | verifyToken, middleware, handleValidationErrors |
| `GET /api/orders/` | verifyToken |
| `POST /api/orders/quote` | public |
| `GET /api/orders/:id` | verifyToken |
| `GET /api/orders/:id/charge-summary` | verifyToken |
| `PUT /api/orders/:id/cancel` | verifyToken |
| `POST /api/orders/:id/return` | verifyToken |
| `POST /api/orders/:id/review` | verifyToken |

### `/api/cart` — server/routes/cart.js

| `GET /api/cart/` | verifyToken |
| `POST /api/cart/add` | verifyToken |
| `POST /api/cart/add-lens` | verifyToken |
| `POST /api/cart/add-contact-lens` | verifyToken |
| `PUT /api/cart/update` | verifyToken |
| `DELETE /api/cart/remove/:productId` | verifyToken |
| `DELETE /api/cart/clear` | verifyToken |

### `/api/payment` — server/routes/payment.js

| `POST /api/payment/create-order` | verifyToken, <anonymous> |
| `POST /api/payment/verify` | verifyToken |
| `POST /api/payment/webhook` | rawParser |

### `/api/wishlist` — server/routes/wishlist.js

| `GET /api/wishlist/` | verifyToken |
| `POST /api/wishlist/add` | verifyToken |
| `DELETE /api/wishlist/remove/:productId` | verifyToken |

### `/api/coupons` — server/routes/coupon.js

| `GET /api/coupons/` | public |
| `POST /api/coupons/validate` | verifyToken |
| `POST /api/coupons/` | verifyToken, verifyAdmin, middleware, handleValidationErrors |
| `GET /api/coupons/all` | verifyToken, verifyAdmin |

### `/api/blogs` — server/routes/blog.js

| `GET /api/blogs/` | public |
| `GET /api/blogs/:slug` | public |
| `POST /api/blogs/` | verifyToken |
| `PUT /api/blogs/:id` | verifyToken |
| `DELETE /api/blogs/:id` | verifyToken |
| `POST /api/blogs/:id/comment` | verifyToken |
| `POST /api/blogs/:id/like` | verifyToken |

### `/api/help` — server/routes/help.js

| `GET /api/help/` | public |
| `GET /api/help/:id` | public |
| `POST /api/help/` | verifyToken, verifyAdmin |
| `PUT /api/help/:id` | verifyToken, verifyAdmin |
| `POST /api/help/contact` | public |

### `/api/admin` — server/routes/admin.js

| `GET /api/admin/listing-approvals` | verifyToken, verifyAdmin |
| `POST /api/admin/listing-approvals/decide` | verifyToken, verifyAdmin |
| `GET /api/admin/me` | verifyToken, verifyAdmin |
| `GET /api/admin/dashboard` | verifyToken, verifyAdmin |
| `GET /api/admin/users` | verifyToken, verifyAdmin |
| `DELETE /api/admin/users/:id` | verifyToken, verifyAdmin |
| `GET /api/admin/sellers` | verifyToken, verifyAdmin |
| `PUT /api/admin/sellers/:id/verify` | verifyToken, verifyAdmin |
| `DELETE /api/admin/sellers/:id` | verifyToken, verifyAdmin |
| `GET /api/admin/orders` | verifyToken, verifyAdmin |
| `GET /api/admin/revenue` | verifyToken, verifyAdmin |
| `POST /api/admin/staff` | verifyToken, verifyAdmin |
| `GET /api/admin/staff` | verifyToken, verifyAdmin |
| `DELETE /api/admin/staff/:id` | verifyToken, verifyAdmin |
| `PUT /api/admin/staff/:id/permissions` | verifyToken, verifyAdmin |
| `GET /api/admin/coupons` | verifyToken, verifyAdmin |
| `POST /api/admin/coupons` | verifyToken, verifyAdmin |
| `PUT /api/admin/coupons/:id` | verifyToken, verifyAdmin |
| `DELETE /api/admin/coupons/:id` | verifyToken, verifyAdmin |
| `GET /api/admin/seller-payouts` | verifyToken, verifyAdmin |
| `GET /api/admin/delivery` | verifyToken, verifyAdmin |
| `GET /api/admin/pickups` | verifyToken, verifyAdmin |
| `PUT /api/admin/users/:id/ban` | verifyToken, verifyAdmin |
| `PUT /api/admin/sellers/:id/ban` | verifyToken, verifyAdmin |
| `GET /api/admin/users/:id` | verifyToken, verifyAdmin |
| `GET /api/admin/users/:id/orders` | verifyToken, verifyAdmin |
| `GET /api/admin/sellers/:id` | verifyToken, verifyAdmin |
| `GET /api/admin/sellers/:id/products` | verifyToken, verifyAdmin |
| `GET /api/admin/sellers/:id/orders` | verifyToken, verifyAdmin |
| `GET /api/admin/executives` | verifyToken, verifyAdmin |
| `POST /api/admin/executives` | verifyToken, verifyAdmin |
| `PUT /api/admin/executives/:id` | verifyToken, verifyAdmin |
| `DELETE /api/admin/executives/:id` | verifyToken, verifyAdmin |
| `PUT /api/admin/executives/:id/ban` | verifyToken, verifyAdmin |
| `GET /api/admin/manufacturers` | verifyToken, verifyAdmin |
| `POST /api/admin/manufacturers` | verifyToken, verifyAdmin |
| `GET /api/admin/manufacturer-update-requests` | verifyToken, verifyAdmin |
| `POST /api/admin/manufacturers/:id/recreate-invitation` | verifyToken, verifyAdmin |
| `POST /api/admin/manufacturers/:id/resend-confirmation` | verifyToken, verifyAdmin |
| `GET /api/admin/system/metrics` | verifyToken, verifyAdmin |
| `POST /api/admin/manufacturers/:id/force-activate` | verifyToken, verifyAdmin |
| `PUT /api/admin/manufacturers/:id` | verifyToken, verifyAdmin |
| `DELETE /api/admin/manufacturers/:id` | verifyToken, verifyAdmin |
| `PUT /api/admin/manufacturers/:id/ban` | verifyToken, verifyAdmin |
| `GET /api/admin/manufacturers/:id/products` | verifyToken, verifyAdmin |
| `GET /api/admin/manufacturers/:id/sellers` | verifyToken, verifyAdmin |
| `GET /api/admin/commissions` | verifyToken, verifyAdmin |
| `GET /api/admin/cash-reconciliation` | verifyToken, verifyAdmin |

### `/api/notifications` — server/routes/notification.js

| `GET /api/notifications/` | verifyAnyPrincipal |
| `PUT /api/notifications/:id/read` | verifyToken |
| `PUT /api/notifications/read-all` | verifyToken |

### `/api/shiprocket` — server/routes/shiprocket.js

| `POST /api/shiprocket/create-order` | verifySeller |
| `POST /api/shiprocket/pickup` | verifySeller |
| `GET /api/shiprocket/tracking/:orderId` | verifyToken |
| `POST /api/shiprocket/webhook` | jsonParser |

### `/api/sale-events` — server/routes/saleEvent.js

| `GET /api/sale-events/` | public |
| `GET /api/sale-events/:id` | public |
| `POST /api/sale-events/` | verifyToken, verifyAdmin |
| `PUT /api/sale-events/:id` | verifyToken, verifyAdmin |
| `DELETE /api/sale-events/:id` | verifyToken, verifyAdmin |
| `POST /api/sale-events/:id/toggle` | verifyToken, verifyAdmin |

### `/api/banners` — server/routes/banners.js

| `GET /api/banners/active` | public |
| `GET /api/banners/slug/:slug` | public |
| `GET /api/banners/` | verifyToken, verifyAdmin |
| `POST /api/banners/` | verifyToken, verifyAdmin, multerMiddleware |
| `PUT /api/banners/:id` | verifyToken, verifyAdmin, multerMiddleware |
| `DELETE /api/banners/:id` | verifyToken, verifyAdmin |

### `/api/executive` — server/routes/executive.js

| `POST /api/executive/logout` | verifyExecutive |
| `POST /api/executive/login` | <anonymous> |
| `POST /api/executive/verify-login-otp` | <anonymous> |
| `GET /api/executive/me` | verifyExecutive |
| `GET /api/executive/dashboard` | verifyExecutive |
| `GET /api/executive/staff` | verifyExecutive |
| `POST /api/executive/staff` | verifyExecutive |
| `PUT /api/executive/staff/:id` | verifyExecutive |
| `DELETE /api/executive/staff/:id` | verifyExecutive |
| `GET /api/executive/department-data` | verifyExecutive |
| `GET /api/executive/dashboard/stats` | verifyExecutive |
| `GET /api/executive/deliveries/assigned` | verifyExecutive |
| `GET /api/executive/deliveries/:id` | verifyExecutive |
| `PUT /api/executive/deliveries/:id/status` | verifyExecutive |
| `PUT /api/executive/deliveries/:id/issue/resolve` | verifyExecutive |
| `GET /api/executive/customers` | verifyExecutive |
| `GET /api/executive/reports` | verifyExecutive |

### `/api/manufacturer` — server/routes/manufacturer.js

| `GET /api/manufacturer/listing-requests` | verifyManufacturer |
| `POST /api/manufacturer/listing-requests/decide` | verifyManufacturer |
| `POST /api/manufacturer/logout` | verifyManufacturer |
| `POST /api/manufacturer/products/upload-images` | verifyManufacturer, multerMiddleware |
| `GET /api/manufacturer/onboarding/:token` | public |
| `POST /api/manufacturer/onboarding/:token/verify` | public |
| `POST /api/manufacturer/onboarding/:token/otp` | public |
| `POST /api/manufacturer/onboarding/:token/update` | public |
| `POST /api/manufacturer/login` | <anonymous> |
| `POST /api/manufacturer/verify-login-otp` | <anonymous> |
| `GET /api/manufacturer/profile` | verifyManufacturer |
| `PUT /api/manufacturer/profile` | verifyManufacturer |
| `GET /api/manufacturer/me` | verifyManufacturer |
| `GET /api/manufacturer/upload-spec` | verifyManufacturer |
| `POST /api/manufacturer/products` | verifyManufacturer |
| `GET /api/manufacturer/products` | verifyManufacturer |
| `PUT /api/manufacturer/products/:id` | verifyManufacturer |
| `POST /api/manufacturer/products/:id/discontinue` | verifyManufacturer |
| `POST /api/manufacturer/products/:id/recontinue` | verifyManufacturer |
| `POST /api/manufacturer/products/bulk-upload` | verifyManufacturer, multerMiddleware |
| `POST /api/manufacturer/sellers` | verifyManufacturer |
| `GET /api/manufacturer/sellers` | verifyManufacturer |
| `POST /api/manufacturer/sellers/bulk-upload` | verifyManufacturer, multerMiddleware |
| `POST /api/manufacturer/sellers/:id/ban` | verifyManufacturer |
| `POST /api/manufacturer/staff` | verifyManufacturer |
| `GET /api/manufacturer/staff` | verifyManufacturer |
| `DELETE /api/manufacturer/sellers/:sellerId` | verifyManufacturer |
| `POST /api/manufacturer/sellers/:sellerId/ban` | verifyManufacturer |
| `GET /api/manufacturer/profile` | verifyManufacturer |
| `PUT /api/manufacturer/profile` | verifyManufacturer |
| `POST /api/manufacturer/sellers/:sellerId/unban` | verifyManufacturer |
| `PUT /api/manufacturer/sellers/:sellerId` | verifyManufacturer |
| `POST /api/manufacturer/products/validate-bulk` | verifyManufacturer |
| `GET /api/manufacturer/products/pending` | verifyManufacturer |
| `PUT /api/manufacturer/products/pending/:productId` | verifyManufacturer |
| `DELETE /api/manufacturer/products/pending/:productId` | verifyManufacturer |

### `/api/manufacturers` — server/routes/manufacturers.js

| `GET /api/manufacturers/` | public |
| `GET /api/manufacturers/:id` | public |
| `GET /api/manufacturers/:id/products` | public |

### `/api/manufacturer-seller` — server/routes/manufacturerSeller.js

| `POST /api/manufacturer-seller/products/:id/withdraw` | verifyManufacturerSeller |
| `POST /api/manufacturer-seller/logout` | verifyManufacturerSeller |
| `POST /api/manufacturer-seller/login` | <anonymous> |
| `POST /api/manufacturer-seller/verify-login-otp` | <anonymous> |
| `GET /api/manufacturer-seller/me` | verifyManufacturerSeller |
| `GET /api/manufacturer-seller/available-products` | verifyManufacturerSeller |
| `POST /api/manufacturer-seller/products/:id/toggle` | verifyManufacturerSeller |
| `GET /api/manufacturer-seller/products` | verifyManufacturerSeller |

### `/api/chatbot` — server/routes/chatbot.js

| `POST /api/chatbot/message` | public |
| `GET /api/chatbot/knowledge` | verifyToken |
| `PUT /api/chatbot/knowledge` | verifyToken |
| `POST /api/chatbot/suggestions` | public |

### `/api/face-detection` — server/routes/faceDetection.js

| `POST /api/face-detection/detect` | multerMiddleware |
| `GET /api/face-detection/recommendations/:faceShape` | public |
| `GET /api/face-detection/face-shapes` | public |

### `/api/speech` — server/routes/speechRecognition.js

| `POST /api/speech/search` | multerMiddleware |
| `POST /api/speech/transcribe` | multerMiddleware |
| `GET /api/speech/languages` | public |

### `/api/payouts` — server/routes/payouts.js

| `POST /api/payouts/calculate` | verifyAdmin |
| `POST /api/payouts/process` | verifyAdmin |
| `GET /api/payouts/history` | verifySeller |
| `GET /api/payouts/` | verifyAdmin |
| `GET /api/payouts/summary` | verifyAdmin |

### `/api/inventory` — server/routes/inventory.js

| `POST /api/inventory/reserve` | verifyToken |
| `POST /api/inventory/complete/:reservationId` | verifyToken |
| `POST /api/inventory/cancel/:reservationId` | verifyToken |
| `GET /api/inventory/reservations` | verifyToken |
| `POST /api/inventory/bulk-update` | verifySeller |
| `GET /api/inventory/check/:productId` | public |
| `GET /api/inventory/available` | public |

### `/api/returns` — server/routes/returns.js

| `POST /api/returns/` | verifyToken |
| `GET /api/returns/user` | verifyToken |
| `GET /api/returns/seller` | verifySeller |
| `GET /api/returns/` | verifyToken, verifyAdmin |
| `POST /api/returns/:id/approve` | verifyToken |
| `POST /api/returns/:id/reject` | verifyToken |
| `POST /api/returns/:id/picked-up` | verifyToken |
| `POST /api/returns/:id/received` | verifyToken |
| `POST /api/returns/:id/refund` | verifyToken, verifyAdmin |

### `/api/notifications` — server/routes/notifications.js

| `DELETE /api/notifications/:id` | verifyToken |
| `POST /api/notifications/subscribe` | verifyToken |

### `/api/wishlist-alerts` — server/routes/wishlistAlerts.js

| `POST /api/wishlist-alerts/add` | verifyToken |
| `GET /api/wishlist-alerts/` | verifyToken |
| `POST /api/wishlist-alerts/check-price-drops` | verifyToken |

### `/api/comparison` — server/routes/productComparison.js

| `POST /api/comparison/` | verifyToken |
| `GET /api/comparison/` | verifyToken |
| `GET /api/comparison/:id` | verifyToken |
| `DELETE /api/comparison/:id` | verifyToken |
| `POST /api/comparison/:id/products` | verifyToken |
| `DELETE /api/comparison/:id/products/:productId` | verifyToken |
| `POST /api/comparison/:id/share` | verifyToken |
| `GET /api/comparison/shared/:token` | public |
| `POST /api/comparison/compare-categories` | public |

### `/api/seller-performance` — server/routes/sellerPerformance.js

| `GET /api/seller-performance/metrics` | verifySeller |
| `GET /api/seller-performance/:sellerId/metrics` | verifyToken, verifyAdmin |
| `GET /api/seller-performance/all` | verifyToken, verifyAdmin |

### `/api/prescription-verification` — server/routes/prescriptionVerification.js

| `POST /api/prescription-verification/submit` | verifyToken |
| `GET /api/prescription-verification/user` | verifyToken |
| `GET /api/prescription-verification/pending` | verifyToken, verifyPrescriptionVerifier |
| `GET /api/prescription-verification/` | verifyToken, verifyPrescriptionVerifier |
| `PATCH /api/prescription-verification/:id/document` | verifyToken, verifyPrescriptionVerifier |
| `POST /api/prescription-verification/:id/approve` | verifyToken, verifyPrescriptionVerifier |
| `POST /api/prescription-verification/:id/reject` | verifyToken, verifyPrescriptionVerifier |

### `/api/order-routing` — server/routes/orderRouting.js

| `POST /api/order-routing/route` | verifyToken |
| `POST /api/order-routing/:id/accept` | verifySeller |
| `POST /api/order-routing/:id/reject` | verifySeller |
| `POST /api/order-routing/:id/assign` | verifyToken, verifyAdmin |
| `POST /api/order-routing/:id/auto-assign` | verifyToken, verifyAdmin |
| `GET /api/order-routing/queue` | verifyToken, verifyAdmin |
| `POST /api/order-routing/sweep` | verifyToken, verifyAdmin |
| `GET /api/order-routing/:id` | verifyToken |
| `GET /api/order-routing/` | verifyToken, verifyAdmin |

### `/api/lens-configuration` — server/routes/lensConfiguration.js

| `POST /api/lens-configuration/` | verifyToken, multerMiddleware |
| `GET /api/lens-configuration/:productId` | verifyToken |
| `PUT /api/lens-configuration/:id` | verifyToken, multerMiddleware |
| `DELETE /api/lens-configuration/:id` | verifyToken |
| `GET /api/lens-configuration/pricing/info` | public |

### `/api/delivery-partner` — server/routes/deliveryPartner.js

| `POST /api/delivery-partner/logout` | verifyDeliveryPartner |
| `POST /api/delivery-partner/register` | verifyToken, verifyAdmin |
| `POST /api/delivery-partner/login` | <anonymous> |
| `POST /api/delivery-partner/verify-login-otp` | <anonymous> |
| `GET /api/delivery-partner/me` | verifyDeliveryPartner |
| `POST /api/delivery-partner/location` | verifyDeliveryPartner |
| `POST /api/delivery-partner/complete/:orderId` | verifyDeliveryPartner |
| `POST /api/delivery-partner/withdraw` | verifyDeliveryPartner |
| `GET /api/delivery-partner/` | verifyToken, verifyAdmin |
| `PUT /api/delivery-partner/:id/ban` | verifyToken, verifyAdmin |
| `PUT /api/delivery-partner/availability` | verifyDeliveryPartner |
| `GET /api/delivery-partner/recommendations/:orderId` | verifyToken, verifyAdmin |
| `POST /api/delivery-partner/queue/offer/:orderId` | verifyToken, verifyAdmin |
| `GET /api/delivery-partner/offers` | verifyDeliveryPartner |
| `POST /api/delivery-partner/offers/:orderId/respond` | verifyDeliveryPartner |
| `POST /api/delivery-partner/report/:orderId` | verifyDeliveryPartner |
| `GET /api/delivery-partner/unassigned` | verifyToken, verifyAdmin |
| `POST /api/delivery-partner/assign` | verifyToken, verifyAdmin |
| `GET /api/delivery-partner/working` | verifyToken, verifyAdmin |
| `GET /api/delivery-partner/payment/calculate` | verifyDeliveryPartner |
| `GET /api/delivery-partner/payment/earnings` | verifyDeliveryPartner |
| `POST /api/delivery-partner/payment/withdraw` | verifyDeliveryPartner |
| `GET /api/delivery-partner/payouts/pending` | verifyToken, verifyAdmin |
| `POST /api/delivery-partner/payouts/:withdrawalId/settle` | verifyToken, verifyAdmin |

### `/api` — server/routes/partnerRanking.js

| `GET /api/admin/partner-weekly-ranks` | verifyToken, verifyAdmin |
| `GET /api/delivery-partner/rank/current` | verifyDeliveryPartner |

### `/api` — server/routes/brandLogos.js

| `POST /api/manufacturer/brands` | verifyManufacturer, multerMiddleware |
| `GET /api/admin/storage-inventory` | verifyToken, verifyAdmin |
| `GET /api/storage/status` | verifyToken, verifyAdmin |
| `GET /api/manufacturer/brands` | verifyManufacturer |
| `GET /api/admin/brand-queue` | verifyToken, verifyAdmin |
| `PUT /api/admin/brands/:id/decision` | verifyToken, verifyAdmin |
| `GET /api/manufacturer/brands/:slug/manifest` | verifyManufacturer |
| `GET /api/brands/with-logos` | public |

### `/api/product-verification` — server/routes/productVerification.js

| `GET /api/product-verification/pending` | verifyToken, verifyAdmin |
| `POST /api/product-verification/:productId/verify` | verifyToken, verifyAdmin |
| `POST /api/product-verification/:productId/reject` | verifyToken, verifyAdmin |
| `GET /api/product-verification/stats` | verifyToken, verifyAdmin |

### `/api/inventory-analytics` — server/routes/inventoryAnalytics.js

| `GET /api/inventory-analytics/seller` | verifySeller |
| `GET /api/inventory-analytics/seller/health` | verifySeller |

### `/api/return-analytics` — server/routes/returnAnalytics.js

| `GET /api/return-analytics/seller` | verifySeller |
| `GET /api/return-analytics/admin` | verifyToken, verifyAdmin |

### `/api/delivery-route` — server/routes/deliveryRoute.js

| `GET /api/delivery-route/optimize` | verifyDeliveryPartner |
| `GET /api/delivery-route/updates` | verifyDeliveryPartner |

### `/api/customer-returns` — server/routes/customerReturns.js

| `GET /api/customer-returns/eligibility/:orderId` | verifyToken |
| `POST /api/customer-returns/` | verifyToken |
| `POST /api/customer-returns/:returnId/images` | verifyToken, multerMiddleware |
| `GET /api/customer-returns/my-returns` | verifyToken |
| `POST /api/customer-returns/:returnId/cancel` | verifyToken |

### `/api/commission` — server/routes/commission.js

| `POST /api/commission/record/:orderId` | verifyToken, verifyAdmin |
| `GET /api/commission/summary` | verifyToken, verifyAdmin |
| `GET /api/commission/seller/:sellerId` | verifyAnyPrincipal |
| `GET /api/commission/my-commission` | verifySeller |
| `GET /api/commission/pending` | verifyToken, verifyAdmin |

### `/api/site-content` — server/routes/siteContent.js

| `GET /api/site-content/home` | public |
| `PUT /api/site-content/home` | verifyToken, verifyAdmin |
| `DELETE /api/site-content/home` | verifyToken, verifyAdmin |
| `GET /api/site-content/footer` | public |
| `PUT /api/site-content/footer` | verifyToken, verifyAdmin |
| `DELETE /api/site-content/footer` | verifyToken, verifyAdmin |

### `/api/staff` — server/routes/staff.js

| `GET /api/staff/overview` | verifyToken, verifyStaff |
| `GET /api/staff/orders` | verifyToken, verifyStaff |
| `GET /api/staff/products` | verifyToken, verifyStaff |
| `GET /api/staff/blogs` | verifyToken, verifyStaff |
| `GET /api/staff/returns` | verifyToken, verifyStaff |

### `/api/seller-stock` — server/routes/sellerStock.js

| `GET /api/seller-stock/` | verifyAnySeller |
| `POST /api/seller-stock/` | verifyAnySeller |
| `GET /api/seller-stock/price-changes` | verifyAnySeller |
| `POST /api/seller-stock/price-changes/:stockId/decide` | verifyAnySeller |
| `POST /api/seller-stock/public/price-changes/:stockId/decide` | public |
| `GET /api/seller-stock/admin/price-changes` | verifyToken |
| `POST /api/seller-stock/admin/price-changes/:stockId/propose` | verifyToken |
| `POST /api/seller-stock/admin/price-changes/:stockId/override` | verifyToken, verifyAdmin |
| `GET /api/seller-stock/catalogue` | verifyAnySeller |
| `PUT /api/seller-stock/:id` | verifyAnySeller |
| `DELETE /api/seller-stock/:id` | verifyAnySeller |

### Direct on app (from server.js)

- `GET /api/health`
- `GET /api/metrics`
- `GET *`
- `GET io`
- `GET io`
