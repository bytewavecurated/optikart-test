import Product from '../models/Product.js';
import { emitInventoryAlert } from './websocket.js';

/**
 * Single owner of every physical stock movement.
 *
 * Before this existed, order creation decremented `product.stock` and the matching
 * variant with a loose match (`!variant.color || v.color === x`), which meant an
 * ordered item with no colour silently drained whichever variant happened to be
 * first, and cancellations or returns never put anything back.
 *
 * Rules now enforced here:
 *  - A variant matches only when every selection the buyer made matches it. Partial
 *    or absent selections fall back to the product-level pool, never to variant [0].
 *  - When a product has variants, `product.stock` is the sum of active variant
 *    stock, so the seller's inventory view and the storefront can never disagree.
 *  - Every movement checks the low-stock threshold and emits a realtime alert.
 */

const LOW_STOCK_THRESHOLD = 5;

const sameToken = (a, b) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/**
 * Find the variant a cart line refers to.
 * Only the fields the line actually specifies are compared; a line that specifies
 * nothing returns null so the product-level pool is used instead.
 */
export const matchVariant = (product, selection = {}) => {
  if (!product?.variants?.length) return null;

  const wanted = Object.entries({
    color: selection.color,
    size: selection.size,
    gender: selection.gender
  }).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');

  if (wanted.length === 0) return null;

  return product.variants.find((v) => wanted.every(([key, value]) => {
    if (key === 'gender') return sameToken(v.gender, value) || sameToken(product.gender, value);
    return sameToken(v[key], value);
  })) || null;
};

/** Re-derive the product-level pool from its active variants. */
const syncProductStock = (product) => {
  if (!product.variants || product.variants.length === 0) return product;
  const total = product.variants
    .filter((v) => v.isActive !== false)
    .reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);
  product.stock = total;
  return product;
};

const alertIfLow = async (io, product, sellerId) => {
  if (typeof product.stock !== 'number') return;
  if (product.stock > LOW_STOCK_THRESHOLD) return;
  try {
    const { default: Seller } = await import('../models/Seller.js');
    const seller = sellerId ? { _id: sellerId } : await Product.findById(product._id).select('seller').lean();
    const id = sellerId || seller?.seller;
    if (!id || !io) return;
    emitInventoryAlert(io, id, product, product.stock === 0 ? 'out_of_stock' : 'low_stock');
  } catch (e) {
    // An alert must never roll back a stock movement.
    console.error('Inventory alert skipped:', e.message);
  }
};

/**
 * Deduct stock for a saved order. Called on checkout.
 * Throws only when a line cannot be fulfilled at all, so a partially
 * fulfillable cart is never silently oversold.
 */
export const deductStockForOrder = async (order, io = null) => {
  const report = { deducted: [], restocked: [], shortages: [] };

  for (const line of order.items || []) {
    const product = await Product.findById(line.product);
    if (!product) {
      report.shortages.push({ reason: 'product-missing' });
      continue;
    }

    const qty = Math.max(1, Number(line.quantity) || 1);
    const variant = matchVariant(product, line.variant || {});

    /*
     * The guard lives in the query, not in a value read beforehand: the update
     * only applies to a document whose stock is still sufficient at the moment
     * Mongo executes it. Read-check-save let two concurrent orders both see "1
     * left" and both write, which oversold the last unit and lost whatever the
     * seller had changed on the product in between (a whole-document save
     * overwrites their edit). No rows modified therefore means someone beat this
     * order to it, and is reported as a shortage instead of forcing stock
     * negative.
     */
    const movement = {
      type: 'out',
      quantity: qty,
      reason: 'sale',
      order: String(order._id),
      variant: variant ? String(variant._id) : null,
      at: new Date()
    };

    let took = null;
    if (variant) {
      const updated = await Product.updateOne(
        {
          _id: product._id,
          // $elemMatch is what makes this correct: it requires one and the same
          // variant to be the chosen one AND to still hold enough stock. A
          // 'variants.$[v].stock' condition here would not work at all - the
          // filtered positional operator only exists on the update side, so the
          // guard would silently match nothing and every order would read as sold
          // out. product-level stock moves in the same write, and because it is
          // maintained as the sum of variant stock, it cannot disagree.
          variants: { $elemMatch: { _id: variant._id, stock: { $gte: qty } } }
        },
        {
          $inc: {
            // product.stock is the sum of active variant stock, so it moves by
            // the same amount in the same atomic write.
            stock: -qty,
            'variants.$[v].stock': -qty
          },
          $push: { stockMovementLog: { $each: [movement], $slice: -200 } }
        },
        { arrayFilters: [{ 'v._id': variant._id }] }
      );
      took = updated.modifiedCount > 0 ? qty : null;
    } else {
      const updated = await Product.updateOne(
        { _id: product._id, stock: { $gte: qty } },
        { $inc: { stock: -qty }, $push: { stockMovementLog: { $each: [movement], $slice: -200 } } }
      );
      took = updated.modifiedCount > 0 ? qty : null;
    }

    if (took === null) {
      // Re-read only to report the true current figure to the shopper.
      const fresh = await Product.findById(product._id).lean();
      const freshVariant = fresh ? matchVariant(fresh, line.variant || {}) : null;
      const have = freshVariant ? Number(freshVariant.stock) || 0 : Number(fresh?.stock) || 0;
      report.shortages.push({
        product: product.title,
        variant: variant ? `${variant.color || ''} ${variant.size || ''}`.trim() : undefined,
        need: qty,
        have
      });
      continue;
    }

    /*
     * The log entry was written in the same atomic update above. Reading the
     * document again is only for the low-stock alert, never to decide or write
     * stock: saving the document fetched before this update would have written
     * the old stock figure straight back over the decrement we just made.
     */
    const after = await Product.findById(product._id).lean();
    await alertIfLow(io, after, order.seller);
    report.deducted.push({
      product: String(product._id),
      variant: variant ? String(variant._id) : null,
      qty
    });
  }

  return report;
};

