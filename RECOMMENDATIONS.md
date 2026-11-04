# Recommendations

What this platform should add next, ordered by what actually costs sellers and
buyers today. Each entry says why it matters here specifically, not generically.

## Verified now, for reference

These were asked for and are working: variant-level stock with automatic deduct
and restore, proximity routing that runs from order placement, per-listing
"sell with price" declaration, the seven-working-day price-change email
approval, per-product return windows, contact-lens configuration with per-product
power ranges, powered sunglasses as a browsable branch, seller price listings,
real-time inventory alerts, inventory and return analytics, delivery route
optimisation, self-service returns with uploads, working-partner admin view, and
delivery-partner payouts on a second Razorpay account.

---

## Buy side

**1. Prescription capture as a reusable object.**
A customer enters powers once per eye, then reuses them across spectacles,
sunglasses and contact lenses. Today the spectacle configurator and the lens
configurator each take values independently, so a repeat customer retypes a
prescription each time. The `User.prescriptions` array already exists; give it an
"active prescription" pointer and pre-fill both configurators from it.

**2. Try-on that informs the recommendation.**
Face-shape detection currently advises; it does not restrict. A rectangle face
with an oversized round frame converts poorly. Mark each frame `flatters:
['rectangle', 'oval']` on the manufacturer record and let the browse filter by
"recommended for your face", which is the single highest-value Lenskart-style
feature missing here.

**3. Power-accuracy backstop at checkout.**
A wrong sphere is the largest source of remakes and returns. Beyond the range
check already in place: flag implausible pairs (a ±0.25 sphere with a −5.00 ADD),
an axis that repeats exactly between eyes, and powers outside the last order by
more than 1.00 D. Ask the customer to confirm rather than blocking.

**4. Contact-lens subscription / reorder reminders.**
Derived entirely from data already stored: `replacementPeriod` times
`lensesPerBox` gives the exhaustion date. A one-tap reorder at day N-5 with the
last power set attached is the highest-retention feature available to a lens
business, and it uses no new data.

**5. Partial delivery and per-seller fulfilment state.**
A mixed-basket order is split into one order per seller at placement (correct),
but the buyer sees them as separate orders with no parent reference. Add
`parentCheckout` and a combined tracking view so "where is my order" has one
answer.

**6. Delivery promise at checkout, not after.**
The routing engine already knows the distance and the seller. Show "arrives by
Thursday" before payment, computed from seller distance plus that seller's average
dispatch time, rather than a generic range.

**7. Store pickup.**
Sellers are physical shops with coordinates and stock. "Collect from a shop near
you" removes the entire delivery charge and the Rs. 59 line for that order, and it
is the one advantage a multi-store marketplace has over a warehouse.

**8. Guest checkout with account merge.**
Cart is capped at 25 and requires sign-in, which loses buyers at exactly the
moment of highest intent. Allow checkout with an email only, then merge the order
into the account when they set a password.

---

## Seller and retailer panels

**9. A single stock ledger the seller can read.**
`stockMovementLog` exists but nothing shows it to them. A "why did this change?"
list (sale, cancellation, refund, correction, restock) is the number-one support
question any inventory system generates and needs no new data.

**10. Price-change proposals for retailers too.**
Manufacturer-appointed retailers currently get the same listing model but only
the parent approves their price. Surface the pending proposal in the
manufacturer's panel as well, since they set the brand's price floor.

**11. Bulk price and stock editing from a spreadsheet.**
Sellers with 30+ listings edit one at a time. Same round-trip already solved for
manufacturers: download the sheet for their listings, upload it back, validate,
propose, and the seller accepts once.

**12. Refusal reason capture with a route back.**
Sellers decline orders today with no structured reason. Recording "out of stock
at my store", "cannot deliver in time" or "colour unavailable" is what trains the
routing order and is currently invisible, so the same unsuitable seller keeps
being offered the item.

**13. Payout forecasting.**
A seller can see paid-out amounts but not what is accruing. "Rs. 4,120 pending,
available 14 Nov" is a materially better dashboard than a list of past payouts.

**14. Store-level public page.**
`/products?sellerCode=` filters listings, but there is no shop identity page with
its address, hours, ratings and stock, which is what makes a local marketplace
feel trustworthy.

---

## Operations: executives, staff, admin

**15. Executive queues for every department, not just delivery.**
The delivery executive has order, customer, seller and journey data. Product
verification, seller management and finance executives currently reach generic
lists. The department field already exists on the Executive record; give each one
its queue with search and the same journey detail.

**16. Staff and executive delegation with a manager tier.**
An executive as manager over named staff, with work assigned to a person and
escalating if untouched, is the missing piece for verification backlog: today any
staff member with the permission can act, but nobody owns the queue.

**17. SLA clocks in the admin console.**
Acceptance windows (30 min) already expire. Surface remaining time per order
across the queue and let the sweep escalate at half the window rather than only
at zero.

**18. A single operational search.**
Search is implemented per table. One command-top search crossing orders, sellers,
products, users and partners, with the typeahead routing to the right filtered
list, is what makes an admin console fast.

**19. Audit log with actor and reason.**
`overridePriceChange` stores an admin id; verification stores who approved.
Promote this into one `AuditLog` collection so "who changed this and why" has an
answer beyond the specific screen that recorded it.

**20. Notification fan-out controls.**
Status emails, offers and price proposals all mail separately today. An
admin-visible preference per seller (and a working unsubscribed state) prevents
the inevitable complaint that arrives as a spam report.

---

## Platform and trust

**21. Return-fraud signals.**
Return analytics show rates by product and seller, which is measurement without
action. Flag: high return frequency from one buyer, returns clustered on high-
value SKUs, exchange-then-refund chains. Sellers need protection from serial
returners before they leave the platform.

**22. Genuine product assurance.**
Authenticity is the premise of a branded-eyewear marketplace, and counterfeit
goods are its existential risk. Capture a manufacturer serial or batch code at
pack time and check it against the manufacturer record.

**23. Coupon spend governance.**
Per-user spend caps, stacking rules and expiry reminders exist in the model
partially; a coupon that can be applied by an internal test account in
production is a leak, so add a redemptions ledger with alerting before
marketing budgets grow.

**24. Regional language and address formats.**
Delivery addresses are the most common failure point in Indian logistics. Offer
an address-format hint per PIN region and support a landmark field, which is
routinely what the delivery partner actually uses.

---

## Engineering debt worth clearing before the next feature

- Reconcile the browser-side and server-side required-field lists for
  manufacturers into one shared definition; they are hand-maintained twice.
- Move sponsored-products to a single query.
- Fold the two product-clone flows (manufacturer listings and
  manufacturer-seller listings) onto the shared `SellerStock` model so retailers
  and sellers route identically.
- Delete `StockReservation` or finish it; a half-implemented reservation path is
  more dangerous than none because it invites use.
- Replace the remaining `console.log` boot output with one structured logger
  before there is staging to debug, so production and development logs match.

## Executive staff endpoints have no screen

`GET/POST/DELETE /api/executive/staff` exist and are guarded, but nothing in the client
calls them: an executive's own staff records (`ExecutiveStaff`) can only be created
against an interface nobody uses, while the admin Staff screen manages a different model
(`User` with role `staff`). Either the desk grows a Team section or those routes should be
removed; leaving both invites staff logins that no interface can reach.

## The cart is browser-local

`optikart_cart` in localStorage is the cart of record. `/api/cart` is fully implemented
(add, list, clear, lens and contact-lens variants) but `CartContext` never calls it, so a
cart does not follow a customer to another device and the server's totals are advisory.
