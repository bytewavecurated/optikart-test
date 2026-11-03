import mongoose from 'mongoose';

/*
 * Storefront copy and layout that an administrator can change without a code
 * release: the home page rails, promo tiles, section headings and whether a
 * block shows at all.
 *
 * Only what the admin actually changed is stored. The client keeps its own
 * defaults (they live next to the components that use them, and the routing
 * taxonomy), merges these overrides on top, and renders the defaults unchanged
 * if this API is unavailable - so a database hiccup cannot blank the home page,
 * and nothing here duplicates a value that already belongs to the catalogue.
 *
 * Icons are stored as names from a fixed registry rather than markup, because a
 * value that reaches the screen should never be something an attacker can type.
 */
const entrySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  slug: { type: String, trim: true, maxlength: 80, default: '' },
  link: { type: String, trim: true, maxlength: 120, default: '' },
  icon: { type: String, trim: true, maxlength: 30, default: '' },
  tint: { type: String, trim: true, maxlength: 20, default: '' },
  fg: { type: String, trim: true, maxlength: 20, default: '' },
  image: { type: String, trim: true, maxlength: 200, default: '' },
  subtitle: { type: String, trim: true, maxlength: 90, default: '' }
}, { _id: false });

const homeSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, enum: ['home'] },

  headings: {
    categories: { type: String, maxlength: 80, default: '' },
    categoriesSub: { type: String, maxlength: 120, default: '' },
    faceShape: { type: String, maxlength: 80, default: '' },
    faceShapeSub: { type: String, maxlength: 120, default: '' },
    frameType: { type: String, maxlength: 80, default: '' },
    frameTypeSub: { type: String, maxlength: 120, default: '' },
    material: { type: String, maxlength: 80, default: '' },
    materialSub: { type: String, maxlength: 120, default: '' },
    offers: { type: String, maxlength: 80, default: '' },
    trending: { type: String, maxlength: 80, default: '' },
    deals: { type: String, maxlength: 80, default: '' }
  },

  // Hidden blocks are removed from the page rather than emptied, which is how an
  // operator stops a promotion from showing without anyone deploying anything.
  visible: {
    categoryRail: { type: Boolean, default: true },
    faceShapeRail: { type: Boolean, default: true },
    frameTypeRail: { type: Boolean, default: true },
    materialRail: { type: Boolean, default: true },
    promoTiles: { type: Boolean, default: true },
    gender: { type: Boolean, default: true }
  },

  categoryRail: { type: [entrySchema], default: [] },
  faceShapes: { type: [String], default: [] },
  frameTypes: { type: [String], default: [] },
  frameMaterials: { type: [String], default: [] },
  promoTiles: { type: [entrySchema], default: [] },
  genderTiles: { type: [entrySchema], default: [] },

  notes: { type: String, maxlength: 400, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.SiteContent || mongoose.model('SiteContent', homeSchema);
