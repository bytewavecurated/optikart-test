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
 * Matching is case-insensitive on trimmed values: "Ray-Ban" and "ray-ban" are one
 * brand to a shopper, so they must be one brand to the check as well.
 */
export const foldBrand = (name) =>
  String(name ?? '')
    .trim()
    .toLowerCase();

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
