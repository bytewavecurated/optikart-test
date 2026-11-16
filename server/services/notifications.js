import Notification from '../models/Notification.js';
import User from '../models/User.js';

/**
 * One place for notifications that the platform itself generates.
 *
 * Notifications were being written inline, each route inventing its own field
 * names and its own idea of who should see the result. Two consequences showed
 * up repeatedly: an admin action that nobody was told about, and a notification
 * created with a recipient field that no query ever reads, so it sat invisible.
 *
 * These helpers do not swallow failures into silence, and do not let a failed
 * notification undo the action that triggered it: the action already
 * succeeded, and the operator has to be told that the message did not go out.
 */

const ADMIN_ROLES = ['admin'];

const emit = (io, room, payload) => {
  try {
    if (io && room) io.to(room).emit('notification', payload);
  } catch {
    // Realtime delivery is a convenience; the stored row is the record.
  }
};

const admins = async () =>
  User.find({ role: { $in: ADMIN_ROLES }, isActive: { $ne: false } })
    .select('_id name email')
    .lean();

/**
 * Tell the operations desk something needs them, or has happened.
 *
 * Returns how many were written so callers can report a partial failure
 * honestly. One row per admin, not a shared row: read state is per person.
 */
export const notifyAdmins = async ({ title, message, type = 'system', data = {}, io = null }) => {
  const targets = await admins();
  if (!targets.length) {
    console.error(JSON.stringify({ event: 'notification_dropped', title, reason: 'no active admin account' }));
    return { success: false, delivered: 0, reason: 'no_active_admin' };
  }

  const created = await Notification.insertMany(
    targets.map((u) => ({
      user: u._id,
      type,
      title,
      message,
      data,
    }))
  );

  for (const doc of created) emit(io, `user_${doc.user}`, { ...doc.toObject(), _id: doc._id });
  return { success: true, delivered: created.length };
};

/*
 * Which stored document an id of this kind refers to.
 *
 * Four account types, three collections: admins/staff/executive-desk people are
 * Users or their own docs, sellers are Seller, partners are DeliveryPartner. The
 * notification model addresses them with separate fields, and a wrong pairing
 * writes a row no read path can ever return - which is silent, because the
 * writer succeeds.
 */
export const recipientFieldFor = (kind) => ({ user: 'user', seller: 'seller', partner: 'partner' })[kind];

/** The read-side scope for whoever is asking. */
export const recipientScopeFor = (principal) => {
  if (principal?.partner) return { partner: principal.id };
  if (principal?.retailer) return { retailer: principal.id };
  if (principal?.manufacturer) return { manufacturer: principal.id };
  if (principal?.seller) return { seller: principal.id };
  if (principal?.executive) return { user: principal.id };
  return { user: principal.id };
};

export const notifySeller = async ({ sellerId, title, message, type = 'order', data = {}, io = null }) =>
  notifyAccount({ seller: sellerId, title, message, type, data, io });

export const notifyRetailer = async ({ retailerId, title, message, type = 'listing', data = {}, io = null }) => {
  const doc = await Notification.create({ retailer: retailerId, type, title, message, data });
  emit(io, `manufacturerSeller_${retailerId}`, doc.toObject());
  return { success: true, id: String(doc._id) };
};

export const notifyPartner = async ({ partnerId, title, message, type = 'delivery', data = {}, io = null }) => {
  const doc = await Notification.create({ partner: partnerId, type, title, message, data });
  emit(io, `deliveryPartner_${partnerId}`, doc.toObject());
  return { success: true, id: String(doc._id) };
};

/** Tell one specific account something, by whichever document represents it. */
/*
 * Every notification must name exactly one principal field: user, seller,
 * retailer, partner or manufacturer. `notifyAccount` used to build a row from
 * whichever of the two it was passed, so a call with neither created an
 * address-less document, emitted nothing, and still returned success - the same
 * class of bug as a UI button that toasts "Updated" over a request that never
 * happened. Now the recipient is validated before the row is built, and the
 * result says which channel actually received it.
 */
const RECIPIENT_FIELDS = ['user', 'seller', 'retailer', 'partner', 'manufacturer'];

export const notifyAccount = async ({ title, message, type = 'system', data = {}, io = null, ...rest }) => {
  const targets = RECIPIENT_FIELDS.filter((f) => rest[f]);
  if (targets.length !== 1) {
    throw new Error(
      `notifyAccount needs exactly one recipient of [${RECIPIENT_FIELDS.join(', ')}]; got ${targets.length ? targets.join(',') : 'none'}.`
    );
  }
  const field = targets[0];
  const doc = await Notification.create({ type, title, message, data, [field]: rest[field] });
  emit(io, `${field}_${rest[field]}`, doc.toObject());
  return { success: true, id: String(doc._id), deliveredTo: { [field]: String(rest[field]) } };
};

export const notifyManufacturer = ({ manufacturerId, ...rest }) =>
  notifyAccount({ ...rest, manufacturer: manufacturerId });
