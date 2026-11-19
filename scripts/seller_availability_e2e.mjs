#!/usr/bin/env node
/**
 * Seller availability boundary, over the real wire.
 *
 * The feature pinned here answers one question everywhere the storefront
 * speaks: can ANYBODY actually sell what this page is showing? Before
 * services/availability.js the answer came from the manufacturer directory
 * (product.price, product.stock, the whole lens-config space), while the
 * money paths (routing, admin queues) consulted SellerStock - so listings
 * with no willing shop kept live Buy buttons, and buyers reached orders
 * nobody could fulfil. This suite drives each supply state the way shops
 * actually cause them (rows written/paused with the same fields the
 * seller-desk API writes) and requires GET /products/:id, POST /cart/add
 * and POST /cart/add-lens to answer like the routing engine would.
 *
 *   node scripts/seller_availability_e2e.mjs [base-url]  (MONGODB_URI required)
 */
import Seller from '../server/models/Seller.js';
import SellerStock from '../server/models/SellerStock.js';
import Product from '../server/models/Product.js';
import User from '../server/models/User.js';
import Cart from '../server/models/Cart.js';

// scripts/ has no node_modules; borrow the instance the models resolve on.
const mongoose = Product.db.base;

const BASE = process.argv[2] || process.env.VERIFY_BASE || 'http://localhost:3111';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
  return ok;
};

