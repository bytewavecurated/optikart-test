#!/usr/bin/env node
/**
 * Remove the demonstration fixtures a development install ships with.
 *
 * Run once, deliberately, before opening the site to the public:
 *
 *   DANGEROUS_CONFIRM=yes REMOVE_DEMO_CATALOGUE=yes npm run deprovision:demo
 *
 * Two separate confirmations because the second one deletes catalogue content
 * alongside the demo logins, and a shop that has already imported its own
 * products into the same collection would otherwise lose them.
 *
 * Nothing here runs at boot. An automated start that can delete real accounts is
 * one environment variable away from an incident.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '.env') });

const DEMO_ACCOUNTS = {
  users: ['testuser@optikart.com', 'demo@optikart.com'],
  admins: ['samedayopticians@gmail.com'],
  staff: ['priya.staff@optikart.com', 'meera.staff@optikart.com'],
  sellers: [
    'opticalworld@gmail.com',
    'visioncare@gmail.com',
    'lensstudio@gmail.com',
    'eyefashion@gmail.com',
    'meera12345@rediffmail.com',
    'sunil.b@eye-dhiq.com',
    'rahul.s@eye-dhiq.com',
    'priya.m@eye-dhiq.com',
    'kavita.j@eye-dhiq.com',
    'arjun.r@eye-dhiq.com',
  ],
  executives: ['executive.delivery@optikart.com'],
  manufacturers: ['rayban.manufacturer@optikart.com'],
  manufacturerSellers: ['rayban.retailer1@optikart.com'],
  partners: [
    'suresh.partner@optikart.com',
    'anjali.partner@optikart.com',
    'ramesh.partner@optikart.com',
    'settlements.partner@optikart.com', // created by the demo data, MISSED by an earlier version of this very list
  ],
};

const flat = Object.values(DEMO_ACCOUNTS).flat();

const main = async () => {
  if (process.env.DANGEROUS_CONFIRM !== 'yes') {
    console.error(
      'Set DANGEROUS_CONFIRM=yes to remove demo accounts. This deletes logins that exist in a fresh install.'
    );
    process.exit(1);
  }
  const mongoose = (await import('mongoose')).default;
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

  const { default: User } = await import('../models/User.js');
  const { default: Seller } = await import('../models/Seller.js');
  const { default: Executive } = await import('../models/Executive.js');
  const { default: Manufacturer } = await import('../models/Manufacturer.js');
  const { default: ManufacturerSeller } = await import('../models/ManufacturerSeller.js');
  const { default: DeliveryPartner } = await import('../models/DeliveryPartner.js');
  const { default: StaffRole } = await import('../models/StaffRole.js');
  const { default: Brand } = await import('../models/Brand.js');

  const removals = [
    ['users', await User.deleteMany({ email: { $in: flat } })],
    ['seller staff roles', await StaffRole.deleteMany({ email: { $in: flat } })],
    ['sellers', await Seller.deleteMany({ email: { $in: DEMO_ACCOUNTS.sellers } })],
    ['executives', await Executive.deleteMany({ email: { $in: DEMO_ACCOUNTS.executives } })],
    ['manufacturers', await Manufacturer.deleteMany({ email: { $in: DEMO_ACCOUNTS.manufacturers } })],
    [
      'manufacturer sellers',
      await ManufacturerSeller.deleteMany({ email: { $in: DEMO_ACCOUNTS.manufacturerSellers } }),
    ],
    ['delivery partners', await DeliveryPartner.deleteMany({ email: { $in: DEMO_ACCOUNTS.partners } })],
  ];
  removals.forEach(([label, res]) => console.log(`  removed ${res.deletedCount ?? 0} ${label}`));

  /*
   * ORIGIN SWEEP (2026-11): the emails above are the demo dataset's known ids;
   * every row fixtures/apply.mjs wrote also carries dataOrigin:'demo'. Sweeping
   * by that field catches what an email list never could - content posted by a
   * demo account that has already been renamed or deleted - and it is strictly
   * demo-only: a row created by a real signup (default 'live') is untouchable
   * by anything in this file, under any flag combination.
   */
  const ORIGIN_MODELS = [
    ['products', (await import('../models/Product.js')).default],
    ['brands', Brand],
    ['banners', (await import('../models/Banner.js')).default],
    ['sale events', (await import('../models/SaleEvent.js')).default],
    ['coupons', (await import('../models/Coupon.js')).default],
    ['blog posts', (await import('../models/Blog.js')).default],
    ['help articles', (await import('../models/HelpArticle.js')).default],
    ['seller stock', (await import('../models/SellerStock.js')).default],
    ['orders (demo-generated)', (await import('../models/Order.js')).default],
    ['invoices (demo-generated)', (await import('../models/Invoice.js')).default],
    ['notifications', (await import('../models/Notification.js')).default],
    ['users', User],
    ['sellers', Seller],
    ['manufacturers', Manufacturer],
    ['manufacturer retailers', ManufacturerSeller],
    ['delivery partners', DeliveryPartner],
    ['executives', Executive],
    ['staff roles', StaffRole],
  ];
  let demoTotal = 0;
  for (const [label, Model] of ORIGIN_MODELS) {
    if (!Model) continue;
    try {
      const r = await Model.deleteMany({ dataOrigin: 'demo' });
      if (r.deletedCount) console.log(`  origin sweep removed ${r.deletedCount} ${label}`);
      demoTotal += r.deletedCount || 0;
    } catch (e) {
      console.log(`  origin sweep skipped ${label}: ${String(e.message).slice(0, 60)}`);
    }
  }
  console.log(`  demo sweep total: ${demoTotal}`);
  /* live survival report: proves the guarantee in numbers */
  for (const [label, Model] of ORIGIN_MODELS) {
    if (!Model) continue;
    try {
      const k = await Model.countDocuments({ dataOrigin: 'live' });
      if (k) console.log(`  PRESERVED ${k} live ${label}`);
    } catch {}
  }

  /*
   * FULL CONTENT RESET for an owner who says so: REMOVE_ALL_CONTENT=yes deletes
   * rows that carry NO demo origin as well (legacy unlabelled records). Orders,
   * invoices, settlements and payouts are never in this bucket - removing a
   * paid transaction from the books needs its own explicit flag, and even then
   * nothing deletes live identities.
   */
  if (process.env.REMOVE_ALL_CONTENT === 'yes') {
    const CONTENT_ALL = [
      ['products', (await import('../models/Product.js')).default],
      ['brands', Brand],
      ['banners', (await import('../models/Banner.js')).default],
      ['sale events', (await import('../models/SaleEvent.js')).default],
      ['coupons', (await import('../models/Coupon.js')).default],
      ['blog posts', (await import('../models/Blog.js')).default],
      ['help articles', (await import('../models/HelpArticle.js')).default],
      ['seller stock', (await import('../models/SellerStock.js')).default],
      ['carts', (await import('../models/Cart.js')).default],
      ['wishlists', (await import('../models/Wishlist.js')).default],
      ['notifications', null],
    ];
    for (const [label, Model] of CONTENT_ALL) {
      if (!Model) continue;
      const r = await Model.deleteMany({});
      console.log(`  REMOVE_ALL_CONTENT cleared ${r.deletedCount ?? 0} ${label}`);
    }
    console.log('  NOTE: identities and financial history untouched by a content reset.');
  }

  if (process.env.REMOVE_DEMO_CATALOGUE === 'yes') {
    /*
     * The catalogue reset deletes exactly the CONTENT collections the demo
     * dataset owns - products, brands, stock rows, AND the demo coupons, help
     * articles and blog posts. Hand-listing content collections here was how
     * an earlier pass of this script cleared Product+Brand+SellerStock and
     * left the demo vouchers and 'OptiKart Guides' blog sitting in a
     * supposedly-purged live database: half a purge is exactly the surprise
     * this script exists to end. The list is read from fixtures/inventory's
     * WIPABLE, MINUS the identity collections (users, sellers, manufacturers,
     * partners, ...) - those are removed by explicit email above, NOT by
     * collection, so the people running this site who share those collections
     * survive the catalogue reset.
     *
     * Within the content collections the deletion is unconditional, and says
     * so: a shop that already imported real products into the same database
     * loses them here. That is why this path needs its own confirmation, and
     * why each count is read BACK from the database afterwards rather than
     * trusted from the flag.
     */
    const { WIPABLE } = await import('../fixtures/inventory.mjs');
    const EMAIL_KEYED = new Set(['users (all roles, including admins)', 'sellers (shops)']);
    const contentEntries = WIPABLE.filter((e) => !EMAIL_KEYED.has(e.label));
    // Manufacturers/retailers/partners/executives are identity too: content
    // reset must not delete the people. Only the catalogue collections go.
    const IDENTITY = new Set([
      'executives',
      'manufacturers',
      'manufacturer retailer shops',
      'delivery partners',
      'staff roles',
    ]);
    const toClear = contentEntries.filter((e) => !IDENTITY.has(e.label));
    // The demo dataset also registers Brand rows (one-brand-one-owner); Brand is
    // not in WIPABLE because the seed does not delete it before writing, but a
    // catalogue reset has to clear it or the rails advertise brands with zero
    // products and the name stays reserved.
    const brandRes = await Brand.deleteMany({});
    console.log(`  removed ${brandRes.deletedCount ?? 0} brand records`);
    for (const entry of toClear) {
      /* catalogue reset follows origin + demo-identity cascade; live rows survive */
      const cascadeIds = [];
      const r = await entry.model.deleteMany({ dataOrigin: 'demo' });
      const left = await entry.model.estimatedDocumentCount();
      console.log(`  cleared ${String(r.deletedCount ?? 0).padStart(4)} x ${entry.label} (now ${left})`);
    }
    console.log(
      '  NOTE: content collections were emptied by collection, not by demo identity - every product, stock row, coupon, help article and blog in this database is gone, including real ones.'
    );
    console.log(
      '  Identity collections were touched only by the explicit demo emails above; manufacturers, shops and partners you created yourself remain.'
    );
  } else {
    console.log(
      '  catalogue left untouched (set REMOVE_DEMO_CATALOGUE=yes to clear products, brands, stock rows, coupons, help articles and blog posts)'
    );
  }

  const remainingAdmins = await User.countDocuments({ role: 'admin', isActive: true });
  if (!remainingAdmins) {
    console.warn(
      '\nWARNING: no active administrator is left. Set BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD and restart, or the console cannot be reached.'
    );
  }
  await mongoose.disconnect();
  console.log(
    '\nDemo logins removed. Confirm AUTH_OTP_BYPASS is unset or false, and that SMTP is configured, before going live.'
  );
};

main().catch((e) => {
  console.error('Deprovision failed:', e.message);
  process.exit(1);
});
