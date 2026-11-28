import mongoose from 'mongoose';
import { foldBrand } from '../services/brandOwnership.js';

/**
 * A brand is its own entity now, not a string on a product.
 *
 * Until this existed, `brand` was free text on Product (and a `brands: [String]`
 * list on Manufacturer), which meant three things could not be answered: whether
 * two manufacturers were shipping under the same name (only detectable by fold
 * comparison at write time), where a brand's logo lived, and who had approved
 * the brand at all. A storefront rail full of first Letters is the visible cost;
 * the invisible one is that "verified brand" had no subject.
 *
 * Invariants enforced here, with the reasoning kept next to the code that
 * implements them because they are the point of the collection:
 *
 * 1. `slug` is unique globally - one brand name belongs to exactly one
 *    manufacturer. The fold (case/whitespace/punctuation-insensitive) is what
 *    makes "Acme Optics" and "acme-optics" collide, which a plain unique index
 *    on `name` would let through.
 * 2. A brand cannot be `approved` without a logo. The approval decision is the
 *    thing the rails and product pages display, and an approved record with no
 *    mark is what makes the storefront look broken later.
 * 3. Ownership cannot move silently. `ownerManufacturer` is set on creation and
 *    only an admin decision may change it, with the previous owner notified -
 *    otherwise a dispute is resolved by whoever writes to the document last.
 *
 * Storage note: `logo.url` may be an absolute Cloudinary URL or a same-origin
 * /uploads path. That is intentional (see services/storage.js) - the client uses
 * the value directly, so the backend can be switched without touching rows.
 */
const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Brand name is required'], trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    ownerManufacturer: { type: mongoose.Schema.Types.ObjectId, ref: 'Manufacturer', required: true, index: true },

    logo: {
      url: String,
      provider: { type: String, enum: ['cloudinary', 'local', null], default: null },
      publicId: { type: String, default: null },
      bytes: Number,
      width: Number,
      height: Number,
      kind: { type: String, enum: ['png', 'jpeg', 'svg', null], default: null },
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    decision: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
      at: Date,
      note: String,
      /** What the admin actually looked at, so a dispute has a record. */
      logoSeenAt: Date,
    },

    /** Set when ownership is transferred by an admin dispute, never by a write race. */
    ownershipHistory: [
      {
        from: { type: mongoose.Schema.Types.ObjectId, ref: 'Manufacturer' },
        to: { type: mongoose.Schema.Types.ObjectId, ref: 'Manufacturer' },
        at: Date,
        note: String,
      },
    ],
  },
  { timestamps: true }
);

/*
 * There is exactly one definition of "the same brand name", and it lives in
 * services/brandOwnership.js because that is where the write-time gate decides
 * ownership disputes. If this file invented its own fold (it briefly did), the
 * unique index and the gate would disagree about which names collide - and the
 * result is the worst possible shape of bug: the database accepting a brand the
 * API refuses to attribute, or rejecting one it would happily hand over.
 */
brandSchema.pre('validate', function assignSlug(next) {
  this.slug = foldBrand(this.name);
  next();
});

brandSchema.virtual('hasLogo').get(function () {
  return Boolean(this.logo?.url);
});

/*
 * The invariant above says an approved brand has a mark. Enforced here rather
 * than only in the route, because a back-office script, a future bulk tool, or
 * the admin page's own save path can all set the field - and a rail rendering a
 * letter tile for an "approved" brand is the failure the user sees first.
 */
brandSchema.pre('save', function enforceBrandInvariants(next) {
  /*
   * Invariant 2 - an approved brand must have a mark. Checked on every save,
   * because the routes are not the only thing that writes here.
   */
  if (this.status === 'approved' && !this.logo?.url) {
    return next(new Error(`Brand "${this.name}" cannot be approved without a logo.`));
  }

  /*
   * Invariant 3 - ownership never moves silently. Applies to PENDING brands too:
   * the first draft of this guard carried `&& this.status === 'approved'` (and a
   * `this.$__.wasClean` property that mongoose does not have), so a pending
   * brand could simply be reassigned to another manufacturer - which is the
   * exact dispute this collection exists to make impossible, and the audit
   * caught it on the first run.
   *
   * A legitimate transfer is not forbidden, it is *recorded*: push an
   * ownershipHistory entry naming who it went to, and the save proceeds.
   */
  if (!this.isNew && this.isModified('ownerManufacturer')) {
    const historic = (this.ownershipHistory || []).some((h) => String(h.to) === String(this.ownerManufacturer));
    if (!historic) {
      return next(
        new Error(
          `Brand "${this.name}" belongs to ${this.ownerManufacturer ? 'manufacturer ' + this.ownerManufacturer : 'no one'}; ` +
            'ownership changes must be recorded in ownershipHistory first.'
        )
      );
    }
  }
  next();
});

brandSchema.index({ ownerManufacturer: 1, status: 1 });

// owner rule 2026-11: demo rows (fixtures) vs live rows (real signups/uploads). Bulk tools may
// only touch demo; live data disappears only through the per-row admin delete paths.
// dataOrigin: 'demo' rows come only from fixtures; 'live' rows are real business. Bulk purge tooling may
// only remove demo data - a live row leaves the database only through services/accountDelete.js (admin click +
// open-business guard). Owner rule 2026-11: real data is never collateral damage.
brandSchema.add({ dataOrigin: { type: String, enum: ['demo', 'live'], default: 'live', index: true } });
export default mongoose.models.Brand || mongoose.model('Brand', brandSchema);
