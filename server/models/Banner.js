import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    // Banners are uploaded from device by the admin. The same uploaded file is
    // stored per device breakpoint so the carousel can serve the right crop.
    images: {
      desktop: {
        url: { type: String, default: '' },
        aspectRatio: { type: String, default: '1:1' },
      },
      tablet: {
        url: { type: String, default: '' },
        aspectRatio: { type: String, default: '16:9' },
      },
      mobile: {
        url: { type: String, default: '' },
        aspectRatio: { type: String, default: '9:16' },
      },
    },
    linkUrl: {
      type: String,
      trim: true,
      default: '',
    },
    // Discount configuration shown on the banner and on its dedicated page.
    // Named explicitly so Mongoose does not interpret a child path called
    // "type" as a single-nested primitive type declaration.
    discount: {
      _id: false,
      kind: { type: String, enum: ['none', 'percentage', 'flat', 'min-max'], default: 'none' },
      value: { type: Number, default: 0 },
      minPrice: { type: Number, default: 0 },
      maxPrice: { type: Number, default: 0 },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
    },
    // Every banner gets its own detail page describing the offer.
    slug: { type: String, trim: true, index: true },
    description: { type: String, trim: true, default: '' },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

bannerSchema.pre('save', function (next) {
  if (!this.slug) {
    const base = (this.title || 'banner')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    this.slug = `${base}-${Date.now().toString(36)}`;
  }
  next();
});

// owner rule 2026-11: demo rows (fixtures) vs live rows (real signups/uploads). Bulk tools may
// only touch demo; live data disappears only through the per-row admin delete paths.
// dataOrigin: 'demo' rows come only from fixtures; 'live' rows are real business. Bulk purge tooling may
// only remove demo data - a live row leaves the database only through services/accountDelete.js (admin click +
// open-business guard). Owner rule 2026-11: real data is never collateral damage.
bannerSchema.add({ dataOrigin: { type: String, enum: ['demo', 'live'], default: 'live', index: true } });
const Banner = mongoose.model('Banner', bannerSchema);
export default Banner;
