# Demo logins

Seeded by `server/seed.js` on every development boot and printed to the server
terminal. Use these to open any panel without going through sign-up.

Sign-in works without an email OTP in development because the seeded accounts are
on each endpoint's bypass list. Set `NODE_ENV=production` (or `AUTH_OTP_BYPASS=false`)
and every login requires the emailed code again.

| Role | Sign-in page | Email | Password |
| --- | --- | --- | --- |
| Customer | http://localhost:3000/login | `demo@optikart.com` | `Demo123@` |
| Customer (2nd) | http://localhost:3000/login | `testuser@optikart.com` | `Test123@` |
| Admin | http://localhost:3000/admin/login | `samedayopticians@gmail.com` | `Sameday123@` |
| Staff (seller manager) | http://localhost:3000/staff/login | `priya.staff@optikart.com` | `Staff123@` |
| Seller | http://localhost:3000/seller/login | `opticalworld@gmail.com` | `Seller123@` |
| Seller (has catalogue) | http://localhost:3000/seller/login | `visioncare@gmail.com` | `Seller123@` |
| Seller | http://localhost:3000/seller/login | `lensstudio@gmail.com` | `Seller123@` |
| Seller | http://localhost:3000/seller/login | `eyefashion@gmail.com` | `Seller123@` |
| Executive (delivery) | http://localhost:3000/executive/login | `executive.delivery@optikart.com` | `Executive123@` |
| Manufacturer | http://localhost:3000/manufacturer/login | `rayban.manufacturer@optikart.com` | `Manufacturer123@` |
| Manufacturer's retailer | http://localhost:3000/manufacturer-seller/login | `rayban.retailer1@optikart.com` | `Retailer123@` |
| Delivery partner | http://localhost:3000/delivery-partner/login | `suresh.partner@optikart.com` | `Partner123@` |

## Where each one lands

| Role | After sign-in | Worth checking |
| --- | --- | --- |
| Customer | `/` | Cart with 25-item cap and per-line selection; order tracking on `/orders/:id` |
| Admin | `/admin` | Orders, Product Verification, Order Assignment, Delivery Partners, Return Analytics |
| Staff | `/staff` | Queue scoped to `seller_manager`: products awaiting verification |
| Seller | `/seller/dashboard` | Inventory shows colour/size stock and price; payouts; commission |
| Executive | `/executive/dashboard` | Deliveries with customer and seller detail, reports, delivery journey |
| Manufacturer | `/manufacturer/dashboard` | Company and brand editing, seller block/reinstate/edit, pending products |
| Manufacturer's retailer | `/manufacturer-seller/dashboard` | Only the parent brand's catalogue is offered to stock |
| Delivery partner | `/delivery-partner/dashboard` | Assigned orders, earnings, one withdrawal per day |

## Seeded data you can act on

- 24 products across 15 brands. 22 of them carry full colour/size variants
  (3 colours x 3 sizes on sunglasses and eyeglasses, fewer on kids and sports),
  each variant with its own price, stock and SKU.
- Category spread: 7 sunglasses, 8 eyeglasses, 3 reading glasses, 2 sports,
  2 kids, 2 contact lenses.
- One brand (`Ray-Ban`) is owned by the seeded manufacturer, so manufacturer-only screens
  have real rows rather than an empty table.
- Coupons: `WELCOME10`, `EYEWEAR25`, `SUMMER200`, `FREESHIP`.
- A customer account (`demo@optikart.com`) exists with no orders, so order and return
  screens can be exercised by placing one through the UI.
- Every seller lists every eyewear product as their own `SellerStock` row, so the
  proximity router has real candidates when you place an order in Mumbai.
- All catalogue starts `verified` so the storefront is populated. Un-verify rows from
  admin Product Verification to watch them disappear from `/products` and from the
  sellers' listable catalogue.

## If a login is rejected

| Message | Cause |
| --- | --- |
| `Invalid email or password` | The database was wiped or repointed; restart the server to reseed. |
| OTP step appears | You are running with `NODE_ENV=production`, which is intended. |
| `Account locked` | Three wrong passwords in a row; the lock clears after 3 minutes. |
