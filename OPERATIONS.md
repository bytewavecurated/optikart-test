# Operations

Deploy, diagnose, and what is knowingly left undone.

## Configuration

All runtime configuration is `server/.env`.

`server/.env` **was committed** in this repository's history, with values that look live
(AWS, Azure Face, OpenAI/Google Vision keys, the JWT secret and an Atlas URI). It is now
untracked and ignored, and `server/.env.example` holds placeholders instead - but anything
already pushed stays in history, so treat those credentials as exposed and rotate them.
A history rewrite is a separate, deliberate decision because it rewrites shared state.

Keep `server/.env` out of version control and out of images.

### Required

| Key | Notes |
| --- | --- |
| `MONGODB_URI` | local `mongodb://localhost:27017/optikart` or an Atlas SRV string |
| `JWT_SECRET` | long random string; changing it invalidates every session |
| `PORT` | 5000 by default |
| `SEED_ON_BOOT` | `auto` \| `true` \| `false`; the seed deletes the collections it owns, so `auto` only runs it on an empty database |
| `FRONTEND_URL` | exact browser origin; must match for CORS and Socket.IO |

### Environment

| Key | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` enables stricter behaviour |
| `TRUST_PROXY_HOPS` | `1` in production, else `0` | number of reverse proxies, not `true` |

Set the hop count to the real number of proxies you control. One too many lets clients
spoof their address; `0` behind a proxy makes every shopper share one IP and trips the
rate limiter.

### Optional integrations

`SMTP_HOST/PORT/USER/PASS`, `RAZORPAY_KEY_ID/SECRET`, `RAZORPAY2_KEY_ID/SECRET`,
`RAZORPAYX_KEY_ID/SECRET`, `SHIPROCKET_API_KEY`, `CLOUDINARY_*`, `OPENAI_API_KEY`,
`AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY`, `GOOGLE_VISION_API_KEY`.
Each degrades safely; see the table in README for what still works without it.

## Deploying

1. `cd client && npm run build`
2. `cd ../server && npm ci --omit=dev && node server.js`

Express then serves `client/build` and the API from one origin, so set `FRONTEND_URL` to
that origin and leave the client's API base at the default `/api`.

MongoDB Atlas: add the deployer's egress IP (or `0.0.0.0/0` on ephemeral PaaS) to the
network allowlist, then expect a 30-90 second connection timeout if it is missing - the
error message looks like a wrong password but is not.

If the platform's filesystem is ephemeral, mount a volume at `server/uploads/` or move
uploads to Cloudinary. Otherwise every re-deploy silently loses uploaded banners and
product images.

Seeding follows `SEED_ON_BOOT`: `auto` (the default) seeds only when the
database looks empty, `true` forces it and wipes the collections the seed owns,
`false` never runs it. The server refuses to start with `SEED_ON_BOOT=true` when
`NODE_ENV=production` precisely because that flag deletes data - so a production
deploy that also forgot to set the mode is stopped at boot rather than discovered
later. To pull demo fixtures back out of a database that has real records in it,
use `npm run deprovision:demo` in `server/`, which asks for confirmation twice.
CI and `scripts/verify.mjs` always run development mode with seeding forced,
because every suite asserts against the seeded accounts.

Before publishing: CI must be green on the commit being deployed. It runs the
contract audit and 143 assertions against a real MongoDB; a job that passes
locally but fails there usually means a route was never mounted, or a suite was
written against state that only this machine's database happens to have.

## Health and diagnosis

One command checks everything, and it is the same command CI runs:

```bash
node scripts/verify.mjs
```

It starts an isolated MongoDB and its own API process (port 3111, so it will not
disturb a server already running on 3000), waits for `/api/health`, then runs the
contract audit and the suites below, and prints one line per group. It exits
non-zero if any of them fails. To point it at a database that already exists,
set `MONGODB_URI`; to use a different port, `VERIFY_PORT`.

| Group | What it proves |
| --- | --- |
| `server/scripts/audit/api-contract.mjs` | Every `api.get/post/...` path in the client resolves to a mounted server route (323 calls). |
| `scripts/session_e2e.mjs` | 60 assertions: each of the eight consoles can sign in, be refused after logout with the same token, and sign in again. |
| `scripts/safety_e2e.mjs` | 17: prescription gating and concurrent stock reservation. |
| `scripts/catalog_access_e2e.mjs` | 27: catalogue visibility and role access. |
| `scripts/dispatch_e2e.mjs` | 21: the delivery dispatch cascade. |
| `scripts/partner_flow_e2e.mjs` | 18: partner report, earnings, payout. |

The audit is there because a client call that hits no route is invisible: the
server's fallback answers 404, most callers catch it, and the operator sees an
empty list or a generic "failed to load". Four consoles were doing exactly that
- their Logout buttons called a route that had never existed.

### Reading a live system

| Check | Command |
| --- | --- |
| API alive | `curl -s localhost:3000/api/health` |
| What it is unhealthy about | the same response names the failing dependency (`status: "degraded"`) |
| Traffic, latency, errors | `curl -s -H "Authorization: Bearer <admin token>" localhost:3000/api/metrics` |
| Seeded logins work | `POST /api/auth/login` with a seeded account |
| Frontend served | `curl -s -o /dev/null -w '%{http_code}' localhost:3000/` |
| Websocket up | connect, then look for `Client connected` in the server log |

Every response carries `X-Request-Id`, and every request over 1s or with a 5xx
status writes one JSON line to stdout with the same `id`. So a user report of
"it failed at 14:02" becomes: find the line, read the `id`, and every log entry
and metrics sample for that request lines up. `/api/metrics` is admin-only and
in-process only - it resets on restart, and its slow-request ring buffer keeps
the last 25.

### Forcing someone off a session

Access tokens are bearer JWTs. They used to be valid until expiry no matter what
happened afterwards, so "sign out this user" was not an operation the system
could perform. Now each token carries a session id (`jti`), and
`POST .../logout` records its hash in `RevokedSession`;
`server/middleware/sessionGuard.js` rejects that session on every future API
call, for all eight consoles, before any route runs.

To sign somebody out without their cooperation, insert the row yourself:

```js
const revoked = await import('./server/services/session.js');
// keys are sha256 of the jti, so you need the token to compute one
await RevokedSession.create({ key: revoked.sessionKey({ decoded, token }), role, expiresAt });
```

Records expire with the token they revoke (TTL index), so the collection cannot
grow. The trade to know about: an emergency is now the one case where a token
must be looked up, so if Mongo is unreachable the revocation check is skipped
rather than rejecting every request - a signed-out session can finish its
in-flight calls during a database blip, which is smaller than the storefront
going dark.


## Delivery dispatch, end to end

1. A seller moves an order to `packed` (`PUT /api/seller/orders/:id/status`). That
   transition fires `offerQueue` best-effort: any failure is logged, never
   returned to the seller, because their action already succeeded.
2. `recommendPartners` ranks available partners within 12 km of the store. If the
   store has no usable position the order is marked for manual assignment instead
   of being offered to nobody in particular.
3. Up to three partners are offered the run one at a time, each with a 30-minute
   window (`PARTNER_OFFER_WINDOW_MINUTES`). A decline advances immediately; a
   window that lapses is closed by the `partnerSweep` timer in `server.js`.
4. Accepting sets `assignedDeliveryPartner`, prices the leg at ₹10/km and books the
   partner. Anything longer than `PARTNER_MAX_LEAD_KM` (60 km) is not a bicycle
   run at any price: it is escalated to the admin as a courier job, and the manual
   `/assign` route refuses it too.
5. Nobody answered, or too far: the order appears under "Waiting for a partner" in
   the admin's delivery-partner page with the ranking that was used, an Assign
   button and a re-run button.
6. Completing a delivery credits the partner ledger (`totalEarnings`,
   `totalDeliveries`) and marks cash-on-delivery collected, which is what makes the
   seller payout eligible.

Diagnose with: `GET /api/delivery-partner/recommendations/:orderId` (who would be
asked and why), `GET /api/delivery-partner/unassigned` (what is waiting),
`GET /api/delivery-partner/offers` (what one partner currently sees), and
`node scripts/dispatch_e2e.mjs` against a seeded database, which asserts the whole
chain in 21 checks.

The demo data carries **three** partners at different distances from the seeded Bandra
stores (Bandra 0.2 km, Andheri 5.9 km, Thane beyond the 12 km radius). With a single
partner none of this is observable - ranking, the radius, and cascading to a second
courier all need more than one person in the pool - and the newly seeded logins must
also be added to the OTP skip-list in `routes/deliveryPartner.js`, or their printed
password silently demands a code that never arrives.

### A partner reporting from the door

`POST /api/delivery-partner/report/:orderId` accepts `customer_unreachable`,
`wrong_address`, `refused`, `damaged`, `other`. The reason must be from that list and
`other` requires a note, because an empty "something went wrong" is not actionable.
The report lands on `order.deliveryIssue` **and** in `deliveryJourney`, so it shows up
in the customer timeline, the order detail screen and the delivery desk, where
`PUT /api/executive/deliveries/:id/issue/resolve` clears it. Only the partner holding
the run can raise it, and clearing an already-cleared report is refused instead of
appending a second "resolved" entry as if work had been done.

## Who may reach what

Each console is guarded by its own middleware (`verifySeller`, `verifyAdmin`,
`verifyStaff`, `verifyExecutive`, `verifyManufacturer`, `verifyManufacturerSeller`,
`verifyDeliveryPartner`) in `middleware/auth.js`. They check the token, that an
account of that role exists for it, and that it is neither deactivated nor banned,
answering 403 with the area that was refused. Upload routes authenticate *before*
multer parses the body.

On the client `ProtectedRoute` reads the role from the signed-in session, never
from `localStorage.optikart_role`, which any tab can rewrite; the cached profile is
restored only when it matches the stored role.

## Editing the storefront without a deploy

`GET /api/site-content/home` is public and returns only what an administrator has
overridden; the home page merges it onto the defaults that live beside the
components, so nothing is duplicated and a failed request still renders a full
page. The admin screen is "Storefront Content" (`/admin/site-content`): headings and
sub-headings, which rails show, the category / promo / gender tiles, and the face
shape, frame type and material lists. `DELETE /api/site-content/home` clears it all.

Writes are admin only, and each value is checked before anything is saved: icons
must be one of the names the app already ships (so a stored value can never become
markup), links must be an internal path or an `https://` URL, colours must be hex,
lists are capped at 24 entries. Problems come back per field - `Category tiles item
2: icon "NotARealIcon" is not one of ...` - because dropping a broken tile silently
is how a promotion goes missing unnoticed.

