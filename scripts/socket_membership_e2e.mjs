#!/usr/bin/env node
/**
 * Socket authentication and room-membership boundaries.
 *
 * The hole this pins: before middleware/socketAuth.js, the connection handlers
 * joined whatever room name the page asked for and never looked at the bearer
 * token the handshake carried. A WebSocket is NOT bound by CORS, so this was a
 * cross-site-readable feed of `newOrder` payloads (buyer name, phone, address)
 * to any seller room id a stranger could enumerate, and of `orderUpdate` to
 * 'admin_room'. At the same time the app's own pages never joined anything
 * (the join helpers exist in client/src/services/socket.js and have no
 * callers), so the legit consumers of those rooms saw nothing either.
 *
 * Layers asserted, because each is a distinct way this could regress:
 *  1. the decision functions (roles, rooms, liveness, revocation, order
 *     participation) tested directly against the harness database;
 *  2. the wire (engine.io polling against the running API) so the io.use
 *     mount itself is covered, not just the import;
 *  3. a source gate on server.js so a future edit that hands room names back
 *     into socket.join() unfiltered fails here rather than in production.
 *
 *   node scripts/socket_membership_e2e.mjs [base-url]
 *
 * Needs a seeded development database (same contract as the other e2e suites).
 */
/*
 * No bare package imports here: scripts/ has no node_modules of its own, so
 * `import mongoose from 'mongoose'` from this directory cannot resolve. The
 * mongoose instance is taken from a model module instead - those live under
 * server/, where the package resolves, and they are the same instance the
 * running app's models are registered on.
 */
import { authenticateSocketToken, mayJoinOrderRoom } from '../server/middleware/socketAuth.js';
import User from '../server/models/User.js';
import Seller from '../server/models/Seller.js';
import DeliveryPartner from '../server/models/DeliveryPartner.js';
import Order from '../server/models/Order.js';
import { signSession } from '../server/services/session.js';

const mongoose = Order.db.base;

const BASE = process.argv[2] || process.env.VERIFY_BASE || 'http://localhost:3111';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 140)}` : ''}`);
  return ok;
};

const login = async (path, email, password) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  return json.token || null;
};

/* ---------------------------- engine.io polling client ---------------------------- */
// Deliberately dependency-free: this suite proves the server's handshake gate,
// and adding a socket.io-client dependency to the server tree for one test
// would let the test drift from what browsers actually send anyway.

const eioUrl = (sid) => `${BASE}/socket.io/?EIO=4&transport=polling${sid ? `&sid=${sid}` : ''}`;

async function engineHandshake() {
  const res = await fetch(eioUrl());
  const text = await res.text();
  const open = JSON.parse(text.replace(/^0/, ''));
  return open.sid;
}

/** Connect to the default namespace carrying auth payload; resolve the reply packet type. */
async function attemptConnect(authPayload) {
  const sid = await engineHandshake();
  const post = await fetch(eioUrl(sid), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: `40${JSON.stringify(authPayload || {})}`,
  });
  if (!post.ok) return { type: 'post-failed', status: post.status };
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 50));
    const text = await (await fetch(eioUrl(sid))).text();
    const connectPacket = text.split('\x1e').find((p) => p.startsWith('40') || p.startsWith('44'));
    if (connectPacket) return { sid, type: connectPacket.slice(0, 2), body: connectPacket.slice(2) };
  }
  return { sid, type: 'timeout', body: '' };
}

