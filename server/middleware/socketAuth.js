/**
 * Socket.IO authentication and room membership.
 *
 * Why this file exists: the handshake handlers in `server.js` joined whatever
 * room the connecting page asked for - `joinSellerRoom(anyId)`,
 * `joinOrderRoom(anyId)`, even `joinAdminRoom()` with no argument - from a
 * connection whose bearer token was never checked. A WebSocket upgrade is not
 * subject to CORS, so "the browser won't allow cross-origin requests" was never
 * an answer: any page could open a socket to this origin and be pushed other
 * sellers' `newOrder` payloads (buyer name, phone, address, prescription flag)
 * and the admin order feed. Simultaneously NO legitimate socket received
 * anything, because the client's join helpers were exported and never called -
 * the rooms were empty except for whoever asked hardest.
 *
 * The rule from here:
 *   1. connecting requires the same signed session token the HTTP APIs require
 *      (signature, expiry, revocation, account liveness), and
 *   2. membership is derived from the verified identity, not from the client's
 *      requested room name. Client-emitted joins are honoured only where they
 *      restate what the server already knows (or, for order rooms, after a
 *      participation check against the Order document).
 */
import jwt from 'jsonwebtoken';
import { isRevoked } from '../services/session.js';
import User from '../models/User.js';
import Seller from '../models/Seller.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import Order from '../models/Order.js';

const idOf = (v) => String(v && v._id ? v._id : v || '');

/**
 * Resolve a socket handshake token to a principal plus the rooms it belongs to.
 * Mirrors the role shapes produced by the login routes (`signSession` payloads);
 * account liveness is enforced exactly like `verifyToken` does for HTTP, because
 * a deactivated account should stop receiving pushes on the same terms it stops
 * receiving data.
 */
export const authenticateSocketToken = async (token) => {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'no-token' };
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return { ok: false, reason: error.name === 'TokenExpiredError' ? 'expired' : 'invalid-token' };
  }
  if (await isRevoked(`Bearer ${token}`)) return { ok: false, reason: 'revoked-session' };

  const role = decoded.role || 'user';
  const rawId =
    decoded.id ||
    decoded.userId ||
    decoded.sellerId ||
    decoded.executiveId ||
    decoded.partnerId ||
    decoded.manufacturerId;
  if (!rawId) return { ok: false, reason: 'invalid-token' };

  const principal = { id: String(rawId), role };

  switch (role) {
    case 'user': {
      /*
       * A seller-console token carries { id, sellerId } and NO role claim (see
       * routes/seller.js generateSellerToken) - exactly the shape that would
       * land here. `verifyAnyPrincipal` resolves that ambiguity by trying the
       * User collection first and falling back to Seller; the socket path must
       * make the SAME decision, because a shop whose console authenticates over
       * HTTP but is refused by the socket layer sees no new-order pushes, while
       * a shop id that accidentally resolved through a *user* lookup would open
       * the wrong rooms instead.
       */
      const userDoc = await User.findById(rawId).select('isActive');
      if (userDoc) {
        if (!userDoc.isActive) return { ok: false, reason: 'account-inactive' };
        return { ok: true, principal, rooms: [`user_${principal.id}`] };
      }
      const sellerDoc = await Seller.findById(rawId).select('isActive');
      if (sellerDoc && sellerDoc.isActive) {
        principal.role = 'seller';
        return { ok: true, principal, rooms: [`seller_${principal.id}`] };
      }
      return { ok: false, reason: 'account-inactive' };
    }
    case 'seller':
    case 'manufacturerSeller': {
      const doc = await Seller.findById(rawId).select('isActive');
      // A seller console is only "signed in as this shop" while the shop is
      // active; mirroring the HTTP 403 here stops pushes to a delisted shop.
      if (!doc || !doc.isActive) return { ok: false, reason: 'account-inactive' };
      return { ok: true, principal, rooms: [`seller_${principal.id}`] };
    }
    case 'deliveryPartner': {
      const doc = await DeliveryPartner.findById(rawId).select('isActive');
      if (!doc || !doc.isActive) return { ok: false, reason: 'account-inactive' };
      return { ok: true, principal, rooms: [`partner_${principal.id}`] };
    }
    case 'admin': {
      // Admins are Users (adminAuth signs { userId, role:'admin' }): their
      // personal notification room plus the shared ops feed.
      const doc = await User.findById(rawId).select('isActive');
      if (!doc || !doc.isActive) return { ok: false, reason: 'account-inactive' };
      return { ok: true, principal, rooms: [`user_${principal.id}`, 'admin_room'] };
    }
    case 'executive':
    case 'manufacturer':
      // These desks have no socket emissions addressed to them (their panels
      // read over HTTP); they authenticate so order-room joins below can
      // evaluate them, and hold no ambient room.
      return { ok: true, principal, rooms: [] };
    default:
      return { ok: false, reason: 'invalid-token' };
  }
};

/**
 * Order-room membership, from the Order document, not from the request.
 * Participants: the buyer, the seller on the order, the partner currently
 * holding it in their queue - plus admin/staff oversight. Staff users sign in
 * through adminAuth, which already yields role 'admin'.
 */
export const mayJoinOrderRoom = async (principal, orderId) => {
  if (!principal || !orderId) return false;
  if (principal.role === 'admin') return true;
  const order = await Order.findById(orderId).select('user seller partnerQueue partnerCurrentIndex').lean();
  if (!order) return false;
  if (principal.role === 'user' && idOf(order.user) === principal.id) return true;
  if ((principal.role === 'seller' || principal.role === 'manufacturerSeller') && idOf(order.seller) === principal.id)
    return true;
  if (principal.role === 'deliveryPartner') {
    const queue = Array.isArray(order.partnerQueue) ? order.partnerQueue : [];
    const current = queue[order.partnerCurrentIndex || 0];
    if (current && idOf(current.partner) === principal.id) return true;
  }
  return false;
};
