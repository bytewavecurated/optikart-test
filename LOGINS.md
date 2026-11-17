# Demo logins

Created by `server/fixtures/` and applied by the test harness (or explicitly, with
`npm run fixtures:apply` from `server/`). They are NOT loaded at boot any more: the
application no longer imports the demo dataset in any environment, because that
dataset opens by deleting the eleven collections it owns and boot used to run it
whenever the database looked empty - including when `MONGODB_URI` looked like a
different database than intended. See the warning below before using these on
anything shared. Printed to the server
terminal. Use these to open any panel without going through sign-up.

Sign-in works without an email OTP in development because the seeded accounts are
on each endpoint's bypass list. Set `NODE_ENV=production` (or `AUTH_OTP_BYPASS=false`)
and every login requires the emailed code again.

| Role                                                                                                                                           | Sign-in page                                    | Email                              | Password           |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------- | ------------------ |
| Customer                                                                                                                                       | http://localhost:3000/login                     | `demo@optikart.com`                | `Demo123@`         |
| Customer (2nd)                                                                                                                                 | http://localhost:3000/login                     | `testuser@optikart.com`            | `Test123@`         |
| Admin                                                                                                                                          | http://localhost:3000/admin/login               | `samedayopticians@gmail.com`       | `Sameday123@`      |
| Staff (seller manager)                                                                                                                         | http://localhost:3000/staff/login               | `priya.staff@optikart.com`         | `Staff123@`        |
| Staff (prescription checks)                                                                                                                    | http://localhost:3000/staff/login               | `meera.staff@optikart.com`         | `Staff123@`        |
| Seller                                                                                                                                         | http://localhost:3000/seller/login              | `opticalworld@gmail.com`           | `Seller123@`       |
| Seller (has catalogue)                                                                                                                         | http://localhost:3000/seller/login              | `visioncare@gmail.com`             | `Seller123@`       |
| Seller                                                                                                                                         | http://localhost:3000/seller/login              | `lensstudio@gmail.com`             | `Seller123@`       |
| Seller                                                                                                                                         | http://localhost:3000/seller/login              | `eyefashion@gmail.com`             | `Seller123@`       |
| Executive (delivery)                                                                                                                           | http://localhost:3000/executive/login           | `executive.delivery@optikart.com`  | `Executive123@`    |
| Manufacturer                                                                                                                                   | http://localhost:3000/manufacturer/login        | `rayban.manufacturer@optikart.com` | `Manufacturer123@` |
| Manufacturer's retailer                                                                                                                        | http://localhost:3000/manufacturer-seller/login | `rayban.retailer1@optikart.com`    | `Retailer123@`     |
| Delivery partner (Bandra)                                                                                                                      | http://localhost:3000/delivery-partner/login    | `suresh.partner@optikart.com`      | `Partner123@`      |
| Delivery partner (Andheri)                                                                                                                     | http://localhost:3000/delivery-partner/login    | `anjali.partner@optikart.com`      | `Partner123@`      |
| Delivery partner (Thane, outside the 4.5 km pickup radius of the Bandra stores)                                                                | http://localhost:3000/delivery-partner/login    | `ramesh.partner@optikart.com`      | `Partner123@`      |
| Delivery partner (Wadala; reserved for the payout-settlement console suite, so its daily withdrawal allowance is never spent by another group) | http://localhost:3000/delivery-partner/login    | `settlements.partner@optikart.com` | `Partner123@`      |

## Where each one lands

| Role                    | After sign-in                    | Worth checking                                                                      |
| ----------------------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| Customer                | `/`                              | Cart with 25-item cap and per-line selection; order tracking on `/orders/:id`       |
| Admin                   | `/admin`                         | Orders, Product Verification, Order Assignment, Delivery Partners, Return Analytics |
| Staff (products)        | `/staff`                         | Queue scoped to `seller_manager`: products awaiting verification                    |
| Seller                  | `/seller/dashboard`              | Inventory shows colour/size stock and price; payouts; commission                    |
| Executive               | `/executive/dashboard`           | Deliveries with customer and seller detail, reports, delivery journey               |
| Manufacturer            | `/manufacturer/dashboard`        | Company and brand editing, seller block/reinstate/edit, pending products            |
| Manufacturer's retailer | `/manufacturer-seller/dashboard` | Only the parent brand's catalogue is offered to stock                               |
| Delivery partner        | `/delivery-partner/dashboard`    | Assigned orders, earnings, one withdrawal per day                                   |

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
- Two sellers per frame have `sellsWithPower` on and the rest off, so a prescription
  order routes to the first but not the second - visible in admin Order Assignment.
- One listing per seller is left with a proposal the platform raised, so
  `/seller/stock` shows the pending price-change prompt without you having to
  trigger one.

## If a login is rejected

| Message                     | Cause                                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Invalid email or password` | The database was repointed or is empty. Restarting does NOT load data any more (boot-time seeding was removed by design); check `MONGODB_URI`, then run `npm run fixtures:apply -- --force --expect-database=<name>` against a throwaway test database. |
| OTP step appears            | You are running with `NODE_ENV=production`, which is intended.                                                                                                                                                                                          |
| `Account locked`            | Three wrong passwords in a row; the lock clears after 3 minutes.                                                                                                                                                                                        |

## Warning: these accounts are for a test database only

Every password in this file is public, by design, so a database holding them is a
playground and not a shop. The dataset that creates them **deletes the collections
it owns before writing** - users, shops, products, stock rows, coupons, blogs,
help articles, executives, manufacturers, retailer shops, delivery partners, staff
roles - which is why it cannot be applied to anything containing real data, and why
it is no longer reachable from the application's startup path.

`fixtures/apply.mjs` therefore needs `--force` to overwrite a populated database and
recommends `--expect-database=<name>`, which refuses the run when the connection is
not the one you named. A mistyped URI looks exactly like an empty database.

**Removing demo data before going live** (demo accounts, then catalogue + brands +
stock rows with the second confirmation):

```bash
cd server
DANGEROUS_CONFIRM=yes npm run deprovision:demo
DANGEROUS_CONFIRM=yes REMOVE_DEMO_CATALOGUE=yes npm run deprovision:demo
```

The second command deletes **every** product, brand and stock row in that database,
including real ones - it is keyed by collection, not by demo identity, and says so in
its own output. Afterward a fresh production database has no accounts at all: create
the first administrator with `BOOTSTRAP_ADMIN_EMAIL` and a strong
`BOOTSTRAP_ADMIN_PASSWORD`, and the operator then builds manufacturers, brands,
products and partners through the app itself, which is the structure those surfaces
are organised around.