## Going live without locking yourself out

Two ways to make a production install unreachable are wired against at boot, and the
process **exits** rather than starting broken:

| Condition | Why it stops |
| --- | --- |
| `SEED_ON_BOOT=true` in production | the seed deletes the collections it owns before writing demo fixtures |
| no SMTP in production | every role sign-in requires an emailed OTP; without mail no account can be reached again, including the first one |
| missing/short/placeholder `JWT_SECRET` | a known secret lets anyone mint a session for any role, admin included |

`BOOTSTRAP_ADMIN_EMAIL` / `_PASSWORD` / `_NAME` create exactly one administrator when no
active admin exists. It is skipped silently when an admin already exists, refuses a weak
password, and never logs the password. Do a real OTP sign-in, then delete the password
from the environment.

Demo fixtures are removed by an explicit operator command, never at boot:

```bash
cd server
DANGEROUS_CONFIRM=yes npm run deprovision:demo            # demo logins only
DANGEROUS_CONFIRM=yes REMOVE_DEMO_CATALOGUE=yes npm run deprovision:demo   # plus every product
```

The second form deletes **all** products, including real ones in that collection -
import the catalogue afterwards, or leave the flag off. After running it the script tells
you if no administrator is left, which is the one state that would need a restart with
the bootstrap variables set.

