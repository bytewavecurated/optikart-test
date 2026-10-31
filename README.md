# OptiKart

A multi-vendor eyewear marketplace: sunglasses, eyeglasses, contact lenses, solutions
and accessories. Manufacturers publish catalogue, sellers list against it, staff and
executives run the operational queues, and the platform takes a commission instead of
a seller subscription.

Built with React (create-react-app + `react-app-rewired`), Express, MongoDB/Mongoose,
Socket.IO, Razorpay and Shiprocket.

---

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, React Router 6, framer-motion, react-icons, Socket.IO client |
| Backend | Node 18+, Express 4, ESM |
| Database | MongoDB (Atlas or local) with Mongoose 7 |
| Auth | JWT per principal (customer, seller, admin, staff, executive, manufacturer, manufacturer seller, delivery partner) |
| Payments | Razorpay (customer), second account for delivery-partner payouts |
| Shipping | Shiprocket, with an in-house delivery-partner flow as the alternative |
| Email | Nodemailer over SMTP |

## Layout

```
server/     Express API: models, routes, services, middleware, seed
client/     React SPA: pages, components, contexts, services
```

`server/server.js` mounts every router under `/api/*` and, when `client/build` exists,
also serves the SPA on the same origin. That is why the client's API base defaults to
the relative `/api`.

---

## Running it

### Prerequisites

Node 18+, and a MongoDB instance (local `mongod` on 27017, or an Atlas string).

### Install

```bash
cd server && npm install
cd ../client && npm install
```

### Configure

