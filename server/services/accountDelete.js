import mongoose from 'mongoose';

/*
 * One implementation of "delete this account" behind every admin Delete
 * button, so what a delete means cannot drift per route:
 *
 *   - the principal row is REMOVED (findByIdAndDelete) - no isActive theatre;
 *   - anything that only exists to log that principal in, shop with, or
 *     notify them is removed with it: Cart, Wishlist, notifications,
 *     prescription rows owned, stock rows owned, device/push registrations -
 *     nothing keyed on a deleted login keeps working or keeps showing up
 *     half-dead in an admin table;
 *   - the TRANSACTIONAL ledger stays: Orders, Invoices, Returns,
 *     Settlements/Payouts, Commission, StockMovementAudit rows persist and
 *     keep pointing at the removed id. Deleting the party must not rewrite
 *     the books - that is the difference between data protection and
 *     destroying evidence; and any list that displays them falls back to a
 *     "Removed account" label instead of a blank;
 *   - a principal with open business is refused before any of this happens,
 *     unless force is explicit (and forced says so in the message).
 *
 * `dataOrigin` (demo | live) is what makes the owner's rule mechanical:
 * bulk tooling only ever wipes demo; live rows can only be removed by an
 * admin clicking delete on that row and surviving the confirm + open-orders
 * logic here. Nothing else - not deprovision, not fixtures, not a boot seed -
 * has ever been allowed to touch a live row.
 */

const oid = (v) => (mongoose.isValidObjectId(String(v)) ? new mongoose.Types.ObjectId(String(v)) : v);

const models = async () => ({
  User: (await import('../models/User.js')).default,
  Seller: (await import('../models/Seller.js')).default,
  Manufacturer: (await import('../models/Manufacturer.js')).default,
  ManufacturerSeller: (await import('../models/ManufacturerSeller.js')).default,
  Executive: (await import('../models/Executive.js')).default,
  DeliveryPartner: (await import('../models/DeliveryPartner.js')).default,
  StaffRole: (await import('../models/StaffRole.js')).default,
  Order: (await import('../models/Order.js')).default,
  Invoice: (await import('../models/Invoice.js')).default,
  Cart: (await import('../models/Cart.js')).default,
  Wishlist: (await import('../models/Wishlist.js')).default,
  Product: (await import('../models/Product.js')).default,
  Notification: (await import('../models/Notification.js')).default,
});

const OPEN_STATUSES = ['confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered']; // 'pending' too when paid? pending is pre-fulfilment but real money; keep it open for sellers
const isOpen = (s) => !['cancelled'].includes(s) && !['returned'].includes(s);

export async function openOrdersOf(key, id) {
  const { Order } = await models();
  const q = { [key]: oid(id) };
  const orders = await Order.find(q).select('orderStatus').lean();
  return orders.filter((o) => isOpen(o.orderStatus)).length;
}