Authentication attempts are now counted against the **account** being targeted, with the
address as fallback, so an office or a mobile carrier sharing one IP no longer means one
failed neighbour blocks everyone; the window is 5 minutes, and payment intents key on the
signed-in user.

## Troubleshooting

`ERR_ERL_PERMISSIVE_TRUST_PROXY` in the server log
: Express was set to trust all proxies. Set `TRUST_PROXY_HOPS` to the real hop count
(`middleware/rateLimiter.js` keeps the validation on deliberately, because that setting
defeats the limiter).

`Cast to ObjectId failed for value "..." at path "_id"`
: a literal route segment is being matched by an `/:id` handler declared earlier. Move the
specific route above the parameterised one in that file.

`Invalid token. User not found.` on a seller, partner or executive endpoint
: that route is chaining `verifyToken` in front of its role verifier. Drop the
`verifyToken`; `verify*` already checks the JWT and loads the document.

A signed-in user gets bounced to a login page on refresh
: some endpoint answered 401 and the axios interceptor ended the session. Find the 401 in
the network log and return a scoped empty result or 403 instead. Never widen the
interceptor's carve-outs; fix the endpoint.

Seller panel shows "Nothing here" when data definitely exists
: the payload key is usually right but the page reads an old shape. Check the call against
`listOf` / `oneOf`, and confirm the real body with
`curl -H "Authorization: Bearer <token>" .../api/...`.