/**
 * Return stock for a saved order: cancellation, rejected payment, or a
 * completed return/exchange where goods come back.
 */
export const restoreStockForOrder = async (order, io = null, { reason = 'restore' } = {}) => {
  const restored = [];

  for (const line of order.items || []) {
    const product = await Product.findById(line.product);
    if (!product) continue;

    const qty = Math.max(1, Number(line.quantity) || 1);
    const variant = matchVariant(product, line.variant || {});

    // Guard against inflating stock if a movement was already reversed.
    const alreadyApplied = (product.stockMovementLog || []).some(
      (m) => m.order === String(order._id) && m.reason === reason && m.type === 'in'
    );
    if (alreadyApplied) continue;

    /*
     * Adding stock back is not the same risk as taking it away, but it fails the
     * same way: saving the document read at the top of this loop overwrites any
     * change the seller made in between, including stock a different order just
     * took. Same treatment - an atomic conditional increment, log in the same
     * write, and the double-reversal guard re-checked in the query.
     */
    const movement = {
      type: 'in',
      quantity: qty,
      reason,
      order: String(order._id),
      variant: variant ? String(variant._id) : null,
      at: new Date()
    };

    if (variant) {
      await Product.updateOne(
        {
          _id: product._id,
          // Same reasoning as the deduction: pair the variant identity and the
          // "not already reversed" guard in one $elemMatch-anchored match.
          variants: { $elemMatch: { _id: variant._id } },
          stockMovementLog: { $not: { $elemMatch: { order: String(order._id), reason, type: 'in' } } }
        },
        {
          $inc: { stock: qty, 'variants.$[v].stock': qty },
          $push: { stockMovementLog: { $each: [movement], $slice: -200 } }
        },
        { arrayFilters: [{ 'v._id': variant._id }] }
      );
    } else {
      await Product.updateOne(
        {
          _id: product._id,
          'stockMovementLog': { $not: { $elemMatch: { order: String(order._id), reason, type: 'in' } } }
        },
        { $inc: { stock: qty }, $push: { stockMovementLog: { $each: [movement], $slice: -200 } } }
      );
    }
    restored.push({ product: String(product._id), variant: variant ? String(variant._id) : null, qty });
  }

  return restored;
};

/**
 * Sellable quantity for an exact configuration, used when matching a buyer's
 * chosen colour/size against the sellers that can actually fulfil it.
 */
export const stockForConfig = async (productId, selection = {}) => {
  const product = await Product.findById(productId);
  if (!product) return 0;
  const variant = matchVariant(product, selection);
  if (variant) return Math.max(0, Number(variant.stock) || 0);
  return Math.max(0, Number(product.stock) || 0);
};

export { LOW_STOCK_THRESHOLD, syncProductStock };
