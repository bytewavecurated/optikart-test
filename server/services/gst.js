import TaxRule from '../models/TaxRule.js';

/**
 * GST classification + inclusive-money maths for invoices.
 *
 * Retail prices in this market are GST-INCLUSIVE (MRP is the charged
 * amount). So an invoice does not add tax on top of what was charged - it
 * EXTRACTS tax from what was charged:
 *
 *   taxableExclusive = inclusive / (1 + rate/100)
 *   gstComponent     = inclusive - taxableExclusive
 *
 * printed rounded to paise with the rounding drift kept on the line, so
 * sum(line totals) == the order total the money actually moved at. That
 * equality is the whole point of this file and the invoice invariant to
 * match it.
 *
 * RATES: the table below is the platform's DECLARED classification of
 * record (HSN/SAC + slab as commonly applied to online eyewear retail:
 * spectacle frames/lenses and sun-glasses under HSN 9004 at 18%, contact
 * lenses at their 9001 slab, care solutions under 3401/3307 lines,
 * accessories by material). Classification is ultimately a tax-profession
 * question - PRODUCTION-CHECKLIST item A-1 carries the CA sign-off action
 * and `TaxRule.confirmed` keeps the system's side of it honest; per-scope
 * overrides exist precisely because a ruling can change what a default
 * says.
 */

const R18 = 18,
  R12 = 12,
  R5 = 5;

/** Default HSN + rate by catalogue category. */
export const CATEGORY_TAX_DEFAULTS = {
  sunglasses: { hsn: '9004', rate: R18, why: 'sunglasses, spectacle frames & lenses (HSN 9004)' },
  eyeglasses: { hsn: '9004', rate: R18, why: 'spectacles incl prescription (HSN 9004)' },
  readingglasses: { hsn: '9004', rate: R18, why: 'reading spectacles (HSN 9004)' },
  contactlenses: { hsn: '9001', rate: R12, why: 'contact lenses (HSN 9001)' },
  lenssolution: { hsn: '3307', rate: R18, why: 'care solutions (HSN 3307)' },
  sportseyewear: { hsn: '9004', rate: R18, why: 'sports/protective eyewear (HSN 9004)' },
  kids: { hsn: '9004', rate: R18, why: 'kids spectacles (HSN 9004)' },
  accessories: { hsn: '4202', rate: R18, why: 'cases/accessories by material (HSN 4202)' },
};

/** SAC codes for the service lines that appear on customer documents. */
export const SERVICE_SAC = {
  delivery: { sac: '9965', rate: R18, why: 'goods transport / courier service' },
  platform: { sac: '9972', rate: R18, why: 'business / marketplace support service' },
  cod: { sac: '9972', rate: R18, why: 'cash-handling surcharge (support service)' },
  // services the platform bills the SELLER for
  commission: { sac: '9972', rate: R18, why: 'platform commission - marketplace services' },
  fulfilment: { sac: '9965', rate: R18, why: 'delivery-fulfilment recharge' },
};

/**
 * Resolve the classification for one product line.
 * Priority: product override > brand override > category default > 9004/18
 * (the eyewear floor). `rules` may be pre-loaded (one query per invoice,
 * never per line).
 */
export async function resolveLineClass(product, rules = null) {
  const list = rules ?? (await TaxRule.find({}).lean());
  const asKey = (v) =>
    String(v ?? '')
      .trim()
      .toLowerCase();
  const byScope = (scope, value) => list.find((r) => r.scope === scope && asKey(r.value) === asKey(value)) || null;

  const hit = byScope('product', String(product?._id || '')) ||
    byScope('brand', product?.brand) ||
    byScope('category', product?.category) ||
    CATEGORY_TAX_DEFAULTS[asKey(product?.category)] || {
      hsn: '9004',
      rate: R18,
      why: 'default eyewear classification',
    };

  // a rule row's own field is `ratePercent`; the default-table rows use `rate`.
  // Reading ONE name was the entire bug behind "saved rules do nothing" (the
  // first live pass of the invoicing suite: I17/I18 failed for exactly this).
  return { hsn: String(hit.hsn || '9004'), rate: Number(hit.ratePercent ?? hit.rate ?? R18) };
}

/** GST split from an inclusive amount; exact to paise, drift returned too. */
export const extractInclusiveTax = (inclusive, ratePercent) => {
  const inc = Math.max(0, Number(inclusive) || 0);
  const exclRaw = inc / (1 + ratePercent / 100);
  const tax = inc - exclRaw;
  return {
    exclusive: Math.round(exclRaw * 100) / 100,
    gst: Math.round(tax * 100) / 100,
  };
};

/** Same-state split: CGST+SGST halves; otherwise the full IGST. */
export const splitTax = (gstAmount, intraState) => {
  const half = Math.round((Math.max(0, Number(gstAmount) || 0) / 2) * 100) / 100;
  if (!intraState) return { cgst: 0, sgst: 0, igst: Math.round(gstAmount * 100) / 100 };
  const total = Math.round(gstAmount * 100) / 100;
  return { cgst: half, sgst: Math.round((total - half) * 100) / 100, igst: 0 };
};

export const sameState = (a, b) => {
  const norm = (v) =>
    String(v || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  return !!a && !!b && norm(a) === norm(b);
};
