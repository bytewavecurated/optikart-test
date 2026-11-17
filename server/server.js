import './config/loadEnv.js'; // must precede every env-reading import (see that file)
import { verifyToken, verifyAdmin } from './middleware/auth.js';
import { authenticateSocketToken, mayJoinOrderRoom } from './middleware/socketAuth.js';
import dns from 'node:dns';
/*
 * DNS is left to the container unless an operator asks otherwise.
 *
 * `dns.setServers(['8.8.8.8', '1.1.1.1'])` ran unconditionally here AND in the fixtures module,
 * sending every hostname this process resolves through public resolvers instead of
 * the deployment's own. In practice: private zones (a VPC-internal MongoDB, a
 * route53 private record) stop resolving, /etc/hosts entries are ignored, and an
 * environment with no direct DNS egress fails at resolution rather than at the
 * service it was trying to reach. It was there to work around one container with a
 * broken resolv.conf - an infrastructure problem wearing an app-code fix.
 *
 * To restore the old behaviour deliberately: DNS_OVERRIDE=8.8.8.8,1.1.1.1
 */
const dnsOverride = String(process.env.DNS_OVERRIDE || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (dnsOverride.length) dns.setServers(dnsOverride);

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { assertRuntimeSecrets } from './config/loadEnv.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import authRoutes from './routes/auth.js';
import adminAuthRoutes from './routes/adminAuth.js';
import sellerRoutes from './routes/seller.js';
import productRoutes from './routes/product.js';
import orderRoutes from './routes/order.js';
import cartRoutes from './routes/cart.js';
import paymentRoutes from './routes/payment.js';
import wishlistRoutes from './routes/wishlist.js';
import couponRoutes from './routes/coupon.js';
import blogRoutes from './routes/blog.js';
import helpRoutes from './routes/help.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notification.js';
import shiprocketRoutes from './routes/shiprocket.js';
import saleEventRoutes from './routes/saleEvent.js';
import bannerRoutes from './routes/banners.js';
import executiveRoutes from './routes/executive.js';
import manufacturerRoutes from './routes/manufacturer.js';
import manufacturersPublicRoutes from './routes/manufacturers.js';
import manufacturerSellerRoutes from './routes/manufacturerSeller.js';
import chatbotRoutes from './routes/chatbot.js';
import faceDetectionRoutes from './routes/faceDetection.js';
import speechRecognitionRoutes from './routes/speechRecognition.js';
import payoutRoutes from './routes/payouts.js';
import inventoryRoutes from './routes/inventory.js';
import returnRoutes from './routes/returns.js';
import notificationsRoutes from './routes/notifications.js';
import wishlistAlertsRoutes from './routes/wishlistAlerts.js';
import productComparisonRoutes from './routes/productComparison.js';
import sellerPerformanceRoutes from './routes/sellerPerformance.js';
import prescriptionVerificationRoutes from './routes/prescriptionVerification.js';
import orderRoutingRoutes from './routes/orderRouting.js';
import lensConfigurationRoutes from './routes/lensConfiguration.js';
import deliveryPartnerRoutes from './routes/deliveryPartner.js';
import productVerificationRoutes from './routes/productVerification.js';
import inventoryAnalyticsRoutes from './routes/inventoryAnalytics.js';
import returnAnalyticsRoutes from './routes/returnAnalytics.js';
import deliveryRouteRoutes from './routes/deliveryRoute.js';
import customerReturnsRoutes from './routes/customerReturns.js';
import commissionRoutes from './routes/commission.js';
import staffRoutes from './routes/staff.js';
import { sweepExpiredOffers } from './services/orderProximity.js';
import { sweepExpiredPriceChanges } from './services/priceChangeAcceptance.js';
import { sweepExpiredPartnerOffers } from './services/partnerDispatch.js';
import siteContentRoutes from './routes/siteContent.js';
import sellerStockRoutes from './routes/sellerStock.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { requestContext, snapshot as metricSnapshot, recordError } from './middleware/requestContext.js';
import { errorSurface, securityHeaders } from './middleware/errorSurface.js';
import partnerRankingRoutes from './routes/partnerRanking.js';
import brandLogoRoutes from './routes/brandLogos.js';
import sessionGuard from './middleware/sessionGuard.js';
import { logSessionIdlePolicy } from './services/sessionActivity.js';

/* dotenv is loaded by the first import above; validated here so a weak secret is a refuse-to-boot. */
const secretPolicy = assertRuntimeSecrets();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// `trust proxy: true` tells Express to believe every X-Forwarded-For value a
// client sends, which lets anyone defeat the IP-based rate limiters (and is what
// express-rate-limit's ERR_ERL_PERMISSIVE_TRUST_PROXY validation rejects).
//
// Trusted hops must therefore be an explicit number, not `true`:
//   0 / false -> direct connections (local development)
//   1         -> one reverse proxy in front (nginx, Heroku, Render, Railway...)
// Override with TRUST_PROXY_HOPS when there is more than one hop.
const trustProxyHops = (() => {
  const raw = process.env.TRUST_PROXY_HOPS;
  if (raw === undefined || raw === '') {
    // Only trust a single hop when not running locally.
    return process.env.NODE_ENV === 'production' ? 1 : false;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return false;
  return n;
})();

app.set('trust proxy', trustProxyHops);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

/*
 * Uploads arrive as multipart with their own per-file cap (see
 * middleware/upload.js `limits.fileSize`), so the JSON parser is sized for
 * documents - a product, an order, a list of ids. The previous 50mb applied to
 * every route: a single unauthenticated POST could book 50mb of parse work, and
 * several of those is an outage. It was never protecting an upload.
 * Override with JSON_BODY_LIMIT when a real integration needs more.
 */
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '1mb';

app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

const uploadDirs = [
  'uploads',
  'uploads/products',
  'uploads/prescriptions',
  'uploads/store',
  'uploads/avatars',
  'uploads/blogs',
  'uploads/banners',
];
uploadDirs.forEach((dir) => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// First in the chain, so a rate-limited or malformed request still has an id a
// customer can quote.
app.use(requestContext);

/*
 * Installed immediately after the request id exists and before any router, so
 * every 5xx response in the app - including ones no one has written yet - passes
 * through it. See middleware/errorSurface.js for why this is a boundary rather
 * than 300 individual edits.
 */
app.use(securityHeaders);
app.use(errorSurface);

/*
 * Mounted once, for every /api path, instead of inside each role middleware.
 * Eleven verify functions already exist and two routes decode tokens
 * themselves; a revoked session that got through one gap would be completely
 * invisible, because a signed-out token looks exactly like a live one.
 */
app.use('/api', sessionGuard);

app.use(apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/shiprocket', shiprocketRoutes);
app.use('/api/sale-events', saleEventRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/executive', executiveRoutes);
app.use('/api/manufacturer', manufacturerRoutes);
app.use('/api/manufacturers', manufacturersPublicRoutes);
app.use('/api/manufacturer-seller', manufacturerSellerRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/face-detection', faceDetectionRoutes);
app.use('/api/speech', speechRecognitionRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/wishlist-alerts', wishlistAlertsRoutes);
app.use('/api/comparison', productComparisonRoutes);
app.use('/api/seller-performance', sellerPerformanceRoutes);
app.use('/api/prescription-verification', prescriptionVerificationRoutes);
app.use('/api/order-routing', orderRoutingRoutes);
app.use('/api/lens-configuration', lensConfigurationRoutes);
app.use('/api/delivery-partner', deliveryPartnerRoutes);

/*
 * Weekly partner leaderboard endpoints live in their own router and are mounted
 * on the api root, so the admin and partner paths can differ without either
 * router having to know about the other. Express only hands a request to the
 * next matching mount when the first has no match, so this adds paths rather
 * than re-ordering anything - and it is mounted late deliberately: the auth
 * middleware inside the router is what decides access, not the mount order.
 */
app.use('/api', partnerRankingRoutes);

// Brand registration + logos (see routes/brandLogos.js).
app.use('/api', brandLogoRoutes);
app.use('/api/product-verification', productVerificationRoutes);
app.use('/api/inventory-analytics', inventoryAnalyticsRoutes);
app.use('/api/return-analytics', returnAnalyticsRoutes);
app.use('/api/delivery-route', deliveryRouteRoutes);
app.use('/api/customer-returns', customerReturnsRoutes);
app.use('/api/commission', commissionRoutes);
app.use('/api/site-content', siteContentRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/seller-stock', sellerStockRoutes);

app.get('/api/health', async (req, res) => {
  // A readiness check that only proves the process is awake is of limited use:
  // this app is nothing without MongoDB, and a boot that could not connect keeps
  // serving 500s from every route.
  const mongoose = (await import('mongoose')).default;
  /*
   * Mongoose numbers these 0=disconnected, 1=connected, 2=connecting,
   * 3=disconnecting - connected is 1, not 2. Read as a list, a healthy process
   * reports itself degraded and answers 503: an uptime check would restart a
   * working server, and the error counter would fill with failures that never
   * happened.
   */
  const STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const db = STATES[mongoose.connection.readyState] || 'unknown';
  const ready = db === 'connected';
  res.status(ready ? 200 : 503).json({
    success: ready,
    status: ready ? 'ok' : 'degraded',
    message: 'Eyewear Platform API is running',
    requestId: req.id,
    timestamp: new Date().toISOString(),
    service: 'optikart-api',
    environment: process.env.NODE_ENV || 'development',
  });
});

/*
 * Operational numbers for the running process. Admin-only: which routes get
 * traffic, what is slow and what broke last are exactly the things an attacker
 * or a competitor would like to see.
 */
app.get('/api/metrics', verifyToken, verifyAdmin, (req, res) => {
  res.json({ success: true, metrics: metricSnapshot() });
});

/*
 * Every socket carries the same session token the HTTP APIs require. The
 * reasons are in middleware/socketAuth.js; the short version is that a
 * WebSocket handshake is outside CORS, so before this, any page could join
 * any room name it typed - including 'admin_room' - while the app's own
 * legitimate sockets (which never learned to join) received nothing.
 */
io.use(async (socket, next) => {
  const auth = await authenticateSocketToken(socket.handshake.auth?.token);
  if (!auth.ok) {
    // The code lands on the client's connect_error; the reasons are public
    // because they mirror the HTTP 401/403 wording and leak nothing extra.
    return next(new Error(auth.reason));
  }
  socket.data.principal = auth.principal;
  socket.data.rooms = auth.rooms;
  next();
});

io.on('connection', (socket) => {
  const principal = socket.data.principal;
  for (const room of socket.data.rooms) socket.join(room);
  console.log(`Socket connected: ${socket.id} (${principal.role})`);

  /*
   * The join handlers stay for wire-compatible clients but cannot widen
   * membership: they honour a room only when it is one the verified identity
   * already owns. Same for 'leave', which only ever subtracts.
   */
  socket.on('join', (data) => {
    const wanted = [];
    if (data?.userId && principal.role === 'user') wanted.push(`user_${String(data.userId)}`);
    if (data?.sellerId && (principal.role === 'seller' || principal.role === 'manufacturerSeller'))
      wanted.push(`seller_${String(data.sellerId)}`);
    if (data?.adminId && principal.role === 'admin') wanted.push('admin_room');
    for (const room of wanted) {
      if (socket.data.rooms.includes(room)) socket.join(room);
    }
  });

  socket.on('joinSellerRoom', (sellerId) => {
    const room = `seller_${String(sellerId)}`;
    if (socket.data.rooms.includes(room)) socket.join(room);
  });

  socket.on('leaveSellerRoom', (sellerId) => {
    socket.leave(`seller_${String(sellerId)}`);
  });

  socket.on('joinOrderRoom', async (orderId) => {
    try {
      if (await mayJoinOrderRoom(principal, String(orderId || ''))) socket.join(`order_${String(orderId)}`);
    } catch {
      /* a bad id is simply a refused join */
    }
  });

  socket.on('leaveOrderRoom', (orderId) => {
    if (orderId) socket.leave(`order_${String(orderId)}`);
  });

  socket.on('joinAdminRoom', () => {
    if (socket.data.rooms.includes('admin_room')) socket.join('admin_room');
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

app.set('io', io);

// Serve static files from the React app build directory in production
const clientBuildPath = path.join(__dirname, '../client/build');
const clientIndex = path.join(clientBuildPath, 'index.html');

// Decide per request, not once at boot. If the build is produced after the
// process starts (or is redeployed), a startup check would otherwise leave every
// non-API route answering 404 until the next restart.
app.use(express.static(clientBuildPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API route not found.' });
  }
  if (!fs.existsSync(clientIndex)) {
    return res
      .status(503)
      .type('html')
      .send(
        '<h1>Frontend not built</h1><p>Run <code>npm run build</code> in <code>client/</code>, then reload. The API is healthy.</p>'
      );
  }
  res.sendFile(clientIndex);
});

app.use((err, req, res, next) => {
  // Same failure logged five times in a row is indistinguishable in plain
  // console output; the id links this response to that log line.
  const recorded = recordError(req, err);
  console.error(JSON.stringify({ event: 'error', id: req.id, path: req.originalUrl, message: recorded.message }));
  console.error(err.stack || err);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Max size is 5MB.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ success: false, message: `${field} already exists.` });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: 'Validation error', errors: messages });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;

/**
 * Bootstrap administrator.
 *
 * Production removes the seeded demo accounts and every role sign-in then
 * requires an emailed OTP - so with no admin left, nobody can sign in to create
 * one. That is a locked door, not a secure one. When BOOTSTRAP_ADMIN_EMAIL is
 * set and no active admin exists, this creates exactly one, from values the
 * operator supplies; nothing here is invented or defaulted.
 *
 * The password is never logged, and anything guessable is refused: this account
 * carries more authority than the demo logins it replaces.
 */
const ensureBootstrapAdmin = async () => {
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '');
  if (!email) {
    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
      console.warn(
        'BOOTSTRAP_ADMIN_EMAIL is not set: with demo logins removed and OTP required, nobody can sign in to create an administrator.'
      );
    }
    return null;
  }

  const { default: User } = await import('./models/User.js');
  const existing = await User.findOne({ role: 'admin', isActive: true, isBanned: false }).catch(() => null);
  if (existing) return null;

  const weak = ['change-me', 'admin123', 'password', 'bootstrap', '12345678'];
  if (password.length < 12 || weak.some((w) => password.toLowerCase().includes(w))) {
    console.error(
      `BOOTSTRAP_ADMIN_PASSWORD is too weak (${password.length < 12 ? 'under 12 characters' : 'contains a common word'}); no administrator was created.`
    );
    return null;
  }

  try {
    const created = await User.create({
      name: String(process.env.BOOTSTRAP_ADMIN_NAME || 'Administrator').trim(),
      email,
      password,
      role: 'admin',
    });
    console.log(
      `Bootstrap administrator created for ${created.email}. Remove BOOTSTRAP_ADMIN_PASSWORD from the environment once you have signed in.`
    );
    return created;
  } catch (error) {
    // A duplicate email or a half-finished run must not stop the API booting.
    console.error('Bootstrap administrator could not be created:', error.message);
    return null;
  }
};

const startServer = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      console.error('❌ ERROR: MONGODB_URI not found in .env file');
      console.error('\n🔧 Please add your MongoDB Atlas connection string to server/.env:');
      console.error('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/eyewear-platform\n');
      process.exit(1);
    }

    console.log('Connecting to MongoDB Atlas...');

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    console.log('✅ Connected to MongoDB');

    /*
     * A production process that can wipe real collections, issue sessions on a
     * placeholder secret, or demand an OTP it has no way to deliver is not secure
     * - it is broken in a way nobody notices until data is gone. These conditions
     * stop the boot rather than log a warning beside a running server.
     */
    const { productionBootErrors, isProduction, seedRequestedAtBoot } = await import('./config/authMode.js');
    const seedFlag = String(process.env.SEED_ON_BOOT || 'auto').toLowerCase();
    const allowDemoSeed = ['true', '1'].includes(String(process.env.ALLOW_DEMO_SEED || '').toLowerCase());
    const bootErrors = productionBootErrors({
      // boot-time seeding no longer exists; the check stays so a stale
      // SEED_ON_BOOT cannot be mistaken for a supported configuration.
      seedForced: ['true', '1'].includes(seedFlag),
      seedAcknowledged: allowDemoSeed,
    });
    if (bootErrors.length) {
      bootErrors.forEach((line) => console.error(`CONFIGURATION ERROR: ${line}`));
      console.error('Refusing to start. Fix the environment, then start again.');
      process.exit(1);
    }

    // A production install with the demo logins removed needs one real admin to
    // exist, or the console can never be reached.
    await ensureBootstrapAdmin();

    /*
     * No seeding, in any environment.
     *
     * This block called the demo dataset on boot whenever the database looked empty. The
     * seed opens by deleting the eleven collections it owns, so "looks empty" was
     * doing double duty: a fresh test database, and a mistyped MONGODB_URI or a
     * staging box aimed at the wrong cluster - which is how an operator loses real
     * accounts and orders. Worse still, the instinctive recovery from an
     * unexpectedly-empty database (SEED_ON_BOOT=true) is the same wipe.
     *
     * productionBootErrors/ALLOW_DEMO_SEED fenced off NODE_ENV=production only:
     * one mode out of several, and it fenced it by refusing to seed rather than by
     * making seeding unreachable from the process. The dataset now lives in
     * server/fixtures/ and the application never imports it, so a deployed process
     * cannot clear a collection whatever the environment variables say.
     * scripts/verify.mjs applies the fixtures for the suites - which is where that
     * responsibility belongs, since it is the harness that needs the data.
     *
     * A new production database therefore starts with no accounts, by design. The
     * bootstrap administrator above is the supported way in: BOOTSTRAP_ADMIN_EMAIL
     * plus a strong BOOTSTRAP_ADMIN_PASSWORD, idempotent, and refusing weak
     * passwords rather than shipping a known one.
     */
    if (seedRequestedAtBoot()) {
      /*
       * Announced every time, not quietly ignored: a runbook, an older README or a
       * remembered habit that sets SEED_ON_BOOT must learn immediately that it no
       * longer loads anything, rather than concluding the data arrived.
       */
      console.warn(
        'SEED_ON_BOOT is set but no longer has any effect: boot-time seeding was removed because the demo ' +
          'dataset wipes the collections it owns. For a THROWAWAY local database run "node fixtures/apply.mjs" ' +
          '(--force to overwrite, --expect-database=<name> to be certain which one).'
      );
    } else if (isProduction()) {
      const { default: User } = await import('./models/User.js');
      const admins = await User.countDocuments({ role: 'admin', isActive: true, isBanned: false }).catch(() => 0);
      if (!admins) {
        console.warn(
          'This database has no administrator and nothing will ever be seeded into it. Set BOOTSTRAP_ADMIN_EMAIL ' +
            'with a strong BOOTSTRAP_ADMIN_PASSWORD (12+ characters, no common word) to create the first one.'
        );
      }
    }
    console.log(
      'Seeding: never, from any environment. Demo fixtures live in server/fixtures/ and are applied explicitly.'
    );

    // Catalogue rows created before products carried a `name` are filled from
    // their title; idempotent, so it costs one query per restart. (Kept from the
    // block removed above - it is data repair, not seeding.)
    try {
      const { default: Product } = await import('./models/Product.js');
      const filled = await Product.fillMissingNames();
      if (filled) console.log(`Filled product names: ${filled}`);
    } catch (bfErr) {
      console.log('Name backfill note:', bfErr.message);
    }

    /*
     * Listings that existed before brand supply approval became a rule.
     *
     * Marked, not deleted and not relabelled as approved. A seller was doing
     * nothing wrong under the rules of the day, and an update that quietly hid
     * every existing brand listing would break the storefront within minutes of
     * deploy - a worse incident than the one being fixed. What changes is that
     * the state is now written down: `grandfathered` with no manufacturer
     * review lets the admin queue show them as never confirmed, instead of an
     * absence of records being read as a record of approval.
     *
     * Idempotent - only rows without a `listing` object are touched - and it
     * runs outside the seed branch, because this is a schema change rather than
     * demo data.
     */
    try {
      const { default: SellerStock } = await import('./models/SellerStock.js');
      const untagged = await SellerStock.countDocuments({ listing: { $exists: false } });
      if (untagged) {
        const { default: Product } = await import('./models/Product.js');
        const brandIds = (
          await Product.find({ manufacturer: { $exists: true, $ne: null } })
            .select('_id')
            .lean()
        ).map((x) => x._id);

        const brandStock = await SellerStock.updateMany(
          { listing: { $exists: false }, product: { $in: brandIds } },
          { $set: { 'listing.brandLinked': true, 'listing.state': 'live', 'listing.grandfathered': true } }
        );
        const plainStock = await SellerStock.updateMany(
          { listing: { $exists: false } },
          { $set: { 'listing.brandLinked': false, 'listing.state': 'live' } }
        );
        const brandCopies = await Product.updateMany(
          { listing: { $exists: false }, manufacturerProduct: { $exists: true, $ne: null } },
          { $set: { 'listing.brandLinked': true, 'listing.state': 'live', 'listing.grandfathered': true } }
        );
        const plainCopies = await Product.updateMany(
          { listing: { $exists: false } },
          { $set: { 'listing.brandLinked': false, 'listing.state': 'live' } }
        );
        console.log(
          `Listing rules seeded: ${brandStock.modifiedCount} brand stock rows and ${brandCopies.modifiedCount} brand storefront copies marked live-but-never-confirmed; ${plainStock.modifiedCount + plainCopies.modifiedCount} unbranded rows left untouched.`
        );
      }
    } catch (lgErr) {
      console.error(
        JSON.stringify({ event: 'listing_migration_failed', message: String(lgErr.message).slice(0, 200) })
      );
    }

    /*
     * Retailer copies that lost their link to the brand catalogue.
     *
     * Relinked only when exactly one brand product matches on brand plus model
     * number inside the same manufacturer - ambiguous ones are left alone and
     * counted, because inventing a link would attach a shop's stock to the
     * wrong frame and quietly misroute every approval for it. Copies that
     * already had a `listing` state keep it; only the pointer is repaired.
     */
    try {
      const { default: Product } = await import('./models/Product.js');
      const { default: Manufacturer } = await import('./models/Manufacturer.js');
      const orphans = await Product.find({
        manufacturerSellerId: { $exists: true, $ne: null },
        manufacturerProduct: { $exists: false },
      }).limit(500);
      let repaired = 0;
      let ambiguous = 0;
      for (const copy of orphans) {
        const parentBrand = await Manufacturer.findById(copy.manufacturer).select('_id').lean();
        if (!parentBrand) {
          ambiguous += 1;
          continue;
        }
        const matches = await Product.find({
          manufacturer: parentBrand._id,
          brand: copy.brand,
          modelNumber: copy.modelNumber,
        })
          .limit(2)
          .lean();
        if (matches.length === 1) {
          copy.manufacturerProduct = matches[0]._id;
          await copy.save();
          repaired += 1;
        } else {
          ambiguous += 1;
        }
      }
      if (orphans.length) {
        console.log(
          `Brand-catalogue links repaired on ${repaired} retailer copies${ambiguous ? `; ${ambiguous} left unlinked because the match was not unique` : ''}.`
        );
      }
    } catch (linkErr) {
      console.error(JSON.stringify({ event: 'listing_relink_failed', message: String(linkErr.message).slice(0, 200) }));
    }

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      /*
       * The idle window changes behaviour invisibly, so the process says which
       * rule it is running. A mistyped SESSION_IDLE_MINUTES otherwise looks like
       * an unstable console - sessions dropping after nine seconds, or never
       * expiring - with nothing in the log to explain either.
       */
      logSessionIdlePolicy();

      // Expire unanswered seller offers every minute so the 30-minute window is
      // actually honoured: each lapse cascades to the next seller, and once all
      // five have failed the order escalates to the admin queue.
      // Expire price proposals whose 7-working-day window has elapsed, so a
      // listing can never sit indefinitely in a half-applied state.
      const priceSweep = setInterval(
        async () => {
          try {
            const r = await sweepExpiredPriceChanges();
            if (r.expired) console.log(`Expired ${r.expired} unanswered price proposal(s)`);
          } catch (e) {
            console.error('Price proposal sweep failed:', e.message);
          }
        },
        60 * 60 * 1000
      );
      priceSweep.unref();

      const sweepTimer = setInterval(async () => {
        try {
          const swept = await sweepExpiredOffers(app.get('io'));
          if (swept.swept) console.log(`Routing sweep expired ${swept.swept} offer(s)`);
        } catch (e) {
          console.error('Routing sweep failed:', e.message);
        }
      }, 60 * 1000);
      sweepTimer.unref();

      // Delivery partners are offered runs one at a time with a 30 minute
      // window; this closes the windows nobody answered and moves to the next
      // partner, escalating to the admin queue when the list runs out.
      const partnerSweep = setInterval(async () => {
        try {
          const closed = await sweepExpiredPartnerOffers(app.get('io'));
          if (closed) console.log(`Partner offers expired: ${closed}`);
        } catch (e) {
          console.error('Partner offer sweep failed:', e.message);
        }
      }, 60 * 1000);
      partnerSweep.unref();
    });
  } catch (err) {
    console.error('❌ Startup error:', err.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check your MONGODB_URI in server/.env file');
    console.error('2. Make sure MongoDB Atlas IP whitelist includes 0.0.0.0/0');
    console.error('3. Verify your MongoDB Atlas username and password');
    console.error('4. Wait 1-2 minutes after updating IP whitelist');
    process.exit(1);
  }
};

startServer();

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

export { app, io };
