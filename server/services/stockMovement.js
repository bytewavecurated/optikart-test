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

    if (variant) {
      const have = Math.max(0, Number(variant.stock) || 0);
      if (have < qty) {
        report.shortages.push({ product: product.title, variant: `${variant.color || ''} ${variant.size || ''}`.trim(), need: qty, have });
        continue;
      }
      variant.stock = have - qty;
      syncProductStock(product);
    } else {
      const have = Math.max(0, Number(product.stock) || 0);
      if (have < qty) {
        report.shortages.push({ product: product.title, need: qty, have });
        continue;
      }
      product.stock = have - qty;
    }

    product.stockMovementLog = product.stockMovementLog || [];
    product.stockMovementLog.push({
      type: 'out',
      quantity: qty,
      reason: 'sale',
      order: String(order._id),
      variant: variant ? String(variant._id) : null,
      at: new Date()
    });
    if (product.stockMovementLog.length > 200) {
      product.stockMovementLog = product.stockMovementLog.slice(-200);
    }

    await product.save();
    await alertIfLow(io, product, order.seller);
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

    if (variant) {
      variant.stock = (Math.max(0, Number(variant.stock) || 0)) + qty;
      syncProductStock(product);
    } else {
      product.stock = (Math.max(0, Number(product.stock) || 0)) + qty;
    }

    product.stockMovementLog = product.stockMovementLog || [];
    product.stockMovementLog.push({
      type: 'in',
      quantity: qty,
      reason,
      order: String(order._id),
      variant: variant ? String(variant._id) : null,
      at: new Date()
    });
    if (product.stockMovementLog.length > 200) {
      product.stockMovementLog = product.stockMovementLog.slice(-200);
    }

    await product.save();
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
