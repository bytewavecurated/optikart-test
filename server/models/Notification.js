import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
  /*
   * Delivery partners are their own account type, not a User and not a Seller.
   * Without this field there was no way to address one: a partner opening its
   * console asked for notifications and got the query for `user: <partnerId>`,
   * which matches nothing and returns an empty list that looks like 'nothing
   * has happened for you' rather than 'nobody can ever write to you'.
   */
  partner: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner' },
  /*
   * A brand's own retail console (`ManufacturerSeller`) is not a Seller: a
   * storefront copy it lists carries its id in the `seller` field, so the
   * notification query for a signed-in retailer resolved to neither User nor
   * Seller and fell through to `user: <thatId>` - permanently empty, for the one
   * account type whose listings the approval queue exists to talk about.
   */
  retailer: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturerSeller' },
  type: {
    type: String,
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
