# Architecture

How a request actually moves through OptiKart, and which file owns which decision.
This document exists so the next contributor can find the right seam without reading
250 files.

## Process topology

```
Browser (React SPA, :3000 in dev)
  |
  |  /api/*            (CRA proxy in dev; same-origin when Express serves client/build)
  |  ws  /socket.io    (same origin as the page, see client/src/services/socket.js)
  v
server/server.js
  |- express.json (50mb)         big payloads for image/link based bulk uploads
  |- /uploads static             device-uploaded banners, products, prescriptions
  |- apiLimiter                  every non-GET request
  |- 40 routers under /api/*
  `- Socket.IO server            rooms: seller_<id>, order_<id>, user_<id>, admin_room
```

`trust proxy` is an explicit hop count taken from `TRUST_PROXY_HOPS` - never `true`.
Clients must not be able to choose the IP that the rate limiter and audit logs key on.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Models | `server/models/` | Mongoose schemas, enums, derived amounts, pre-save defaults |
| Middleware | `server/middleware/auth.js` | one verifier per principal, plus `verifyAnyPrincipal` |
| Routes | `server/routes/` | HTTP shape, ownership checks, status-code correctness |
| Services | `server/services/` | domain logic: settlement, routing, inventory, notifications |
| Client services | `client/src/services/` | axios instance, response helpers, error text |
| Client state | `client/src/contexts/` | AuthContext, CartContext, UserBehaviorContext |

The rule that keeps this maintainable: **routes never reimplement arithmetic that a service
already owns.** Commission, settlement and eligibility live in `services/`, so the admin
panel, the seller panel and the webhook all agree by construction.

## Authentication

Eight principals share one JWT secret but not one verifier, because their tokens carry
different claims:

| Principal | Token claims | Verifier | Sends |
| --- | --- | --- | --- |
| Customer | `id`, `userId` | `verifyToken` | `Authorization: Bearer` |
| Seller | `id`, `sellerId` | `verifySeller` | same |
| Admin | `id`, `role: admin` | `verifyToken` + `verifyAdmin` | same |
| Staff | customer token + `StaffRole` by email | `verifyStaff` | same |
| Executive | `id`, `executiveId` | `verifyExecutive` | same |
| Manufacturer | `id`, `manufacturerId` | `verifyManufacturer` | same |
| Manufacturer seller | `id`, `sellerId` | `verifyManufacturerSeller` | same |
| Delivery partner | `id`, `partnerId` | `verifyDeliveryPartner` | same |

Two rules that prevent whole classes of bug:

1. **Do not chain `verifyToken` in front of a role verifier.** A seller token carries no
   customer `_id`, so the chain answers 401 and the client drops a valid session. Use the
   role verifier alone, or `verifyAnyPrincipal` when an endpoint is genuinely shared.
2. **401 means the session is broken - nothing else.** A resource that does not apply to
   this principal returns 200 with an empty list or 403, never 401. The axios interceptor
   treats 401 as logout, so any misuse turns an optional call into a signed-out user.

`AuthContext` persists `{token, role, user}` plus a per-role expiry in `localStorage`, and
rehydrates on boot by calling the right `/me` for the stored role. Every new role must be
added to that branch list or its sessions will not survive a refresh.

## Session and error plumbing

`client/src/services/api.js` holds one axios instance. `apiResponse.js` provides
`listOf` / `oneOf` / `cartItemsOf` / `wishlistItemsOf`, which is how the client tolerates
the fact that different routers return their collections under different keys
(`products`, `orders`, `blogs`, `articles`, `data`, ...). When you add an endpoint, either
match an existing key or extend that list - do not silently invent a new one.

`client/src/services/errors.js` turns an axios failure into a sentence a user can act on.
Never surface a bare `"Failed to load X"`; that is how a five-second investigation becomes
a five-minute one.

## Checkout and order creation

```
CartContext (localStorage)  ->  POST /api/orders
                                 |
                                 +- split by product.seller => one Order row per seller
                                 +- subtotal, deliveryCharge, platformFee, coupon
                                 +- commissionAmount recorded as an estimate
                                 +- stock decremented (product and matching variant)
                                 +- server cart cleared, confirmation emailed
                                 v
                          orderStatus: 'pending'
```

Mixed carts therefore produce multiple orders; anything that reports "an order" must handle
the array that `POST /orders` returns.

The lifecycle the API will accept (enforced in `routes/seller.js`):

```
pending -> confirmed -> packed -> picked_up -> in_transit -> delivered
   \__________-> cancelled (only before packing)                 |
                                          return_requested -> returned
```

Status writes append a `deliveryJourney` entry, which is what the customer-facing tracking
timeline and the delivery-executive view render.

## Money flow

`services/commissionTracking.js` owns the arithmetic; `recordCommission` is the single place
that mutates order and seller totals.

```
merchandise subtotal
  - commission (3% of merchandise, or the product's own commissionPercentage)
  - fulfilment cost        (shiprocketDeliveryCharge | deliveryFee when self-delivered)
  = netAmountToSeller

platform revenue = commission + platformFee + customer delivery charge
```

The customer's payment is captured with `payment_capture: 1`, so the whole amount lands in
the platform's Razorpay account and sellers are paid out of it.

`settleDeliveredOrder()` is called at every transition into `delivered`: seller status
update, executive status update, Shiprocket webhook, partner completion. It is idempotent
via `commissionRecorded`, so double calls are harmless and no admin button press is needed.

Seller payout runs (`services/sellerPayout.js`) recompute from the same numbers, so the
statement and the ledger reconcile. Settlement calls the gateway and records the real
transfer id; with no gateway it leaves the payout `pending` rather than inventing one.

## Order routing

`services/proximityOrderRouting.js` finds stocked sellers near the buyer, then
`orderRoutingIntegration.js` walks up to five in order with a 30-minute acceptance window.
The `OrderRouting` document is the audit trail - who was offered, who answered, who timed
out - and `assignmentStatus: 'admin_required'` is the state the admin queue shows with
contact details. `aiFallbackAssignment` scores on distance, rating, sales history and the
seller's current open-order count.

## Uploads

Every image a human supplies is a file upload, never a pasted URL - the home carousel
banners included. `middleware/upload.js` routes field names into
`server/uploads/{products,prescriptions,store,avatars,blogs,banners}` and those bytes are
served from `/uploads`. `uploads/` is gitignored runtime storage.

## Frontend routing

`client/src/App.js` lazily loads every route and guards panels with one `ProtectedRoute`
keyed on `allowedRoles`. Routes must be registered the moment a page exists: the catch-all
`<Route path="*">` redirects to `/`, so an unregistered link looks exactly like a dead
button rather than an error.

## Things not to reintroduce

- Simulated success: fabricated ids, random pass rates, placeholder "coming soon" screens.
- A second copy of a component that already exists (`Header` replaced an older `Navbar`).
- Charge bases that include delivery or fees, which over-bill sellers.
- `text-decoration` on ordinary navigation links; affordance comes from colour and weight.
