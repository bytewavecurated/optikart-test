/**
 * Every charge a customer pays, computed in one place.
 *
 * This module exists because the numbers were assembled in three different
 * locations - the order route, the checkout sidebar, and the per-seller split -
 * and they had already drifted: the server added a 2% platform fee to the
 * amount charged, while the price panel a customer reads showed only subtotal,
 * delivery and discount. A quote that leaves out a fee is not a quote, and 2%
 * of ₹9,000 is not a rounding error.
 *
 * So the quote endpoint, the order creation route, and the client all read the
 * same arithmetic. The client no longer sums anything itself; it asks, and shows
 * the answer, because a browser-side recomputation is exactly how a displayed
 * total and a charged total come to differ.
 *
 * CodHandlingFee
 * --------------
 * ₹39 flat, per order, when the customer pays cash on delivery. It is a handling
 * charge for the cash leg - the run which has to happen before money moves, the
 * note which has to be reconciled against the partner's collection, the refund
 * which cannot be automatic - and it is charged per order, not per seller, even
 * when one basket splits across several shops.
 *
 * It sits on the order (`codFee`) rather than hidden inside `totalAmount`, for
 * three reasons: cash reconciliation has to prove the ₹39 was collected, not
 * infer it by subtraction; refunds have to know which part of the money is not
 * coming back; and an admin reading an order should see the charge as its own
 * line, the way the customer saw it.
 *
 * Not refundable. When a COD order is returned, the goods money comes back; the
 * handling of the cash leg was already spent. That is stated here and in the
 * checkout copy, because the polite version - "fees may apply" - is how
 * customers end up disputing a ₹39 charge as unfair, and the platform ends up
 * defending a charge it never clearly told anyone about.
 */

export const COD_HANDLING_FEE = 39;
export const PLATFORM_FEE_PERCENT = 2;

/*
 * Delivery is priced per item (₹16), not per order and not by a free-above
 * threshold. That is how every existing order was already billed, and a "cleaner
 * policy" invented here would have quietly changed what customers pay while
 * looking like a refactor. If the platform itself ends up delivering the order
 * rather than the shop, an additional `SELF_DELIVERY_PER_ITEM` is billed per
 * line - but only once routing decides who delivers, which is after checkout,
 * so it cannot be quoted as a fact and is tracked as a separate charge.
 */
export const DELIVERY_PER_ITEM = 16;
export const SELF_DELIVERY_PER_ITEM = 59;

/**
 * The whole customer-facing bill, from cart contents plus a coupon.
 *
 * `lines` are `{ price, quantity }` pairs already resolved from the catalogue:
 * prices come from the database, never from the caller, so a quote cannot be
 * talked into a different number than the order will use.
 */
export const quoteCharges = ({ lines = [], paymentMethod = 'online', couponDiscount = 0 }) => {
  const isCod = String(paymentMethod) === 'cod';
  const itemCount = lines.reduce((n, l) => n + (Number(l.quantity) || 1), 0);
  const subtotal = lines.reduce((sum, l) => sum + (Number(l.price) || 0) * (Number(l.quantity) || 1), 0);

  /*
   * Grouped by seller, because that is what an order actually is.
   *
   * One basket that breaks into three shops becomes three order documents, each
   * with its own delivery, platform fee and share of a discount. A quote
   * computed once over the whole basket and splits computed per seller cannot
   * agree to the rupee - rounding happens in different places - and when the
   * number at checkout is a rupee off the number charged, the customer is left
   * adjudicating arithmetic. So the quote walks the same grouping the order
   * route does.
   */
  const groups = new Map();
  for (const l of lines) {
    const key = String(l.seller || l.sellerId || 'single');
    const g = groups.get(key) || { seller: key, subtotal: 0, items: 0 };
    g.subtotal += (Number(l.price) || 0) * (Number(l.quantity) || 1);
    g.items += Number(l.quantity) || 1;
    groups.set(key, g);
  }
  const groupList = [...groups.values()];

  let deliveryTotal = 0;
  let platformTotal = 0;
  let discountAllocated = 0;

  for (const g of groupList) {
    g.delivery = g.items * DELIVERY_PER_ITEM;
    g.platformFee = Math.round(g.subtotal * (PLATFORM_FEE_PERCENT / 100));
    // A discount is shared in proportion to what each shop's part of the basket
    // is worth, the same way the order route splits it, so the last group cannot
    // be handed a rounding remainder nobody agreed to.
    g.discount = subtotal > 0 && couponDiscount > 0
      ? Math.round(Number(couponDiscount) * (g.subtotal / subtotal))
      : 0;
    g.discount = Math.min(g.discount, g.subtotal + g.delivery + g.platformFee);
    g.total = Math.max(0, g.subtotal + g.delivery + g.platformFee - g.discount);
    // The cash-handling charge rides on one document of the purchase, never one
    // per shop: it pays for the cash leg of the delivery, and there is one
    // payment event however many sellers the basket was split between.
    g.codFee = 0;
    deliveryTotal += g.delivery;
    platformTotal += g.platformFee;
    discountAllocated += g.discount;
  }

  if (isCod && groupList.length) groupList[0].codFee = COD_HANDLING_FEE;

  const codHandlingFee = groupList.reduce((n, g) => n + g.codFee, 0);
  const payable = groupList.reduce((n, g) => n + g.total + g.codFee, 0);

  return {
    groups: groupList.map((g) => ({
      seller: g.seller, subtotal: g.subtotal, deliveryCharges: g.delivery,
      platformFee: g.platformFee, codFee: g.codFee, discount: g.discount, total: g.total + g.codFee
    })),
    subtotal,
    deliveryCharges: deliveryTotal,
    platformFee: platformTotal,
    platformFeePercent: PLATFORM_FEE_PERCENT,
    codHandlingFee,
    isCod,
    discount: discountAllocated,
    total: payable,
    itemCount,
    deliveryPerItem: DELIVERY_PER_ITEM,
    breakdown: [
      { key: 'subtotal', label: `Subtotal (${itemCount} item${itemCount === 1 ? '' : 's'})`, amount: subtotal },
      { key: 'delivery', label: `Delivery charges (${itemCount} x ₹${DELIVERY_PER_ITEM})`, amount: deliveryTotal },
      { key: 'platformFee', label: `Platform fee (${PLATFORM_FEE_PERCENT}%)`, amount: platformTotal },
      ...(codHandlingFee ? [{ key: 'codFee', label: 'Cash-on-delivery handling', amount: codHandlingFee }] : []),
      ...(discountAllocated ? [{ key: 'discount', label: 'Coupon discount', amount: -discountAllocated }] : [])
    ]
  };
};

/*
 * Money that comes back when an order is returned or cancelled.
 *
 * The cash-handling charge stays with the platform - paying for the cash leg was
 * already spent - and everything else is refundable. Returned as a number rather
 * than a paragraph so no route has to interpret the policy and two routes cannot
 * interpret it differently.
 */
export const refundableAmount = (order) => {
  const total = Number(order?.totalAmount) || 0;
  if (order?.paymentMethod !== 'cod') return total;
  return Math.max(0, total - (Number(order?.codFee) || 0));
};
