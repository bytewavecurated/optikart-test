# Operations

Deploy, diagnose, and what is knowingly left undone.

## Configuration

All runtime configuration is `server/.env`. Values are never committed; keep
`server/.env` out of version control and out of images.

### Required

| Key | Notes |
| --- | --- |
| `MONGODB_URI` | local `mongodb://localhost:27017/optikart` or an Atlas SRV string |
| `JWT_SECRET` | long random string; changing it invalidates every session |
| `PORT` | 5000 by default |
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
| Websocket up | connect, then look for `Client connected` in the server log |

Log locations: stdout of `node server.js` for API and seed messages; in development the API
is terminal 1 and the SPA proxy logs requests in terminal 2. Browser console network errors
name the failing path, which is the fastest way to tell an API 500 from a client shape bug.

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

### Rough edges and things I did not finish

- Proximity routing needs coordinates. Sellers within 10 km of the delivery city are
  offered the order; if a seller document has no `location`, they are treated as an
  unknown-distance fallback candidate rather than a nearby one. Real distance
  calculation needs the seller's store coordinates, which the sign-up form does not
  capture yet - add `location` on seller registration to make radius filtering exact.
- The Rs. 59 platform-delivery fee per order line is now computed on the order row
  (`selfDeliveryCharge`) and folded into `totalAmount` when a partner is assigned,
  but a customer who is quoted COD total before assignment will see that figure move
  at the point of assignment. Surface a re-quote to the customer, or move the charge
  to the seller payout ledger only, if that is unacceptable.
- `product.stockMovementLog` is trimmed at 200 entries, so very old movements are
  not auditable; use SellerPayout rows if long history is required.
- Returns/exchanges restore stock only after the refund step, and there is no
  per-product return window override - it is still the global delivery-date window.
- `GET /api/products` applies the sponsored boost by issuing two queries; fold into one
  aggregate before adding more facet filters.
- Saved addresses have add/select in checkout but no edit or delete UI.

### Smaller rough edges worth knowing

- The home page's "Stainless Steel" material chip can return no results on seed data because
  no sample product carries that material; the filter itself works.
- Saved-address book at checkout is read/write through the profile endpoint but has no edit
  or delete UI yet - duplicates are avoided by comparing pincode plus street.
- Cart state is authoritative in the browser (`CartContext`) while `server/routes/cart.js`
  also persists a server cart; the checkout payload sends explicit line items, so orders are
  correct, but the two carts are not reconciled and the server copy is what `/cart` history
  reflects after a clear.
- Return/exchange eligibility is evaluated per product against the delivery date; there is no
  per-category override yet.
- `GET /api/products` applies the sponsored-product boost by issuing two queries rather than
  one, which is a needless extra round trip at scale.
