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
  when `NODE_ENV` is not `production`. Each role keeps an allow-list in its route module and
  it must match `server/seed.js`, or the printed login quietly demands an OTP that never arrives.
- `AI_ORDER_ASSIGNMENT` - when `true`, an offer nobody answered is assigned by the scoring
  fallback instead of waiting for an administrator.

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

## Contact lens flows

Contact lenses are configured per correction type, because the numbers a prescription
carries differ by lens:

| Entry | What the customer gives |
| --- | --- |
| Distance power | Sphere per eye |
| Toric / cylindrical | Sphere, cylinder and axis per eye |
| Multi-focal | Sphere and ADD per eye |
| Colour, zero power | Nothing; shade, base curve, diameter |
| Colour, with power | Sphere per eye, plus the shade |
| Colour combos | None - a shade per weekday, Buy Now |
| Solution | Bottle volume and pack size, priced per pack |
| Accessories | Case type, compartments, colour |

Ranges come from the product (`contactLens.SphereLeftMin/Max`, cylinder and axis
ranges, ADD range), so a -9.50 sphere in a lens stocked only to -9.00 is refused
before payment with a message naming the eye and the limit. Zero power is offered
only where `allowsZeroPower` is true, i.e. colour and cosmetic stock. The rules
exist once per side: `client/src/utils/contactLensPowers.js` builds the pickers and
`server/services/contactLensRules.js` decides, so a hand-crafted request cannot
bypass either. Sunglasses that the maker declared glazable offer the same choice
between Buy Now and the lens flow.

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
- **Browse taxonomy** lives in `client/src/utils/catalogTaxonomy.js`. One
  description drives the nav, the filter rails and the routing constraints, so a
  contact-lens list offers replacement period, box size and correction type and never
  rim type. Sunglasses, eyeglasses, kids, solution, accessories and each contact-lens
  correction type share this file.
- **Powered eyewear** is a declaration, not a category. The manufacturer states
  `poweredOptionsAvailable` and which prescription lens types the lab makes for that
  frame; each seller then decides per listing whether to sell it with power
  (`SellerStock.sellsWithPower`). A buyer of a powered-capable frame from an opted-in
  seller sees the lens flow; everyone else sees Buy Now. Proximity routing offers a
  prescription order only to sellers who opted in.
- **Kids frames** carry `subGender` (boys/girls) and `ageGroup`, mandatory on single
  add and on bulk upload, so the kids browse can split age and colour without
  inventing another top-level category.
- **Frame sizes are typed**, e.g. `54-16-135`, rather than a small/medium/large
  picklist, so an optician reading a temple marking can find the same frame here.
- **Bulk uploads must be one category per file.** A sheet mixing sunglasses with
  eyeglasses is rejected outright, since the alternative is half a catalogue filed
  under whichever category the importer guessed.
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

## Seller stock, variants and returns

Every stock movement goes through `services/stockMovement.js`, so the seller's
inventory view and the storefront cannot drift apart.

- Each listing carries colour/size/gender variants with their own price, discount,
  stock and SKU. `product.stock` is the sum of active variant stock.
- Orders match the exact variant the buyer configured. Availability and price both
  come from that variant; loose matching is not used, so an ordered item can never
  drain whichever variant happens to be first.
- On delivery, commission and payout are recorded automatically (see Money model).
- Cancellations, refunded returns and completed exchanges put the units back into
  the same variant they came from, and each movement is written to
  `product.stockMovementLog` with order reference and reason, so a stock figure can
  always be explained and a reversal is never applied twice.
- `SellerStock` records which seller actually carries which brand product, at their
  own selling price and per-variant quantity. This is what makes proximity routing
  and "which seller sells this exact colour/size" answerable.

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
| Per-line quantity | 10 | client and server |
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

| SMTP | login OTP, order confirmations, order status changes, seller and delivery-partner offers, no-seller-accepted escalation, price change and listing audit mails | Skipped with a log line; routing still cascades, so ordering never depends on mail |

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

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the request/data flow,
[OPERATIONS.md](OPERATIONS.md) for deployment and troubleshooting,
[LOGINS.md](LOGINS.md) for the seeded demo accounts and where each one signs in,
and [RECOMMENDATIONS.md](RECOMMENDATIONS.md) for what to build next and why.

Do not add "coming soon" placeholders: either wire a feature to real data, or leave
it out and record it in `RECOMMENDATIONS.md` so the gap is deliberate rather than
silent.
