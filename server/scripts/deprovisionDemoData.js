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
  sellers: ['opticalworld@gmail.com', 'visioncare@gmail.com', 'lensstudio@gmail.com', 'eyefashion@gmail.com', 'meera12345@rediffmail.com', 'sunil.b@eye-dhiq.com', 'rahul.s@eye-dhiq.com', 'priya.m@eye-dhiq.com', 'kavita.j@eye-dhiq.com', 'arjun.r@eye-dhiq.com'],
  executives: ['executive.delivery@optikart.com'],
  manufacturers: ['rayban.manufacturer@optikart.com'],
  manufacturerSellers: ['rayban.retailer1@optikart.com'],
  partners: ['suresh.partner@optikart.com', 'anjali.partner@optikart.com', 'ramesh.partner@optikart.com']
};

const flat = Object.values(DEMO_ACCOUNTS).flat();

const main = async () => {
  if (process.env.DANGEROUS_CONFIRM !== 'yes') {
    console.error('Set DANGEROUS_CONFIRM=yes to remove demo accounts. This deletes logins that exist in a fresh install.');
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
  const { default: Product } = await import('../models/Product.js');

  const removals = [
    ['users', await User.deleteMany({ email: { $in: flat } })],
    ['seller staff roles', await StaffRole.deleteMany({ email: { $in: flat } })],
    ['sellers', await Seller.deleteMany({ email: { $in: DEMO_ACCOUNTS.sellers } })],
    ['executives', await Executive.deleteMany({ email: { $in: DEMO_ACCOUNTS.executives } })],
    ['manufacturers', await Manufacturer.deleteMany({ email: { $in: DEMO_ACCOUNTS.manufacturers } })],
    ['manufacturer sellers', await ManufacturerSeller.deleteMany({ email: { $in: DEMO_ACCOUNTS.manufacturerSellers } })],
    ['delivery partners', await DeliveryPartner.deleteMany({ email: { $in: DEMO_ACCOUNTS.partners } })]
  ];
  removals.forEach(([label, res]) => console.log(`  removed ${res.deletedCount ?? 0} ${label}`));

  if (process.env.REMOVE_DEMO_CATALOGUE === 'yes') {
    const products = await Product.deleteMany({});
    console.log(`  removed ${products.deletedCount ?? 0} products`);
    console.log('  NOTE: that deleted every product, including any real ones entered into this database.');
  } else {
    console.log('  catalogue left untouched (set REMOVE_DEMO_CATALOGUE=yes to clear products too)');
  }

  const remainingAdmins = await User.countDocuments({ role: 'admin', isActive: true });
  if (!remainingAdmins) {
    console.warn('\nWARNING: no active administrator is left. Set BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD and restart, or the console cannot be reached.');
  }
  await mongoose.disconnect();
  console.log('\nDemo logins removed. Confirm AUTH_OTP_BYPASS is unset or false, and that SMTP is configured, before going live.');
};

main().catch((e) => { console.error('Deprovision failed:', e.message); process.exit(1); });
