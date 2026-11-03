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

The seed runs on every boot and clears the collections it owns, so it is not safe against a
real production database yet. Before pointing `MONGODB_URI` at anything you care about,
either delete the `seedDatabase()` call in `server/server.js` or use a separate database
name. Treat that as a required deployment step, not an optional one.

## Health and diagnosis

| Check | Command |
| --- | --- |
| API alive | `curl -s localhost:5000/api/health` |
| Seeded logins work | `POST /api/auth/login` with a seeded account |
| Frontend served | `curl -s -o /dev/null -w '%{http_code}' localhost:3000/` |
| Delivery dispatch | `node scripts/dispatch_e2e.mjs` (18 assertions, needs seeded logins) |
| Catalogue and role access | `node scripts/catalog_access_e2e.mjs` (27 assertions) |
| Websocket up | connect, then look for `Client connected` in the server log |

Log locations: stdout of `node server.js` for API and seed messages; in development the API
is terminal 1 and the SPA proxy logs requests in terminal 2. Browser console network errors
name the failing path, which is the fastest way to tell an API 500 from a client shape bug.

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
chain in 18 checks.

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
