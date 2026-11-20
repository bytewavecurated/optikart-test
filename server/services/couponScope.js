import { foldBrand } from './brandOwnership.js';

/**
 * Coupon scope, decided ONCE and enforced at every door.
 *
 * The model has carried `applicableCategories` for as long as these routes
 * have existed, and NO redemption path ever read it: a 'FESTIVE10 - eyeglasses
 * only' voucher worked on sunglasses, contact lenses and (in the order door)
 * the FULL cart subtotal, silently giving away discount on lines it was never
 * issued for. Scope is a promise made in the admin form; this is the code
 * that keeps it, on both validate and checkout, and prices the discount only
 * over the lines actually in scope.
 *
 * Rules (documented, in the order the caller receives them):
 *  - No scope at all: unchanged behaviour - eligible, base = whole subtotal.
 *  - Categories and/or brands set: an order line must match EVERY scope list
 *    that is non-empty on that one line (a brand filter does not override a
 *    category filter); a coupon on an order with no matching line is refused
 *    with the reason naming the categories/brands it exists for.
 *  - Discount base once eligible: percentage - the matched lines' subtotal
 *    only (bounded by maxDiscount exactly as before); fixed - charged whole
 *    only against the matched base and never more than it, so a scope-limited
 *    ₹500 coupon can zero a ₹400 eligible set and nothing further.
 *  - Minimum order check moves with it: an ₹2000-with-₹1000-glasses-coupon
 *    means the cart must hold ₹1000 IN GLASSES. That reading is what the form
 *    has always implied; orders that are entirely in-scope get identical
 *    numbers as previously.
 */

const norm = (list) => (Array.isArray(list) ? list.map((v) => String(v || '')).filter(Boolean) : []);

export function couponLineEligible(coupon, line) {
  const cats = norm(coupon.applicableCategories);
  const brands = norm(coupon.applicableBrands);
  if (
    cats.length &&
    !cats.includes(
      String(line.category || '')
        .trim()
        .toLowerCase()
    )
  )
    return false;
  if (brands.length && !brands.some((b) => foldBrand(b) === foldBrand(line.brand || ''))) return false;
  return true;
}

export function couponScopeResult(coupon, lines, fullSubtotal) {
  const cats = norm(coupon.applicableCategories).join('/');
  const brands = norm(coupon.applicableBrands)
    .map((b) => b)
    .join(', ');
  if (!cats.length && !brands.length) {
    return { eligible: true, base: fullSubtotal, matched: fullSubtotal, scopeLabel: '' };
  }
  const matchedLines = lines.filter((l) => couponLineEligible(coupon, l));
  const matched = matchedLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const scopeLabel = [cats ? `categories ${cats}` : '', brands ? `brands ${brands}` : ''].filter(Boolean).join(' and ');
  if (!matchedLines.length) {
    return {
      eligible: false,
      reason: `This coupon applies only to ${scopeLabel}, and none of the items in this order are in scope.`,
    };
  }
  return { eligible: true, base: matched, matched, anyMatched: true, scopeLabel };
}

/** discount in rupees from a coupon plus its scope answer, single formula used by both doors. */
export function couponDiscountFor(coupon, scope) {
  if (!scope.eligible) return { ok: false, reason: scope.reason };
  if (coupon.discountType === 'percentage') {
    let d = (scope.base * Number(coupon.discountValue || 0)) / 100;
    if (coupon.maxDiscount && d > coupon.maxDiscount) d = coupon.maxDiscount;
    return { ok: true, discount: Math.round(d) };
  }
  const d = Math.min(Number(coupon.discountValue || 0), Math.max(0, scope.base));
  return { ok: true, discount: Math.round(d) };
}