Copy `server/.env.example` to `server/.env` and fill in real values. Everything the app
needs to boot is `MONGODB_URI`, `JWT_SECRET` and `PORT`; the payment, shipping and email
blocks stay optional in development (see [External services](#external-services)).

Two settings are worth reading before deploying:

- `TRUST_PROXY_HOPS` - how many reverse proxies sit in front. In production the default
  is `1`. Leave it at `0`/unset for direct local connections; never set Express
  `trust proxy` to `true`, because that lets clients spoof the IP the rate limiter keys on.
- `AUTH_OTP_BYPASS` - seeded test accounts may skip the email OTP step. This only applies
  when `NODE_ENV` is not `production`.

### Seed and start

The seed runs automatically on boot and is idempotent: it clears the collections it owns,
creates demo accounts, publishes catalogue data and writes placeholder product images into
`server/uploads/products`.

```bash
# terminal 1 - API on :5000
cd server && npm run dev

# terminal 2 - SPA on :3000, proxying /api to :5000
cd client && npm start
```

For a single-origin production-style run, build and let Express serve it:

```bash
cd client && npm run build
cd ../server && node server.js   # now on http://localhost:5000
```

### Demo accounts

Printed by the seed. Customer, seller, admin, staff, executive, manufacturer, manufacturer
seller and delivery partner all have at least one working login, so every panel can be
exercised without creating data first.

---

## Money model

This is the part easiest to get wrong, so it is deliberately explicit.

**Commission is charged on the merchandise subtotal only** - never on delivery or platform
fees. When an order reaches `delivered`, `settleDeliveredOrder()` records:

```
netAmountToSeller = subtotal - commission - fulfilmentCost
platformRevenue   = commission + platformFee + customerDeliveryCharge
```

- `fulfilmentCost` is the Shiprocket bill for automatic deliveries, or the platform's own
  per-order fee when a platform delivery partner completed it. Delivery cost is borne by
  the seller, by design.
- Customer-facing delivery and platform charges are collected into the platform's Razorpay
  account with `payment_capture: 1`.
- `/api/commission/summary` reports all of these itemised, so the Razorpay balance can be
  reconciled against recorded revenue.

**Payouts never report a lie.** `transferFunds()` returns a real gateway id or it returns
`success: false`; the payout then stays `pending` (nothing initiated) or moves to `failed`
(rejected). Earlier revisions of this code returned a fabricated `tr_mock_...` id and a
random 90% pass rate, which marked payouts complete against receipts that never existed.
That has been removed.

Cash-on-delivery orders flip to `paymentStatus: completed` when the seller marks them
delivered, because the money is collected at the doorstep. They are otherwise settled the
same way.

### Delivery-partner payouts

A separate Razorpay account handles partner withdrawals: Rs. 10 per km, one withdrawal per
calendar day, flat Rs. 3 per started Rs. 50 slab kept by the platform. The partner ledger
lives on the `DeliveryPartner` document (`totalEarnings`, `totalWithdrawn`, `withdrawals[]`).

---

## Catalogue model

- **Manufacturer** owns a brand and publishes products. Each listing carries the mandatory
  attributes the storefront filters on: `frameShape` (rectangle, cat eye, oval, aviator,
  geometric, round, square, wayfarer), `frameType` (full rim, half rim, rimless) and
  `frameMaterial` (acetate, metal, polycarbonate, stainless steel, TR90, titanium). Bulk
  uploads go through validation that rejects mixed sunglasses/eyeglasses files.
- **Verification** is per product: `pending -> verified`, or `data_incorrect` so the
  manufacturer can amend and resubmit. Only verified listings appear on the marketplace.
- **Sellers** (independent and manufacturer-appointed) decide which brand products they
  stock, at what price and discount, and set `isReturnable` / `isExchangeable` per product.
  Those flags, plus the delivery window, gate the customer return portal.
- **Stored enum spellings vary** (`'Cat Eye'` vs `'cateye'`, `'stainless-steel'` vs
  `'Stainless Steel'`), so the product router normalises filter values instead of requiring
  an exact match. Category slugs are normalised the same way: `contact-lenses` resolves to
  the stored `contactlenses`.

---

## Order routing

When an order is placed, the platform finds sellers within 5-10 km of the buyer who stock
that exact configuration (brand, product, colour, size, gender - power/lens choice is not
matched). Up to five are offered the order in sequence with a 30-minute acceptance timer;
if nobody accepts it falls back to the admin queue with the candidates' contact details. An
AI fallback (`aiFallbackAssignment`) scores candidates on distance, rating, sales history
and current open-order count when no administrator is available.

---

## Realtime

Socket.IO rooms drive live seller notifications. The server joins sockets to
`seller_<id>`, `order_<id>`, `user_<id>` and `admin_room` using the same event names the
client emits. Low-stock thresholds emit `inventory_alert` to the owning seller's room.

---

## Limits

| Rule | Value | Enforced |
| --- | --- | --- |
| Cart line items | 25 | client and server |
| Wishlist (signed in) | 30 | client and server |
| Wishlist (guest) | 3 | client |
| Return window | from delivery date | server |
| Order acceptance timeout | 30 min | server |
| Partner withdrawal | 1 per calendar day | server |

---

## Design

The interface is a deliberate blend: Flipkart's density and utility for commerce surfaces,
Lenskart's guided flows for eyewear specifically, and an Apple-ish restraint in the chrome -
one accent colour, flat white cards with hairline borders, no decorative gradients, no
underlined text except inline prose links, one typeface (Montserrat) across the product.

The brand mark is a two-lens glyph in `client/src/components/Logo.js`, reused in the header,
footer, admin sidebar, auth cards, and as `client/public/favicon.svg`.

---

## External services

<a id="external-services"></a>

Code paths exist for each of these and fail closed rather than pretending to succeed:

| Service | Needed for | Behaviour without credentials |
| --- | --- | --- |
| Razorpay | customer checkout | order creation reports the gateway is unavailable; COD still works |
| Razorpay (2nd account) | delivery-partner withdrawals | withdrawal recorded as not initiated, balance intact |
| RazorpayX | automated seller payouts | payout stays `pending` with `awaiting_settlement` and a reason |
| Shiprocket | automatic pickup/label | routing falls back to the platform's own partners |
| SMTP | OTP and transactional email | OTP is stored and logged, not delivered |
| OpenAI | prescription check, chatbot | rule-based fallback responses |
| AWS Rekognition / Google Vision | face-shape detection | guidance page still works without it |

Set the corresponding variables in `server/.env` to enable each one.

---

## Scripts

| Command | Effect |
| --- | --- |
| `cd server && npm run dev` | API with reload |
| `cd server && npm start` | API |
| `cd server && node seed.js` | reseed only |
| `cd client && npm start` | dev server on :3000, `/api` proxied |
| `cd client && npm run build` | production bundle in `client/build` |

## Contributing

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the request/data flow and
[OPERATIONS.md](OPERATIONS.md) for deployment and troubleshooting. Do not add
"coming soon" placeholders: either wire a feature to real data or leave it out and note it
in `OPERATIONS.md`.