Payouts remain `pending` with `awaiting_settlement`
: expected without RazorpayX credentials. Nothing was sent, so nothing was marked sent.

`EADDRINUSE` at boot
: a stale instance holds the port. Clear the process listening on it
(`ss -lntp | grep :3000`) before starting, and run a single server per port; two instances
seeding one database produce confusing half-written state.

Product images 404 after a fresh clone
: `server/uploads/` is runtime storage and is gitignored. Booting seeds regenerates
placeholder images automatically; real assets must come from a mounted volume or Cloudinary.

## Known gaps and deferred work

Stated plainly so nothing is mistaken for done.

### Blocked on credentials or third-party accounts

- Live Razorpay payment capture, and RazorpayX seller settlement, need real keys. The
  ledger, idempotency and status transitions are implemented and tested; the network call
  fails closed until credentials exist.
- Automated payouts require a RazorpayX payout endpoint plus verified sub-account/fund-account
  wiring. Today the settlement path returns `not_initiated` and the payout stays queued for
  manual transfer rather than guessing at an API surface.
- Real Shiprocket pickup creation needs production API credentials.
- OTP and transactional email need SMTP credentials; OTP is currently stored and logged.
- AI prescription validation and face detection sit behind an LLM/Vision key and fall back
  to rule-based behaviour without one.

### Deliberately not built

- Native mobile apps; a purchase-flow rework toward a single-sheet Lenskart-style checkout.
- Multi-warehouse stock, bin locations, supplier purchase orders, and stock transfers.
- Coupon per-user spend limits and stacking rules; sponsored-listing auctions and A/B testing.
- GST/tax filing reports; only commission and platform revenue are itemised today.
- Background geolocation for delivery partners while the app is closed (needs a PWA worker
  and a consent UI).

### Smaller rough edges worth knowing

- Return and exchange eligibility is evaluated per line against that product's
  `returnWindowDays`. A product with the field unset falls back to the platform's
  7 days; there is no per-category default table yet.
- Saved addresses have add and select at checkout, but no edit or delete UI.
- Because a console keeps one token in storage shared by every tab, signing out
  in one tab now ends the session in the others too. That is the intended
  meaning of Logout; before session ids existed it was the opposite problem,
  where Logout changed nothing outside the tab that clicked it.
- A partner withdrawal records `payout_<timestamp>` and moves the balance to
  withdrawn even when `RAZORPAY2_KEY_ID`/`SECRET` are unset, so the withdrawal
  history shows an id that no payment system ever issued. Until payouts go
  through the approval queue, treat those ids as bookkeeping, not receipts.
- Session revocation lives in one middleware mounted at `/api`. A future route
  outside that prefix would not be covered, and nothing would notice.
- Store location at seller sign-up is resolved from the PIN code unless the browser
  is permitted to share a precise position. Two sellers in one city therefore sit at
  the same distance; swap `services/geo.js` for a real geocoder if that clustering
  matters in your market.
- A combo lens is detected as "has at least one declared shade", not as a validated
  Monday-to-Sunday set.
- `GET /api/products` applies the sponsored boost with a second query, which is a
  needless round trip at scale.
- `product.stockMovementLog` keeps the last 200 movements; for longer history use
  the order and SellerPayout records.
- The manufacturer product form validates its mandatory attributes in the browser and
  again in the schema, but the two lists are maintained separately and can drift.