const call = async (path, { token, body } = {}) => {
  const res = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
};

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required (run via scripts/verify.mjs)');
  await mongoose.connect(process.env.MONGODB_URI);

  const customer = (await call('/api/auth/login', { body: { email: 'demo@optikart.com', password: 'Demo123@' } })).json
    ?.token;
  if (!check('customer login', !!customer)) throw new Error('no session');

  // One eyewear product with real variants, taken from what the harness seeded.
  const product = await Product.findOne({ category: 'sunglasses', 'variants.0': { $exists: true } });
  if (!product) throw new Error('fixture has no variant-carrying sunglasses');

  // Isolate by mutating exactly what shops mutate. EVERYTHING here is undone
  // in the finally, whatever happens, because later suites share this database.
  const prevSeller = product.seller;
  let probeStock = null;
  try {
    await SellerStock.deleteMany({ product: product._id });
    await Product.updateOne({ _id: product._id }, { seller: null });

    /* ---------------- state 1: nobody sells this frame ---------------- */
    let view = await call(`/api/products/${product._id}`);
    let avail = view.json?.availability;
    check('GET product reports availability even with zero sellers', !!avail, JSON.stringify(avail || {}).slice(0, 80));
    check('skeleton catalogue frame is NOT sellable', avail?.sellable === false && (avail?.configs || []).length === 0);
    let add = await call('/api/cart/add', { token: customer, body: { productId: String(product._id), quantity: 1 } });
    check(
      'cart/add refuses the nobody-sells frame (409 + unsellable)',
      add.status === 409 && add.json?.unsellable === true,
      add.json?.message
    );

    /* ------- state 2: one shop lists one config and one power type ------- */
    // NOTE for the reader chasing "why is the owner detached through ALL these
    // states": an open owner is, by design, a supply source (legacy direct
    // listings). While the suite asserts what SellerStock rows do to the
    // storefront, no owner may sit underneath them, or "delist everything"
    // would still come up sellable - correctly.
    const shop = await Seller.findOne({ isActive: true, isBanned: false }).select('_id storeName');
    const variant = product.variants[0];
    probeStock = await SellerStock.create({
      seller: shop._id,
      product: product._id,
      brand: product.brand,
      category: product.category,
      sellingPrice: 2999,
      totalStock: 3,
      variants: [{ color: variant.color, size: variant.size, stock: 3, price: null }],
      isListed: true,
      listing: { brandLinked: true, state: 'live' },
      sellsWithPower: true,
      powerLensTypes: ['single-vision'],
    });
    view = await call(`/api/products/${product._id}`);
    avail = view.json.availability;
    check(
      'listed shop makes exactly its configuration buyable at its price',
      avail?.sellable === true &&
        avail.configs.length === 1 &&
        avail.configs[0].buyable === true &&
        avail.configs[0].cheapest === 2999 &&
        avail.configs[0].inStock === 3,
      JSON.stringify(avail?.configs)
    );
    check(
      'powered menu narrows to what the shop offers',
      JSON.stringify(avail?.powered) === '["single-vision"]',
      JSON.stringify(avail?.powered)
    );

    add = await call('/api/cart/add', {
      token: customer,
      body: { productId: String(product._id), quantity: 1, variant: { color: variant.color, size: variant.size } },
    });
    check('cart accepts the held configuration', add.status === 200, add.json?.message);

    const other = product.variants[1] || {};
    add = await call('/api/cart/add', {
      token: customer,
      body: {
        productId: String(product._id),
        quantity: 1,
        variant: { color: other.color || 'Phantom', size: other.size || '00' },
      },
    });
    check(
      'cart refuses a configuration nobody listed',
      add.status === 409 &&
        String(add.json?.message || '')
          .toLowerCase()
          .includes('no shop'),
      add.json?.message
    );

    /* ---------- state 3: the shop pauses (delists) its listing ---------- */
    // isListed is the very field PUT /api/seller-stock/:id flips; the wire for
    // the flip is covered by the seller-desk suites, so here the STATE is
    // driven on the document to observe the availability read itself.
    probeStock.isListed = false;
    await probeStock.save();
    view = await call(`/api/products/${product._id}`);
    avail = view.json.availability;
    check('delisted shop takes the frame out of sale entirely', avail?.sellable === false);
    add = await call('/api/cart/add', { token: customer, body: { productId: String(product._id), quantity: 1 } });
    check('cart/add agrees with the page after the delist', add.status === 409 && add.json?.unsellable === true);

    /* ------- state 4: relisted, but the shop declined prescription ------- */
    probeStock.isListed = true;
    probeStock.sellsWithPower = false;
    probeStock.powerLensTypes = [];
    await probeStock.save();
    view = await call(`/api/products/${product._id}`);
    avail = view.json.availability;
    check(
      'a frames-only shop sells the frame but offers no lens types',
      avail.sellable === true && (avail.powered || []).length === 0 && avail.poweredAuthoritative === true
    );
    add = await call('/api/cart/add-lens', {
      token: customer,
      body: { productId: String(product._id), quantity: 1, lensConfiguration: { lensType: 'progressive' } },
    });
    check(
      'add-lens refuses a shop that does not sell with power',
      add.status === 409 && add.json?.unsellable === true,
      add.json?.message
    );
  } finally {
    /*
     * Rebuild exactly what the fixture seed would have written for this
     * product (the same seller spread `npm run fixtures:apply` uses), so every
     * suite after this one sees the catalogue whole. The demo cart is emptied
     * too: a stray probe line would be money in someone else's checkout test.
     */
    await Product.updateOne({ _id: product._id }, { seller: prevSeller }).catch(() => {});
    await SellerStock.deleteMany({ product: product._id }).catch(() => {});
    const sellers = await Seller.find({ isActive: true })
      .select('_id')
      .catch(() => []);
    const rows = [];
    for (const [i, sl] of sellers.entries()) {
      const base = product.discountedPrice || product.price;
      rows.push({
        seller: sl._id,
        product: product._id,
        brand: product.brand,
        modelNumber: product.modelNumber || '',
        category: product.category,
        sellingPrice: Math.max(99, base + (i - 1) * 100),
        mrp: product.price,
        totalStock: (product.variants || []).reduce((s, v) => s + (v.stock || 0), 0),
        variants: (product.variants || []).map((v) => ({
          color: v.color || '',
          size: v.size || '',
          stock: v.stock || 0,
          price: v.price || Math.max(99, base + (i - 1) * 100),
        })),
        isListed: true,
        listing: { brandLinked: false, state: 'live' },
        sellsWithPower: !!product.poweredOptionsAvailable,
        powerLensTypes: product.poweredOptionsAvailable ? ['single-vision', 'progressive'] : [],
      });
    }
    if (rows.length) await SellerStock.insertMany(rows, { ordered: false }).catch(() => {});
    const demo = await User.findOne({ email: 'demo@optikart.com' }).catch(() => null);
    if (demo) await Cart.deleteMany({ user: demo._id }).catch(() => {});
  }

  /* ---------- state 5: consumables stay sold by the manufacturer ---------- */
  const consumable = await Product.findOne({
    category: 'contactlenses',
    stock: { $gt: 0 },
    seller: { $exists: true, $ne: null },
  });
  if (consumable) {
    const view = await call(`/api/products/${consumable._id}`);
    const avail = view.json?.availability;
    check(
      'a contact lens listed by its owner shop is purchasable through that shop',
      (avail?.configs || []).length >= 1 && avail.configs.some((c) => c.buyable === true),
      JSON.stringify(avail || {}).slice(0, 120)
    );
    const add = await call('/api/cart/add', {
      token: customer,
      body: { productId: String(consumable._id), quantity: 1 },
    });
    check('cart accepts the consumable exactly as checkout does', add.status === 200);
    await Cart.deleteMany({ user: (await User.findOne({ email: 'demo@optikart.com' }))._id }).catch(() => {});
  }

  // final live read: the shared fixture is whole again
  const view = await call(`/api/products/${(await Product.findOne({ category: 'sunglasses' }))._id}`);
  check('fixture rows restored - product sellable again for later suites', view.json?.availability?.sellable === true);

  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} availability checks passed`);
  process.exitCode = failed.length ? 1 : 0;
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('FATAL', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* already down */
  }
  process.exitCode = 1;
});
