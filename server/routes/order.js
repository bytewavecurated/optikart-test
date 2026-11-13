import express from 'express';
import {
  quoteCharges,
  DELIVERY_PER_ITEM,
  COD_HANDLING_FEE,
  PLATFORM_FEE_PERCENT,
  refundableAmount
} from '../config/fees.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import Coupon from '../models/Coupon.js';
import { verifyToken } from '../middleware/auth.js';
import { deductStockForOrder, restoreStockForOrder, matchVariant } from '../services/stockMovement.js';
import { assertPrescriptionVerified } from '../services/prescriptionGate.js';
import { startRouting } from '../services/orderProximity.js';
import { orderValidation } from '../middleware/validate.js';
import { sendOrderConfirmation, sendOrderStatusNotification } from '../services/email.js';

const router = express.Router();

// Rs. 59 per product line on platform-run deliveries.
const SELF_DELIVERY_FEE_PER_ITEM = 59;

router.post('/', verifyToken, orderValidation, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, couponCode, prescription, prescriptionId } = req.body;
    const userId = req.user._id;

    /*
     * Lenses that have to be ground are a clinical instruction, not a preference.
     * Checked before stock, coupons or a payment intent so a refusal never leaves
     * a half-applied order behind.
     */
    const rxGate = await assertPrescriptionVerified({
      userId,
      prescriptionId: prescriptionId || prescription?.prescription,
      lines: items || []
    });
    if (!rxGate.ok) {
      console.warn(`Order refused for user ${userId}: ${rxGate.code}`);
      return res.status(403).json({ success: false, code: rxGate.code, message: rxGate.message });
    }

    let subtotal = 0;
    const sellerItems = {};

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({ success: false, message: `Product ${item.product} not found.` });
      }

      if (!product.isActive) {
        return res.status(400).json({ success: false, message: `Product "${product.title}" is no longer available.` });
      }

      // Price and availability come from the exact colour/size the buyer chose,
      // not just the product-level defaults.
      const chosenVariant = matchVariant(product, item.variant || {});
      const available = chosenVariant
        ? (chosenVariant.stock || 0)
        : (product.stock || 0);

      if (available < item.quantity) {
        const which = chosenVariant
          ? ` (${[chosenVariant.color, chosenVariant.size].filter(Boolean).join(' / ')})`
          : '';
        return res.status(400).json({ success: false, message: `Insufficient stock for "${product.title}"${which}. Only ${available} available.` });
      }

      const variantPrice = chosenVariant ? (chosenVariant.discountedPrice || chosenVariant.price) : null;
      const price = variantPrice || product.discountedPrice || product.price;
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      const sellerId = product.seller.toString();
      if (!sellerItems[sellerId]) {
        sellerItems[sellerId] = [];
      }
      sellerItems[sellerId].push({
        product: product._id,
        variant: item.variant || {},
        quantity: item.quantity,
        price
      });

    }

    let couponDiscount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
      });

      if (!coupon) {
        return res.status(400).json({ success: false, message: 'Invalid or expired coupon.' });
      }

      if (coupon.minOrderAmount > 0 && subtotal < coupon.minOrderAmount) {
        return res.status(400).json({ success: false, message: `Minimum order amount of ₹${coupon.minOrderAmount} required.` });
      }

      if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
        return res.status(400).json({ success: false, message: 'Coupon usage limit reached.' });
      }

      const alreadyUsed = coupon.usedBy.some(u => u.user.toString() === userId.toString());
      if (alreadyUsed) {
        return res.status(400).json({ success: false, message: 'Coupon already used by you.' });
      }

      if (coupon.discountType === 'percentage') {
        couponDiscount = (subtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
          couponDiscount = coupon.maxDiscount;
        }
      } else {
        couponDiscount = coupon.discountValue;
      }
    }

    /*
     * The customer-facing bill, from the same function the quote endpoint and
     * the checkout screen use. Inlined arithmetic here is how the order total
     * and the price panel a customer reads came to disagree: the server charged
     * a 2% platform fee that the panel never showed.
     */
    /*
     * Priced from the resolved lines, never from `req.body.items`.
     *
     * The request array carries product ids and quantities only: prices, stock
     * and the seller of each line are decided above, from the catalogue and the
     * exact colour/size the buyer chose. Quoting from the request therefore used
     * `price: undefined` for every line, and while that looked harmless - the
     * per-seller arithmetic below still produced correct order totals - it made
     * the quote useless as the source of truth, which is what it is now meant to
     * be. Anyone who later trusts `quote.platformFee` would bill zero.
     */
    const resolvedLines = Object.entries(sellerItems).flatMap(([sellerId, list]) =>
      list.map((i) => ({
        price: Number(i.price) || 0,
        quantity: Math.max(1, Number(i.quantity) || 1),
        seller: sellerId
      }))
    );

    /*
     * 'online' is a choice on a screen, not a payment channel: the order
     * document stores razorpay / card / upi / netbanking / wallet / cod. The
     * checkout sent the screen's word straight through and the write rejected
     * it, so a customer who picked an online method without the sub-channel
     * being resolved got a 500 after their cart was priced. Normalising here
     * means the quote, the stored order and the refund rule all speak about the
     * same thing: was cash involved or not.
     */
    const storedPaymentMethod = ['cod', 'razorpay', 'card', 'upi', 'netbanking', 'wallet'].includes(paymentMethod)
      ? paymentMethod
      : 'razorpay';

    const quote = quoteCharges({
      lines: resolvedLines,
      paymentMethod: storedPaymentMethod,
      couponDiscount
    });
    const totalItems = quote.itemCount;
    const deliveryCharge = quote.deliveryCharges;
    const platformFee = quote.platformFee;
    const codFee = quote.codHandlingFee;
    const totalAmount = quote.total;

    const orders = [];
    // Quote groups are consumed once each, so a split cannot borrow
    // another shop's rounding.
    const usedGroups = new Set();
    let codFeeClaimed = false;

    for (const [sellerId, sellerItemsList] of Object.entries(sellerItems)) {
      const sellerSubtotal = sellerItemsList.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const sellerItemCount = sellerItemsList.reduce((sum, item) => sum + item.quantity, 0);
      /*
       * Delivery, platform fee, discount share and the cash-handling charge come
       * from the quote's group for this shop rather than being recomputed here.
       * Two implementations of the same bill round differently; when checkout
       * showed one number and the order stored another, the customer was left to
       * reconcile arithmetic that was our job.
       */
      /*
       * Match the quote's group for this shop by seller key, and fall back to
       * the unconsumed groups in order. The grouping key comes from catalogue
       * seller ids, which are not always populated the same way on the line
       * items this route was handed; matching only on the key meant some
       * baskets found no group and shipped with the fee arithmetic in the
       * fallbacks - silently dropping the cash-handling charge from the total
       * while checkout had already shown it.
       */
      const group = quote.groups.find((g) => String(g.seller) === String(sellerId) && !usedGroups.has(g))
        || quote.groups.find((g) => !usedGroups.has(g))
        || {};
      usedGroups.add(group);
      const sellerDeliveryCharge = group.deliveryCharges ?? (sellerItemCount * DELIVERY_PER_ITEM);
      const sellerPlatformFee = group.platformFee ?? Math.round(sellerSubtotal * (PLATFORM_FEE_PERCENT / 100));
      // Charged to the customer up front for every order. If the platform ends up
      // delivering it (instead of Shiprocket) a further flat Rs. 59 per product
      // line is added, billed alongside the miscellaneous charges; that choice is
      // only known once routing completes, so it is stored as a quote and applied
      // by the delivery-fee recalculation at pickup time.
      const sellerSelfDeliveryCharge = 0;

      let sellerCouponDiscount = 0;
      if (couponDiscount > 0) {
        sellerCouponDiscount = Math.round((couponDiscount * sellerSubtotal) / subtotal);
      }

      /*
       * The cash-handling charge goes to exactly one document of this purchase.
       * Grouping decides the rest of the arithmetic; it must not decide whether
       * the customer pays the fee at all, because a grouped miss used to mean
       * checkout promised ₹39 and the order quietly did not include it.
       */
      const sellerCodFee = quote.isCod && !codFeeClaimed ? COD_HANDLING_FEE : 0;
      if (sellerCodFee) codFeeClaimed = true;
      const sellerTotal = Math.max(0, sellerSubtotal + sellerDeliveryCharge + sellerPlatformFee + sellerSelfDeliveryCharge - sellerCouponDiscount) + sellerCodFee;

      // Calculate commission (3% of subtotal after discounts)
      const commissionPercentage = 3;
      const commissionBase = sellerSubtotal - sellerCouponDiscount;
      const commissionAmount = Math.round(commissionBase * (commissionPercentage / 100));
      const sellerPayoutAmount = commissionBase - commissionAmount;

      const order = new Order({
        user: userId,
        seller: sellerId,
        items: sellerItemsList,
        shippingAddress,
        subtotal: sellerSubtotal,
        deliveryCharge: sellerDeliveryCharge,
        platformFee: sellerPlatformFee,
        // Flat ₹39 per customer order, never per seller split: one basket that
        // breaks into three shops is still one cash collection to reconcile. The
        // parent order holds the total the customer pays; the split that carries
        // the cash leg records it so the money can be traced to a document.
        codFee: sellerCodFee,
        selfDeliveryCharge: sellerSelfDeliveryCharge,
        totalAmount: sellerTotal,
        paymentMethod: storedPaymentMethod,
        paymentStatus: 'pending',
        orderStatus: 'pending',
        couponApplied: couponCode ? couponCode.toUpperCase() : undefined,
        couponDiscount: sellerCouponDiscount,
        prescription: rxGate.required
          ? {
              ...(prescription || {}),
              prescription: prescriptionId || prescription?.prescription,
              verificationStatus: rxGate.status
            }
          : prescription,
        // Commission tracking
        commissionPercentage,
        commissionAmount,
        sellerPayoutAmount,
        commissionPaid: false
      });

      await order.save();
      orders.push(order);

      // Deduct the exact colour/size the buyer chose for this seller's stock.
      const report = await deductStockForOrder(order, req.app.get('io'));
      if (report.shortages.length) {
        // Roll the whole checkout back rather than overselling.
        await Promise.all(orders.map((o) => Order.updateOne({ _id: o._id }, { orderStatus: 'cancelled', cancellationReason: 'Stock unavailable at checkout' })));
        await Promise.all(orders.map((o) => restoreStockForOrder(o, req.app.get('io'), { reason: 'checkout-rollback' })));
        return res.status(409).json({
          success: false,
          message: 'Some items sold out while you were checking out. Please review your cart.'
        });
      }
    }

    if (couponCode && couponDiscount > 0) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      if (coupon) {
        coupon.usedBy.push({
          user: userId,
          orderId: orders[0]._id,
          usedAt: new Date()
        });
        coupon.usageCount += 1;
        await coupon.save();
      }
    }

    await Cart.findOneAndUpdate(
      { user: userId },
      { items: [], totalItems: 0 }
    );

    await sendOrderConfirmation(req.user.email, orders[0]);

    // Hand each order to proximity routing: up to five nearby sellers who stock
    // the exact configuration are offered it in turn. If nobody is nearby the
    // order lands in the admin queue instead.
    try {
      for (const placed of orders) {
        await startRouting(placed, req.app.get('io'));
      }
    } catch (routeErr) {
      // Routing failure must never lose a placed order.
      console.error('Order routing skipped:', routeErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Order(s) created successfully.',
      orders
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const userId = req.user._id;

    const query = { user: userId };
    if (status) query.orderStatus = status;

    const orders = await Order.find(query)
      .populate('items.product', 'title images price')
      .populate('seller', 'storeName storeLogo')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/*
 * The bill before the order.
 *
 * The client used to assemble the summary itself from cart prices, which works
 * right up to the moment the server's rules move - and they had already moved:
 * the price panel showed subtotal, delivery and discount while the order also
 * charged a 2% platform fee. So the checkout asks for the number rather than
 * arriving at its own, and what a customer is shown comes out of the same
 * function that will price the order they place.
 *
 * Prices are read from the catalogue here, never taken from the request: a quote
 * built on client-supplied prices is a discount a caller can type in.
 */
router.post('/quote', async (req, res) => {
  try {
    const { items = [], paymentMethod = 'online', couponCode = '' } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'Add something to the cart first.' });
    }

    const lines = [];
    for (const entry of items.slice(0, 100)) {
      /*
       * `variants` has to be selected, and the chosen colour/size has to be
       * resolved with the same `matchVariant` the order route uses.
       *
       * Without them this endpoint silently priced every line at the
       * product-level figure, so a buyer selecting a variant that carries its
       * own price saw a lower total at checkout than the order charged. That is
       * the whole reason this endpoint exists - to make the displayed number and
       * the billed number come from one place - and a partial copy of the
       * pricing rules quietly defeats it: the quote said ₹2,910 and the order
       * charged ₹2,930 for the same basket.
       */
      const product = await Product.findById(entry.product || entry.productId || entry._id)
        .select('price discountedPrice title variants seller manufacturerSellerId')
        .lean();
      if (!product) continue;

      const chosenVariant = matchVariant(product, entry.variant || {});
      const variantPrice = chosenVariant
        ? (chosenVariant.discountedPrice || chosenVariant.price)
        : null;
      const effective = variantPrice || (Number(product.discountedPrice) > 0 ? product.discountedPrice : product.price);

      lines.push({
        price: Number(effective) || 0,
        quantity: Math.max(1, Number(entry.quantity) || 1),
        // The label the price panel can show next to a line, and the grouping
        // key so the quote splits the basket the way the order will.
        title: product.title,
        seller: String(product.seller || product.manufacturerSellerId || 'single')
      });
    }

    if (!lines.length) {
      return res.status(400).json({ success: false, message: 'None of those items can be bought right now.' });
    }

    let couponDiscount = 0;
    let coupon = null;
    if (couponCode) {
      const found = await Coupon.findOne({ code: String(couponCode).toUpperCase(), isActive: true }).lean();
      const subtotal = lines.reduce((n, l) => n + l.price * l.quantity, 0);
      if (found
        && (!found.expiresAt || new Date(found.expiresAt) >= new Date())
        && (!(found.minOrderAmount > 0) || subtotal >= found.minOrderAmount)
        && (!(found.usageLimit > 0) || (found.usageCount || 0) < found.usageLimit)) {
        coupon = found;
        if (found.discountType === 'percentage') {
          couponDiscount = (subtotal * found.discountValue) / 100;
          if (found.maxDiscount && couponDiscount > found.maxDiscount) couponDiscount = found.maxDiscount;
        } else {
          couponDiscount = found.discountValue;
        }
      }
    }

    const charges = quoteCharges({ lines, paymentMethod, couponDiscount });

    res.json({
      success: true,
      quote: {
        ...charges,
        couponApplied: coupon ? coupon.code : null,
        couponNotApplied: !!couponCode && !coupon,
        codFeeLabel: `Cash-on-delivery handling (flat ₹${COD_HANDLING_FEE} per order, non-refundable)`
      }
    });
  } catch (error) {
    console.error('Quote error:', error);
    res.status(500).json({ success: false, message: 'Could not price this order.' });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    })
      .populate('items.product', 'title images price brand')
      .populate('seller', 'storeName storeLogo')
      .populate('user', 'name email phone');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/*
 * The bill on an order the customer already placed.
 *
 * Support conversations about a charge go wrong when the two sides rebuild the
 * number from different assumptions, so the stored lines are read back rather
 * than recomputed: subtotal, delivery, platform fee, the cash-handling charge,
 * the discount, what was paid, and - for a cash order - what is refundable if
 * the goods come back. The last one is the whole point of this endpoint: a
 * customer comparing a refund to their order total is not being short-changed,
 * they are seeing the ₹39 that paid for the cash leg stay where it was spent.
 */
