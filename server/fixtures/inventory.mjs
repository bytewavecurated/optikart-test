import User from '../models/User.js';
import Seller from '../models/Seller.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import HelpArticle from '../models/HelpArticle.js';
import Blog from '../models/Blog.js';
import Executive from '../models/Executive.js';
import Manufacturer from '../models/Manufacturer.js';
import ManufacturerSeller from '../models/ManufacturerSeller.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import StaffRole from '../models/StaffRole.js';
import SellerStock from '../models/SellerStock.js';

/*
 * Every collection the demo dataset clears before writing, in ONE list.
 *
 * The wipe used to be eleven `deleteMany({})` calls written inline at the top of
 * the seed, with a twelfth (SellerStock) 1,900 lines further down where nobody
 * reading the top of the file would think to look for it. A list is what makes
 * the guard able to answer "what will this delete?" - and if a future fixture
 * clears a collection without adding it here, the guard reports a smaller
 * footprint than it has, so the list is asserted complete by
 * fixtures_destruction_guard_unit.mjs against the source text.
 */
export const WIPABLE = [
  { label: 'users (all roles, including admins)', model: User },
  { label: 'sellers (shops)', model: Seller },
  /*
   * Deferred on purpose. In the original seed this collection was cleared deep
   * inside the run (just before its own rows were written), not with the others at
   * the top. Hoisting it into the up-front wipe changed what the rows written
   * between those two points could see, and `seller ranking` + `partner payout`
   * went red with an empty routing queue - because brand catalogue stock that the
   * dataset relies on mid-run had been deleted too early.
   *
   * It stays in WIPABLE so the guard still tells the operator it will be deleted
   * (that is the whole point of the list), and `deferred` means clearWipable()
   * leaves it to the dataset's own call site by default.
   */
  { label: 'seller stock rows', model: SellerStock, deferred: true },
  { label: 'products', model: Product },
  { label: 'coupons', model: Coupon },
  { label: 'help articles', model: HelpArticle },
  { label: 'blog posts', model: Blog },
  { label: 'executives', model: Executive },
  { label: 'manufacturers', model: Manufacturer },
  { label: 'manufacturer retailer shops', model: ManufacturerSeller },
  { label: 'delivery partners', model: DeliveryPartner },
  { label: 'staff roles', model: StaffRole },
];

/** Document counts, for the "are you sure" that the guard actually prints. */
export async function countWipable() {
  const out = [];
  for (const entry of WIPABLE) {
    let documents = 0;
    try {
      documents = await entry.model.estimatedDocumentCount();
    } catch (error) {
      // A collection that does not exist yet holds nothing; anything else is
      // reported rather than assumed, because 0 is the number that authorises a wipe.
      const code = error?.codeName || error?.name || '';
      if (!/NamespaceNotFound|MongoServerError/.test(String(code))) throw error;
      documents = 0;
    }
    out.push({ label: entry.label, documents });
  }
  return out;
}

/**
 * Clear the list. Called only from behind applyDemoFixtures()'s guard.
 *
 * @param includeDeferred  false by default: collections flagged `deferred` are
 *                         cleared by the dataset at its original position, so this
 *                         function cannot silently rewrite the order of operations
 *                         a 2,000-line fixture depends on. The guard still counts
 *                         them, because "what will this delete" must be answered in
 *                         full even when the when is decided elsewhere.
 */
export async function clearWipable({ quiet = false, includeDeferred = false } = {}) {
  for (const entry of WIPABLE) {
    if (entry.deferred && !includeDeferred) continue;
    await entry.model.deleteMany({});
    if (!quiet) console.log(`  cleared ${entry.label}`);
  }
  if (!quiet) console.log('Cleared existing data');
}

export const WIPABLE_LABELS = WIPABLE.map((w) => w.label);
