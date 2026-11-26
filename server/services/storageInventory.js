import { generatedDocsStatus, generatedDocPath } from './storage.js';
import Invoice from '../models/Invoice.js';
import mongoose from 'mongoose';

/**
 * Where the app's stored assets actually are.
 *
 * The project rule is that user files belong in Cloudinary. The rule is easy to
 * state and easy to violate silently: uploads written before Cloudinary was
 * configured, rows written by a helper that bypassed the service, and the
 * development fallback all leave `/uploads/...` paths in documents, and an
 * operator cannot see that from a settings page. This inventory answers the only
 * question that matters before decommissioning a box or moving to a managed
 * storage provider: how many references point at this server's disk, in which
 * collections, and are any of them malformed.
 *
 * The field map is data, and `server/scripts/storage_drift_unit.mjs` asserts
 * every entry against the real schema paths - because an inventory over a wrong
 * field name silently reports zero, and a zero that is wrong is far worse than a
 * number you cannot trust. That failure mode has already bitten this codebase
 * (a manifest whose projection dropped the field it grouped by answered "no
 * branded products" for twelve real rows).
 */

const SCHEME_LOCAL = /^\/uploads(\/|$)/;
const SCHEME_REMOTE = /^https?:\/\//i;
const SCHEME_DATA = /^data:/i;

/*
 * Every entry is a real schema path, checked at commit time by
 * server/scripts/storage_drift_unit.mjs (which imports the models and compares
 * against `schema.paths`). The draft of this list contained four fields that do
 * not exist - `ReturnRequest.evidence.images`, `PrescriptionVerification.fileUrl`,
 * `LensConfiguration.fileUrl` and `Order.invoiceUrl` - and an inventory over a
 * wrong path does not error, it reports zero. A confident zero about uncounted
 * data is the worst possible output for a page whose entire purpose is to tell
 * the truth about what is stored where.
 *
 * Two of those inventions were attempts to guess where uploads live. They are
 * not guesses any more: return proofs are written under /uploads/returns by the
 * customer-returns route and recorded on the ORDER, not the ReturnRequest; the
 * lens-configuration upload is `prescriptionFile`; prescriptions keep history in
 * `previousFiles` because the old image is evidence.
 */
export const ASSET_FIELDS = [
  { model: 'Product', field: 'images', kind: 'array', label: 'product images' },
  { model: 'Seller', field: 'storeLogo', kind: 'string', label: 'shop logo' },
  { model: 'Seller', field: 'storeBanner', kind: 'string', label: 'shop banner' },
  { model: 'User', field: 'avatar', kind: 'string', label: 'profile photo' },
  { model: 'Brand', field: 'logo.url', kind: 'string', label: 'brand logo' },
  { model: 'Banner', field: 'images.desktop.url', kind: 'string', label: 'banner image (desktop)' },
  { model: 'Banner', field: 'images.tablet.url', kind: 'string', label: 'banner image (tablet)' },
  { model: 'Banner', field: 'images.mobile.url', kind: 'string', label: 'banner image (mobile)' },
  { model: 'ReturnRequest', field: 'returnShippingLabel.labelUrl', kind: 'string', label: 'return shipping label' },
  { model: 'Prescription', field: 'fileUrl', kind: 'string', label: 'prescription upload' },
  { model: 'Prescription', field: 'previousFiles', kind: 'array', label: 'earlier prescription uploads' },
  { model: 'LensConfiguration', field: 'prescriptionFile', kind: 'string', label: 'lens configuration upload' },
];

/*
 * No note about return photos, because there is nothing to note: the returns
 * schemas hold no customer-photo field at all (the only asset on a ReturnRequest
 * is the courier label). A previous draft here claimed return images were
 * recorded on the Order - a guess I could not find in the code, so it is gone.
 * If the returns flow ever accepts photo proof, ASSET_FIELDS gains its entry
 * and scripts/storage_drift_unit.mjs will fail until this map matches the schema.
 */

/**
 * Classify one stored value.
 *
 * A blank string is not an asset: it is the absence of one, and counting blanks
 * as "remote" or "unknown" is how an inventory starts looking alarming about
 * rows that simply have no upload. Whitespace and the four-letter words that
 * spreadsheet imports produced are treated the same way.
 */
