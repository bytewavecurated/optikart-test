import Manufacturer from '../models/Manufacturer.js';

/**
 * Brand ownership, resolved once per write.
 *
 * Your model: a brand name belongs to exactly one manufacturer. This is not a
 * tidiness rule - brand rails, approval queues and retailer catalogues all group
 * by the brand string alone, so two companies claiming one name means a public
 * page attributes one manufacturer's frames to another. That is the kind of error
 * customers see and support cannot explain away.
 *
 * Matching is case- AND punctuation-insensitive, because a shopper reads the
 * mark, not the bytes: "Ray-Ban", "ray ban", "RAY_BAN" and "RayBan" are one
 * brand to them, so they are one brand here. Trimming alone (the previous rule)
 * let "Acme Optics" and "acme-optics" through as two separate brands - which is
 * precisely the split this check exists to prevent, since rails, approval queues
 * and retailer catalogues all group by the brand string alone.
 *
 * `models/Brand.js` uses this same function for its unique `slug`. There must be
 * one definition: a looser API fold with a stricter index (or the reverse) means
 * routes attribute a brand to one manufacturer while the database accepts a
 * second row a shopper cannot tell apart from the first.
 */
export const foldBrand = (name) => {
  const raw = String(name ?? '').trim();
  if (!raw) return '';
  /*
   * Accent marks are removed, not stripped out with the letter. An earlier
   * version did `.replace(/[^a-z0-9]+/g, '')` directly, which silently deleted
   * characters outside ASCII: "Nuàn" folded to "nun", so it *failed* to collide
   * with "Nuan" (two brands a shopper reads as one) and *did* collide with
   * "Nùn" (two genuinely different brands landing on one slug). Both directions
   * wrong, and invisible until tested with a non-ASCII name.
   *
   * NFKD splits a precomposed letter into base + combining marks; dropping the
   * marks leaves "nuan", which is the comparison we actually want.
   */
  const folded = raw
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 80);
  /*
   * Scripts with no Latin decomposition (Devanagari, Japanese, Korean, Greek
   * brands) fold to an empty string under the rule above. A blank slug would put
   * every one of them in conflict on the Brand unique index, so those names fall
   * back to their own case-folded spelling: still compared consistently, and no
   * two different marks are ever told they are the same brand.
   */
  if (folded) return folded;
  return raw.toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
};

/**
 * Map of every *other* manufacturer's brand name -> who owns it.
 *
 * Loaded once per sheet or profile save rather than queried per row: a 200-line
 * upload would otherwise do 200 lookups to answer one question, and rows repeating
 * a brand name get the same answer. No regex is built from user input - brand
 * names are compared as folded strings in memory, so a name containing characters
 * that are also pattern syntax cannot corrupt the check.
 */
export const brandOwnersByFoldedName = async (selfManufacturerId) => {
  const others = await Manufacturer.find(selfManufacturerId ? { _id: { $ne: selfManufacturerId } } : {}, {
    companyName: 1,
    brands: 1,
  }).lean();

  const owners = new Map();
  for (const other of others) {
    for (const raw of other.brands || []) {
      const folded = foldBrand(raw);
      if (folded && !owners.has(folded)) {
        owners.set(folded, { company: other.companyName || 'another manufacturer', brand: String(raw).trim() });
      }
    }
  }
  return owners;
};

export const clashMessage = (c) =>
  `"${c.brand}" is already owned by ${c.owner} (declared there as "${c.ownerBrand}"). One brand name has one manufacturer - upload under a brand you own, or ask OptiKart to reassign it.`;

/**
 * Validate a proposed brand list for one manufacturer.
 *
 * Own-account brands are excluded from the conflict set, so re-saving an
 * unchanged profile never refuses itself; a clash is about other owners, not
 * about history.
 */
export const validateBrandListOwnership = async (brands, selfManufacturerId) => {
  const owners = await brandOwnersByFoldedName(selfManufacturerId);
  const clashes = [];
  for (const raw of brands || []) {
    const owner = owners.get(foldBrand(raw));
    if (owner) clashes.push({ brand: String(raw).trim(), owner: owner.company, ownerBrand: owner.brand });
  }
  return { clashes, owners, clashMessage };
};