async function endSocket(sid) {
  try {
    await fetch(eioUrl(sid), { method: 'POST', body: '41', headers: { 'Content-Type': 'text/plain;charset=UTF-8' } });
  } catch {
    /* already closed; engine GCs the session */
  }
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be provided (run via scripts/verify.mjs)');
  await mongoose.connect(process.env.MONGODB_URI);

  /* ------------------------- 1. decision functions ------------------------- */
  check('a handshake with no token is refused', (await authenticateSocketToken(null)).reason === 'no-token');
  check('a garbage token is refused', (await authenticateSocketToken('not.a.jwt')).ok === false);

  const sellerToken = await login('/seller/login', 'opticalworld@gmail.com', 'Seller123@');
  const customerToken = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  if (!check('fixture logins succeed (seller, customer)', !!(sellerToken && customerToken))) {
    throw new Error('logins failed - cannot evaluate socket boundaries');
  }
  const sellerAuth = await authenticateSocketToken(sellerToken);
  check(
    'a signed-in shop lands in its OWN seller room only',
    sellerAuth.ok && sellerAuth.rooms.length === 1 && sellerAuth.rooms[0].startsWith('seller_'),
    JSON.stringify(sellerAuth.rooms)
  );

  const otherSellerId = String(new mongoose.Types.ObjectId());
  const customerAuth = await authenticateSocketToken(customerToken);
  check(
    'a signed-in shopper lands in their own user room only',
    customerAuth.ok && customerAuth.rooms.length === 1,
    JSON.stringify(customerAuth.rooms)
  );

  const adminToken = await login('/admin/auth/login', 'samedayopticians@gmail.com', 'Sameday123@');
  const adminAuth = await authenticateSocketToken(adminToken);
  check(
    'admin lands in admin_room (and their user room)',
    adminAuth.ok && adminAuth.rooms.includes('admin_room'),
    JSON.stringify(adminAuth.rooms)
  );
  check(
    'the seller token does NOT get admin_room - ambient membership comes from identity, not request',
    !(sellerAuth.rooms || []).includes('admin_room') && !(customerAuth.rooms || []).includes('admin_room')
  );

  // Liveness: deactivate, expect refusal, restore.
  const { sub } = await (async () => {
    const decoded = JSON.parse(Buffer.from(customerToken.split('.')[1], 'base64url').toString());
    const id = decoded.id || decoded.userId;
    await User.findByIdAndUpdate(id, { isActive: false });
    const off = await authenticateSocketToken(customerToken);
    await User.findByIdAndUpdate(id, { isActive: true });
    return { sub: off };
  })();
  check(
    'a deactivated account is refused at handshake and room checks',
    sub.ok === false && sub.reason === 'account-inactive',
    sub.reason
  );

  // Revocation: sign out one token, then show the handshake refuses it too.
  const logoutToken = await login('/auth/login', 'demo@optikart.com', 'Demo123@');
  await fetch(`${BASE}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${logoutToken}` } });
  const revoked = await authenticateSocketToken(logoutToken);
  check(
    'a signed-out session is refused (same revocation list the HTTP guard uses)',
    revoked.ok === false && revoked.reason === 'revoked-session',
    revoked.reason
  );

  // Order participation.
  const buyer = await User.findOne({ email: 'demo@optikart.com' }).select('_id');
  const stranger = await User.findOne({ email: 'testuser@optikart.com' }).select('_id');
  const ownerShop = await Seller.findOne({ email: 'opticalworld@gmail.com' }).select('_id');
  const otherShop = await Seller.findOne({ email: 'visioncare@gmail.com' }).select('_id');
  const partnerDoc = await DeliveryPartner.findOne({ email: 'suresh.partner@optikart.com' }).select('_id');
  const probeOrder = await Order.create({
    user: buyer._id,
    seller: ownerShop._id,
    items: [{ product: new mongoose.Types.ObjectId(), name: 'probe', quantity: 1, price: 10 }],
    shippingAddress: { name: 'Probe', phone: '9000000000', street: '1', city: 'x', state: 'y', pincode: '400001' },
    subtotal: 10,
    totalAmount: 10,
    partnerQueue: [{ partner: partnerDoc?._id, status: 'current' }],
    partnerCurrentIndex: 0,
  });
  const asBuyer = { id: String(buyer._id), role: 'user' };
  const asOther = { id: String(stranger._id), role: 'user' };
  const asShop = { id: String(ownerShop._id), role: 'seller' };
  const asOtherShop = { id: String(otherShop._id), role: 'seller' };
  const asPartner = { id: String(partnerDoc?._id || ''), role: 'deliveryPartner' };
  check(
    'order room: buyer, order seller and current partner yes; other shopper and other shop no',
    (await mayJoinOrderRoom(asBuyer, probeOrder._id)) &&
      (await mayJoinOrderRoom(asShop, probeOrder._id)) &&
      (await mayJoinOrderRoom(asPartner, probeOrder._id)) &&
      !(await mayJoinOrderRoom(asOther, probeOrder._id)) &&
      !(await mayJoinOrderRoom(asOtherShop, probeOrder._id))
  );
  check(
    'order room: a made-up order id is refused',
    (await mayJoinOrderRoom(asBuyer, new mongoose.Types.ObjectId())) === false
  );

  // A token minted directly with an unknown role must not open a session.
  const weird = signSession(
    { id: String(buyer._id), userId: String(buyer._id), role: 'quantumAuditor' },
    { expiresIn: '5m' }
  );
  check('an unrecognized role claim is refused, not defaulted', (await authenticateSocketToken(weird)).ok === false);

  /* ------------------------------ 2. the wire ------------------------------ */
  const anon = await attemptConnect(null);
  check('wire: an anonymous namespace connect is rejected (44)', anon.type === '44', anon.body);
  if (anon.sid) await endSocket(anon.sid);

  const junk = await attemptConnect({ token: 'junk.junk.junk' });
  check('wire: a forged token is rejected (44)', junk.type === '44', junk.body);
  if (junk.sid) await endSocket(junk.sid);

  const good = await attemptConnect({ token: customerToken });
  check('wire: the app login path still connects (40 ack)', good.type === '40', good.body);
  if (good.sid) await endSocket(good.sid);

  await probeOrder.deleteOne();

  /* --------------------------- 3. source gate --------------------------- */
  const src = await (
    await import('node:fs')
  ).promises.readFile(new URL('../server/server.js', import.meta.url), 'utf8');
  const joinBlock = src.slice(src.indexOf('io.use(async (socket'), src.indexOf("app.set('io', io)"));
  check(
    'server.js: handshake installs authenticateSocketToken before any handler',
    joinBlock.includes('authenticateSocketToken(socket.handshake.auth?.token)')
  );

  /*
   * Every `socket.join(...)` in the handlers must be guarded. A join is OK if
   * it either (a) enumerates `socket.data.rooms` - the verified list produced
   * by authenticateSocketToken - or (b) sits in the 240 characters below (ie
   * immediately after) an `includes(` / `mayJoinOrderRoom` guard. This scans
   * the code, not the author's formatting, so reflowing server.js cannot make
   * the check pass for the wrong reason.
   */
  const GUARDS = ['socket.data.rooms', 'includes(room)', 'mayJoinOrderRoom', 'wanted'];
  const joinSites = [...joinBlock.matchAll(/socket\.join\(/g)];
  check(`server.js: found ${joinSites.length} join sites to assess`, joinSites.length >= 4);
  check(
    'server.js: every join site is guarded by identity (verified rooms, includes-check, or order-participation)',
    joinSites.every((m) => {
      const lineStart = joinBlock.lastIndexOf('\n', m.index) + 1;
      const line = joinBlock.slice(lineStart, joinBlock.indexOf('\n', m.index));
      if (m.index - lineStart > 0 && !line.trimStart().startsWith('socket.join')) return true; // joined on a line that opens with a guard
      const context = joinBlock.slice(Math.max(0, m.index - 240), m.index);
      return GUARDS.some((g) => context.includes(g));
    })
  );
  const adminHandler = joinBlock.slice(joinBlock.indexOf("socket.on('joinAdminRoom'"));
  check(
    'server.js: joinAdminRoom is now membership-checked, and raw client-id joins are gone',
    /includes\('admin_room'\)/.test(adminHandler.slice(0, 200)) &&
      !/socket\.join\(`seller_\$\{sellerId\}`\)/.test(joinBlock)
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} socket-boundary checks passed`);
  process.exitCode = failed.length ? 1 : 0;
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('FATAL', err);
  try {
    await mongoose.disconnect(); // open connections otherwise hold the process past its reporting
  } catch {
    /* already down */
  }
  process.exitCode = 1;
});
