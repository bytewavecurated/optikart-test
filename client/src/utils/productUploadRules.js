/**
 * The product form's rules, read from the specification the API publishes.
 *
 * This module exists because the form used to hold its own array of required
 * fields, in its own words ("model number", "product id / SKU code", "frame size
 * (type it, e.g. 54-16-135)"), while the bulk sheet demanded a similar but not
 * identical list on the server. Three consequences, all of them real:
 *
 *  1. A field required by one door and not the other. The sheet's own copy even
 *     asked for things no manufacturer could supply through the form (and vice
 *     versa), so the same product was valid in one path and refused in the other.
 *  2. A message that no longer matched the reason. When the server changed, the
 *     browser list did not, so people were told to fix the wrong field.
 *  3. Silence when the specification cannot be read. An earlier version of this
 *     helper kept the local list as a fallback, which meant the page could
 *     disagree with the server and nobody would notice; the fallback is gone. If
 *     the spec cannot be fetched, the form validates nothing client-side and the
 *     server's answer becomes the message - which is the same ruleset, and never
 *     a page that quietly enforces something the API does not.
 *
 * Per-category attribute rules (contact-lens optics, solution pack pricing, frame
 * enums) are the schema's business and are never listed here; this covers only
 * what an upload must carry before the schema is consulted.
 */

const isBlank = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.filter((v) => String(v ?? '').trim()).length === 0);

/** The image rule as written for a form: at least one usable http(s) link. */
const usableImages = (list) =>
  (Array.isArray(list) ? list : String(list ?? '').split('|'))
    .map((v) => String(v ?? '').trim())
    .filter((v) => /^https?:\/\//i.test(v)).length;

/**
 * @param spec   the object returned by GET /api/manufacturer/upload-spec
 * @param values the form model
 * @returns {string[]} human labels, in the order the form should show them
 */
export function missingUploadFields(spec, values = {}) {
  if (!spec || !Array.isArray(spec.upload)) return [];
  const missing = [];

  for (const item of spec.upload) {
    const value = values[item.field];
    if (item.field === 'images') {
      if (!usableImages(value)) missing.push(item.label);
      continue;
    }
    if (item.field === 'price') {
      if (!(Number(value) > 0)) missing.push(item.label);
      continue;
    }
    if (isBlank(value)) missing.push(item.label);
  }

  /*
   * Frame measurements. The server requires them for any product in a frame
   * category, so the form must refuse the same rows before the upload starts;
   * `dimensions` is deliberately looser than the other four because a measured
   * size ("54-16-135") or the four separate numbers both satisfy it, mirroring
   * hasDimensions() on the server.
   */
  const categoryFields = spec.uploadCategoryFields?.[values.category];
  if (Array.isArray(categoryFields)) {
    for (const item of categoryFields) {
      if (item.field === 'dimensions') {
        const derived =
          String(values.frameSize ?? '')
            .split(/[\s\-x/]+/i)
            .map((n) => parseInt(n, 10))
            .filter(Number.isFinite).length >= 3;
        const four = ['dimWidth', 'dimHeight', 'dimBridge', 'dimTemple'].every((k) => Number(values[k]) > 0);
        if (!derived && !four && isBlank(values.dimensions)) missing.push(item.label);
        continue;
      }
      if (item.field === 'frameWidth' || item.field === 'frameWeight') {
        const n = Number(String(values[item.field] ?? '').replace(/[^0-9.\-]/g, ''));
        if (isBlank(values[item.field])) missing.push(item.label);
        else if (!(n > 0)) missing.push(item.label);
        continue;
      }
      if (isBlank(values[item.field])) missing.push(item.label);
    }
  }

  /*
   * A powered product has to say which prescription ranges it offers, or the
   * configurator shows a picker with nothing behind it. This one is the schema's
   * rule, not the form's, so it is *not* asserted here when the spec failed to
   * load: the server refuses it, in the same words every time.
   */
  if (values.poweredOptionsAvailable && (values.prescriptionLensTypes || []).length === 0) {
    missing.push('Prescription lens types offered');
  }

  return missing;
}

/** The sentence the submit button shows; identical in shape to the sheet's. */
export function missingUploadMessage(missing) {
  return `Add the required details first: ${missing.join(', ')}`;
}
