# Remaining Tasks - Complete List

## HIGH PRIORITY (Implementing Now)

### 1. Home Page Redesign
- [ ] Show manufacturer products brand-wise
- [ ] Add face shape categories
- [ ] Add frame type categories
- [ ] Add material categories
- [ ] Lenskart-style layout

### 2. Product Page Enhancements
- [ ] "Choose Lenses" for eyeglasses (not Buy Now)
- [ ] "Buy Now" for sunglasses
- [ ] Lens selection flow with pricing
- [ ] Prescription upload with AI verification
- [ ] Power entry form
- [ ] Product description like Lenskart

### 3. Cart & Wishlist Limits
- [ ] Cart capped at 25 items (logged in)
- [ ] Wishlist capped at 30 items (logged in)
- [ ] Wishlist capped at 3 items (not logged in)

### 4. Typography
- [ ] Add Playfair Display font for headings
- [ ] Keep Inter for body text

### 5. Contact Lenses Flow
- [ ] Distance power flow
- [ ] Toric/cylindrical flow
- [ ] Multi-focal flow
- [ ] Color combos
- [ ] Solutions & accessories
- [ ] Box quantity management

### 6. Product Verification
- [ ] Pending/Verified/Rejected status
- [ ] Email notifications
- [ ] 7-day acceptance timeline
- [ ] Admin verification interface

### 7. Executive Dashboards
- [ ] Delivery executive detailed dashboard
- [ ] Product tracking
- [ ] Customer data access
- [ ] Delivery journey visualization

### 8. Delivery Partner System
- [ ] Razorpay2 integration
- [ ] 10 INR/km fee calculation
- [ ] Withdrawal system (3 INR fee per 50 INR)
- [ ] Working delivery partners admin view

### 9. Banner Management
- [ ] Upload from device (no links)
- [ ] Discount configuration
- [ ] Min/max price filters

### 10. Order Routing Integration
- [ ] Integrate proximity service into actual order flow
- [ ] Admin order assignment UI
- [ ] 30-min timer implementation
- [ ] AI fallback for automatic assignment

### 11. Manufacturer Enhancements
- [ ] Manufacturer seller deletable/bannable
- [ ] Executive & staff for manufacturer sellers
- [ ] Bulk upload validation
- [ ] Image link auto-conversion

### 12. Search & Filters
- [ ] Global search for all roles
- [ ] Advanced product filters
- [ ] Category-wise sorting

## MEDIUM PRIORITY

### 13. Email Notifications
- [ ] Product update notifications
- [ ] Price change notifications
- [ ] Order status notifications

### 14. Commission Integration
- [ ] Auto-record on delivery
- [ ] Commission to Razorpay account
- [ ] Delivery charge from seller

### 15. Product Categorization
- [ ] Mandatory face shape field
- [ ] Mandatory frame type field
- [ ] Mandatory material field
- [ ] Validation on product creation

## STATUS

Everything below in "Completed" is wired end to end (server route + client call +
UI) and was verified running against a local MongoDB with the seeded dataset.

### Completed and verified

- Home page: hero carousel (device-uploaded banners), trust strip, category grid,
  offer cards, gender section, face-shape / frame-type / material rails,
  brand-wise manufacturer catalogue, trending / deals / new arrivals / best sellers.
- `/products` browse page with working facet filters (face shape, frame type,
  material, gender, size, price band, brand, seller store) and pagination.
- Category routing: nav slugs (`contact-lenses`) are normalised to the stored
  enum (`contactlenses`) on the server, so every category page returns results.
- Sunglasses show **Buy Now**; eyeglasses show **Choose Lenses**, which opens the
  lens configuration flow and stores the chosen lens/power config on the cart line.
- Cart capped at 25 items; wishlist capped at 30 (signed in) and 3 (guest),
  enforced on the server as well as the client.
- Seller return/exchange toggle per product, persisted and enforced by the
  customer return portal (deliver window + per-product flags + duplicates).
- Real-time inventory alerts: server now listens for the room events the client
  emits (`joinSellerRoom`, `joinOrderRoom`, ...), so alerts reach the seller.
- Inventory analytics, return analytics (seller and admin), delivery route
  optimisation, customer return portal with photo upload.
- Product verification queue (pending / verified / data-incorrect) with admin UI.
- Order routing: proximity candidates, admin assignment, 30-minute acceptance
  window, next-in-line fallback, "no seller chose it" state with contact details.
- Executive dashboards rebuilt against real data (previously hardcoded numbers):
  deliveries with customer and seller detail, customers, reports, and a
  per-order delivery journey.
- Staff subsystem rebuilt from scratch: `/api/staff/*` endpoints (overview,
  orders, products, blogs, returns) plus a real workspace UI. The nine
  "Coming Soon" placeholders are gone.
- Delivery partners: admin-created logins, OTP flow, earnings ledger, one
  withdrawal per day with the flat Rs. 3 per Rs. 50 slab fee recorded.
- Subscription removed completely (model, payment routes, admin dashboard,
  seller model, seed data, FAQ). Commission model replaced it.
- Typography: single Montserrat family everywhere; Playfair Display and Roboto
  removed, including the inline `@import` in the navbar styles.
- No-emoji policy applied across the UI; icons come from react-icons.
- Broken-image cleanup: seed generates real PNG product placeholders; external
  Unsplash/Wikipedia URLs replaced with local assets.
- Fixed guaranteed runtime crashes where pages called API methods or response
  keys that did not exist (banners CRUD, cart/wishlist/blog/help/orders paths).
- Fixed the session-wipe bug: a 401 from an optional background call is no
  longer treated as a logout, and role-specific endpoints (`/delivery-partner/me`,
  `/notifications`, `/commission/*`) accept the tokens that actually call them.
- Fixed OTP generation: `otpGenerator.generate` was passed the digit string
  instead of a length, producing thousand-digit OTPs that no 6-digit form could
  ever match. All ten call sites now generate 6-digit codes.
- Rate limits no longer lock out normal browsing, and staff creation honours the
  password the admin supplies instead of discarding it.

### Requires live third-party credentials (code paths exist, cannot complete here)

- Razorpay (customer payments) and Razorpay2 (delivery-partner payouts) live keys;
  without them orders are created and the ledger is written, but no real money moves.
- Shiprocket production API credentials for automated pickup order creation.
- SMTP credentials for the OTP emails. Until they are set, logins only work in
  development, where the seeded test accounts may skip the second factor; that
  skip is disabled when `NODE_ENV=production` (or `AUTH_OTP_BYPASS=false`).
- OpenAI / AWS Rekognition / Google Vision keys for the AI prescription check,
  face-shape detection and chatbot answers.

### Not built (larger product decisions, listed so nothing is hidden)

- Native mobile apps; driver PWA background location tracking.
- Warehouse/bin-level stock transfers and supplier purchase orders.
- Coupon spend limits, sponsored-product A/B testing and remarketing feeds.
- Multi-currency and GST-return filing reports (commission reporting exists instead).