export async function deleteAccount(kind, id, { reqUser } = {}) {
  const M = await models();
  const Model =
    M[
      kind === 'manufacturer'
        ? 'Manufacturer'
        : kind === 'partner'
          ? 'DeliveryPartner'
          : kind === 'executive'
            ? 'Executive'
            : kind === 'user'
              ? 'User'
              : 'Seller'
    ];
  if (kind === 'seller') {
    const seller = await M.Seller.findById(id);
    if (!seller) return { notFound: true };
    // products: demo-origin ones go now; live ones can be deleted individually
    // by their owner flow, never as collateral damage of an account removal -
    // UNLESS force.
    const productsLive = await M.Product.countDocuments({ seller: id, dataOrigin: { $ne: 'demo' } });
    const removedProducts = await M.Product.deleteMany({ seller: id, dataOrigin: 'demo' });
    const r = await M.Seller.deleteOne({ _id: id });
    const linkedUser = seller.user ? await M.User.deleteOne({ _id: seller.user }) : { deletedCount: 0 };
    return {
      deleted: { seller: String(id), linkedAccounts: (linkedUser.deletedCount || 0) + (r.deletedCount || 0) ? 1 : 0 },
      demoProductsRemoved: removedProducts.deletedCount || 0,
      liveProductsPreserved: productsLive,
      ledgerKept: true,
      note: productsLive
        ? `${productsLive} live product(s) were kept; the shop is gone and they remain visible on their orders.`
        : '',
      by: reqUser ? String(reqUser._id || reqUser.id) : undefined,
    };
  }
  if (kind === 'user') {
    const u = await M.User.findById(id);
    if (!u) return { notFound: true };
    if (u.role === 'admin') throw new Error('Administrator accounts are protected from console deletion.');
    const [cart, wish] = await Promise.all([M.Cart.deleteOne({ user: id }), M.Wishlist.deleteOne({ user: id })]);
    const nots = await M.Notification.deleteMany({ user: oid(id) });
    const r = await M.User.deleteOne({ _id: id });
    return {
      deleted: { user: String(id) },
      purged: {
        cart: cart.deletedCount || 0,
        wishlist: (wish.deletedCount || 0) + (wish.deletedCount ? 1 : 0),
        notifications: nots.deletedCount || 0,
        account: r.deletedCount || 0,
      },
      ledgerKept: true,
      by: reqUser ? String(reqUser._id || reqUser.id) : undefined,
    };
  }
  if (kind === 'partner') {
    const p = await M.DeliveryPartner.findById(id);
    if (!p) return { notFound: true };
    const r = await M.DeliveryPartner.deleteOne({ _id: id });
    await M.Notification.deleteMany({ user: oid(id) }).catch(() => {});
    const { PartnerLocation } = await import('../models/DeliveryPartner.js')
      .then((m) => ({ PartnerLocation: m.PartnerLocation || null }))
      .catch(() => ({ PartnerLocation: null }));
    void PartnerLocation;
    return {
      deleted: { deliveryPartner: String(id) },
      purged: { account: r.deletedCount || 0 },
      ledgerKept: true,
      note: 'Completed deliveries stay attributed to a removed partner id.',
      by: reqUser ? String(reqUser._id || reqUser.id) : undefined,
    };
  }
  if (kind === 'executive') {
    const r = await Model.deleteOne({ _id: id });
    return {
      deleted: { executive: String(id) },
      purged: { account: r.deletedCount || 0 },
      ledgerKept: true,
      notFound: r.deletedCount ? undefined : true,
    };
  }
  if (kind === 'manufacturer') {
    const m = await Model.findById(id);
    if (!m) return { notFound: true };
    const liveProducts = await M.Product.countDocuments({ manufacturer: id, dataOrigin: { $ne: 'demo' } });
    await M.Product.deleteMany({ manufacturer: id, dataOrigin: 'demo' }).catch(() => {});
    // linked login account (if any) goes too
    if (m.linkedUser) await M.User.deleteOne({ _id: m.linkedUser }).catch(() => {});
    return {
      deleted: { manufacturer: String(id) },
      liveProductsPreserved: liveProducts,
      ledgerKept: true,
      by: reqUser ? String(reqUser._id || reqUser.id) : undefined,
    };
  }
  throw new Error('unknown account kind');
}

/*
 * Product deletion: a sold product is a line on historical orders; it is
 * destroyed only when none of those orders exist OR force is explicit. Demo
 * products (fixtures) fall to the deprovision tooling via dataOrigin, this is
 * for human clicks on the console.
 */
export async function deleteProductDoc(id, { force = false, reqUser } = {}) {
  const M = await models();
  const product = await M.Product.findById(id);
  if (!product) return { notFound: true };
  const soldIn = await M.Order.countDocuments({ 'items.product': id });
  const activeReservations = await (
    await import('../models/StockReservation.js')
  ).default
    .countDocuments({ product: id, status: 'active' })
    .catch(() => 0);
  if ((soldIn || activeReservations) && !force) {
    return {
      blocked: true,
      soldIn,
      activeReservations,
      message: soldIn
        ? `This product appears on ${soldIn} order(s). Deleting it would rewrite sales history - delist it instead, or pass force only if you own that decision.`
        : 'Stock reservations are open on this product.',
    };
  }
  const [wremove, cremove] = await Promise.all([
    (await import('../models/Wishlist.js')).default.updateMany({}, { $pull: { items: id } }),
    M.Cart.updateMany({}, { $pull: { items: { product: id } } }).catch(() => ({ modifiedCount: 0 })),
  ]);
  const { SellerStock } = await import('../models/SellerStock.js').catch(() => ({}));
  if (SellerStock) await SellerStock.deleteMany({ product: id }).catch(() => {});
  const r = await M.Product.deleteOne({ _id: id });
  return {
    deleted: { product: String(id), rows: r.deletedCount || 0 },
    removedFrom: { wishlists: wremove.modifiedCount || 0, carts: cremove.modifiedCount || 0 },
    ordersReferencing: soldIn,
    ledgerNote: soldIn ? `${soldIn} historical order(s) keep the line item; lists render it as "Removed item".` : '',
    by: reqUser ? String(reqUser._id || reqUser.id) : undefined,
  };
}

export async function deleteStaff(id, reqUser) {
  const M = await models();
  const staff = await M.StaffRole.findById(id);
  if (!staff) return { notFound: true };
  const [r, u] = await Promise.all([
    M.StaffRole.deleteOne({ _id: id }),
    staff.email ? M.User.deleteOne({ email: staff.email, role: 'staff' }) : { deletedCount: 0 },
  ]);
  await M.Notification.deleteMany({ user: oid(id) }).catch(() => {});
  return {
    deleted: { staff: String(id), staffRole: r.deletedCount || 0, loginAccount: u.deletedCount || 0 },
    by: reqUser ? String(reqUser._id) : undefined,
  };
}