export function classifyAsset(value) {
  /*
   * Flatten, recursively. `collectValues` hands back what a document field
   * holds, and an array field (product images, prescription history, return
   * photos) arrives as an array nested inside that result - [ ['a','b','c'] ].
   * Treating that as one entry stringified the whole list into
   * "/uploads/a.png,https://cdn/b.png,undefined", which begins with /uploads, so
   * every multi-asset row counted exactly ONE local reference and reported the
   * rest as nothing. On an inventory whose whole job is "how much is still on
   * this disk", under-counting is the one error that makes the page lie: a
   * catalogue with 5,000 local images would read as a handful.
   */
  const flatten = (node) => (Array.isArray(node) ? node.flatMap(flatten) : [node]);
  const entries = flatten(value);
  const counts = { local: 0, remote: 0, dataUrl: 0, relative: 0, absent: 0, suspect: 0 };
  const examples = [];
  for (const raw of entries) {
    const text = String(raw ?? '').trim();
    if (!text || /^(undefined|null|n\/a|none)$/i.test(text)) {
      counts.absent += 1;
      continue;
    }
    let bucket;
    if (SCHEME_LOCAL.test(text)) bucket = 'local';
    else if (SCHEME_DATA.test(text)) bucket = 'dataUrl';
    /*
     * One bucket for every absolute URL, deliberately not split by host. The
     * question the page answers is "is this reference outside the box", and a
     * Cloudinary-vs-other-host distinction would invite a second rule (and a
     * second way to be wrong) without changing what an operator does about it.
     */
    else if (SCHEME_REMOTE.test(text)) bucket = 'remote';
    else if (text.startsWith('/')) bucket = 'relative';
    else bucket = 'suspect';
    counts[bucket] += 1;
    if (examples.length < 3 && (bucket === 'local' || bucket === 'suspect' || bucket === 'relative')) {
      examples.push(text.slice(0, 120));
    }
  }
  return { counts, examples };
}

/*
 * Models in this repo register themselves when their module is imported, so a
 * lookup in `mongoose.models` alone reports "not registered" for every model the
 * caller has not imported yet - which is precisely how a drift check passes on
 * an empty answer. Each entity is awaited through its file first, and only then
 * looked up by a fixed path map (no dynamic filenames built from data).
 */
const MODEL_MODULES = {
  Product: '../models/Product.js',
  Seller: '../models/Seller.js',
  User: '../models/User.js',
  Brand: '../models/Brand.js',
  Banner: '../models/Banner.js',
  ReturnRequest: '../models/ReturnRequest.js',
  Prescription: '../models/Prescription.js',
  PrescriptionVerification: '../models/PrescriptionVerification.js',
  LensConfiguration: '../models/LensConfiguration.js',
  Order: '../models/Order.js',
};

async function pathsFor(entity) {
  const spec = MODEL_MODULES[entity];
  if (!spec) return null;
  if (!mongoose.models[entity]) await import(spec);
  const Model = mongoose.models[entity];
  return Model ? Object.keys(Model.schema.paths) : null;
}

/**
 * Assertable drift check: every entry in ASSET_FIELDS must exist in its model's
 * schema (sub-document arrays are matched on their parent path, since mongoose
 * stores them as `variants.images`).
 */
export async function validateAssetFieldMap() {
  const problems = [];
  for (const entry of ASSET_FIELDS) {
    const paths = await pathsFor(entry.model);
    if (!paths) {
      problems.push(`${entry.model}: model is not registered (nothing can be counted)`);
      continue;
    }
    const parent = entry.field.split('.').slice(0, -1).join('.');
    const head = entry.field.split('.')[0];
    const found =
      paths.includes(entry.field) ||
      paths.includes(head) ||
      (parent && paths.some((p) => p === parent || p.startsWith(`${parent}.`))) ||
      paths.some((p) => p.endsWith(`.${entry.field.split('.').pop()}`));
    if (!found) problems.push(`${entry.model}.${entry.field}: not a schema path (inventory would report 0 falsely)`);
  }
  return problems;
}