router.get('/:id/charge-summary', verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
      .select('orderNumber subtotal deliveryCharge platformFee codFee couponDiscount totalAmount paymentMethod paymentStatus orderStatus');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const refundable = refundableAmount(order);
    res.json({
      success: true,
      charges: {
        subtotal: order.subtotal,
        deliveryCharge: order.deliveryCharge,
        platformFee: order.platformFee,
        codFee: order.codFee || 0,
        couponDiscount: order.couponDiscount || 0,
        totalAmount: order.totalAmount
      },
      paymentMethod: order.paymentMethod,
      refundableAmount: refundable,
      nonRefundableCodFee: Math.max(0, (order.totalAmount || 0) - refundable),
      note: order.paymentMethod === 'cod' && (order.codFee || 0) > 0
        ? `This order includes a flat ₹${order.codFee} cash-handling charge. It is not refunded on a return; the items are.`
        : undefined
    });
  } catch (error) {
    console.error('Charge summary error:', error);
    res.status(500).json({ success: false, message: 'Could not read these charges.' });
  }
});

router.put('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const cancellableStatuses = ['pending', 'confirmed'];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage.' });
    }

    order.orderStatus = 'cancelled';
    order.cancellationReason = reason || 'Cancelled by user';
    // Only money actually collected can be refunded; unpaid COD was never paid.
    if (order.paymentStatus === 'completed') {
      order.paymentStatus = 'refunded';
    }

    await order.save();

    // Return the goods to the exact colour/size they came from.
    await restoreStockForOrder(order, req.app.get('io'), { reason: 'cancellation' });


    try {
      const withBuyer = await Order.findById(order._id).populate('user', 'email name');
      if (withBuyer?.user?.email) {
        await sendOrderStatusNotification(withBuyer.user.email, withBuyer, 'cancelled');
      }
    } catch (mailErr) {
      console.error('Cancellation email skipped:', mailErr.message);
    }
    res.json({
      success: true,
      message: 'Order cancelled successfully.',
      order
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/:id/return', verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Return can only be requested for delivered orders.' });
    }

    if (order.orderStatus === 'return_requested' || order.orderStatus === 'returned') {
      return res.status(400).json({ success: false, message: 'Return already requested for this order.' });
    }

    const deliveryDays = (new Date() - order.deliveryDate) / (1000 * 60 * 60 * 24);
    if (deliveryDays > 7) {
      return res.status(400).json({ success: false, message: 'Return window of 7 days has expired.' });
    }

    order.orderStatus = 'return_requested';
    order.returnReason = reason || 'Return requested by user';
    await order.save();


    try {
      const withBuyer = await Order.findById(order._id).populate('user', 'email name');
      if (withBuyer?.user?.email) {
        await sendOrderStatusNotification(withBuyer.user.email, withBuyer, 'return_requested');
      }
    } catch (mailErr) {
      console.error('Return email skipped:', mailErr.message);
    }
    res.json({
      success: true,
      message: 'Return request submitted successfully.',
      order
    });
  } catch (error) {
    console.error('Return order error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/:id/review', verifyToken, async (req, res) => {
  try {
    const { rating, review, productId } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    }

    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Can only review delivered orders.' });
    }

    const targetProductId = productId || order.items[0]?.product;
    const product = await Product.findById(targetProductId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const existingReview = product.ratings.find(r => r.user.toString() === req.user._id.toString());
    if (existingReview) {
      existingReview.rating = rating;
      existingReview.review = review || '';
      existingReview.createdAt = new Date();
    } else {
      product.ratings.push({
        user: req.user._id,
        rating,
        review: review || '',
        createdAt: new Date()
      });
      product.totalReviews = (product.totalReviews || 0) + 1;
    }

    const totalRating = product.ratings.reduce((sum, r) => sum + r.rating, 0);
    product.totalRatings = product.ratings.length;

    /*
     * Materialise the seller's rating from the ratings that actually exist.
     *
     * `Seller.rating` was declared with a default of 0, displayed on the seller
     * profile and in the admin shortlist, and never written by anything - so
     * every shop read as "Rated 0", including the good ones, and the ranking
     * that used to score on it was scoring on a blank field. It is now a cached
     * average over the seller's catalogue, recomputed whenever a review lands.
     */
    try {
      const { default: Seller } = await import('../models/Seller.js');
      const sellerId = product.seller;
      if (sellerId) {
        const catalogue = await Product.find({ seller: sellerId }).select('ratings').lean();
        let sum = 0;
        let count = 0;
        for (const row of catalogue) {
          for (const r of row.ratings || []) {
            sum += Number(r.rating || 0);
            count += 1;
          }
        }
        const sellerDoc = await Seller.findById(sellerId);
        if (sellerDoc) {
          // Only `rating` is set: Seller has no totalRatings path, and writing
          // a field the schema does not declare is precisely the bug being
          // fixed here - it looks like it worked and stores nothing.
          sellerDoc.rating = count ? Math.round((sum / count) * 10) / 10 : 0;
          await sellerDoc.save();
        }
      }
    } catch (rateErr) {
      // A stale display average must not refuse the customer's review.
      console.error(JSON.stringify({ event: 'seller_rating_recompute_failed', message: String(rateErr.message).slice(0, 160) }));
    }
    
    await product.save();

    res.json({ success: true, message: existingReview ? 'Review updated.' : 'Review submitted.', product: { totalRatings: product.totalRatings, totalReviews: product.totalReviews } });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

export default router;