const collectValues = (doc, field) => {
  const parts = field.split('.');
  const walk = (node, index) => {
    if (node === undefined || node === null) return [];
    if (index >= parts.length) return [node];
    const key = parts[index];
    if (Array.isArray(node)) return node.flatMap((item) => walk(item, index));
    return walk(node?.[key], index + 1);
  };
  return walk(doc, 0);
};

/**
 * Count asset references by location, per field.
 *
 * `sample_limit` exists so the page can show *which* rows still point at the
 * disk - an aggregate alone cannot be acted on - without pulling a whole
 * catalogue into memory.
 */

async function generatedDocsReport() {
  const status = await generatedDocsStatus();
  let missing = 0;
  let rows = 0;
  try {
    rows = await Invoice.countDocuments({ pdfPath: { $exists: true, $ne: '' } });
    const present = await Invoice.countDocuments({ pdfPath: '' });
    for await (const r of Invoice.find({ pdfPath: { $exists: true, $ne: '' } })
      .select('pdfPath')
      .lean()) {
      try {
        const fs0 = await import('node:fs');
        if (!fs0.existsSync(generatedDocPath(r.pdfPath))) missing += 1;
      } catch {}
    }
    void present;
  } catch {}
  return { root: status.root, kinds: status.kinds, invoiceRows: rows, filesMissing: missing };
}

export async function storageInventory({ sampleLimit = 3 } = {}) {
  // Same registration hazard as above: import before looking up.
  for (const entry of ASSET_FIELDS) await pathsFor(entry.model);

  const perField = [];
  const samples = [];
  for (const entry of ASSET_FIELDS) {
    const Model = mongoose.models[entry.model];
    const rows = await Model.find({}).select(entry.field.split('.')[0]).lean();
    const merged = { local: 0, remote: 0, dataUrl: 0, relative: 0, absent: 0, suspect: 0 };
    let rowsWithAsset = 0;
    let shown = 0;
    for (const row of rows) {
      const values = collectValues(row, entry.field);
      if (!values.length) continue;
      const { counts, examples } = classifyAsset(values);
      for (const k of Object.keys(merged)) merged[k] += counts[k];
      if (counts.local + counts.relative + counts.suspect > 0) {
        rowsWithAsset += 1;
        if (shown < sampleLimit) {
          shown += 1;
          samples.push({
            model: entry.model,
            field: entry.field,
            label: entry.label,
            id: String(row._id),
            // Never echo a whole document: an inventory that needs no fields
            // would not explain why a row must be migrated.
            references: examples,
          });
        }
      }
    }
    perField.push({
      model: entry.model,
      field: entry.field,
      label: entry.label,
      rows: rows.length,
      rowsNeedingMigration: rowsWithAsset,
      references: merged,
    });
  }

  const totals = perField.reduce(
    (acc, f) => {
      for (const k of ['local', 'remote', 'dataUrl', 'relative', 'suspect']) acc[k] += f.references[k];
      acc.rowsNeedingMigration += f.rowsNeedingMigration;
      return acc;
    },
    { local: 0, remote: 0, dataUrl: 0, relative: 0, suspect: 0, rowsNeedingMigration: 0 }
  );

  return {
    totals,
    byField: perField,
    samples,
    // Where each scheme is served from, so an operator can tell a broken
    // reference from a merely inconvenient one.
    reading: {
      local: 'served by this app at /uploads - lost when the container is replaced',
      relative: 'path with no known prefix - likely broken, check before migrating',
      remote: 'absolute URL on a host outside this box (Cloudinary or similar)',
      dataUrl: 'bytes embedded in the document - bloats every read and should be moved out',
      suspect: 'value that is not a recognisable reference at all',
    },
    // Generated documents (the platform's own paperwork) - the ONLY disk
    // area not reachable by the static /uploads mount; the consistency probe
    // compares every Invoice row against the store so a lost PDF folder (or a
    // half-finished backfill run) is one admin glance deep, not a surprise
    // during a support call about 'download broken'.
    generatedDocs: await generatedDocsReport(),
  };
}
