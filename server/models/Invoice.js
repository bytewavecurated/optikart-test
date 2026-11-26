import mongoose from 'mongoose';

/**
 * Invoices: the documents the money ends up on.
 *
 * Two kinds, both minted from data the platform itself computed - never from
 * anything a client sent:
 *
 *  - `customer` (per seller-partitioned order): what the shopper was charged,
 *    line by line, with the GST components extracted from the inclusive
 *    retail prices, plus the service lines (delivery, platform, COD) printed
 *    as separate supplies. `summary.chargedTotal` MUST equal the order's
 *    stored grand total - that equality is asserted at issue time and by
 *    the e2e group, because an invoice whose total disagrees with what was
 *    charged is a legal document contradicting the payment record.
 *
 *  - `seller` (per delivered order): what the marketplace bills the shop for
 *    that order - commission plus any recharges it actually deducted - with
 *    GST ON THOSE SERVICES charged correctly (they are services WITH tax on
 *    top, unlike retail), and the amount credited to the seller's balance
 *    beside them. Numbers come from services/commissionTracking.js - the
 *    same ledger that already moves the money - so this document is not a
 *    second, drifting calculation of the settlement; it is the settlement,
 *    printed.
 *
 * A seller's account, another customer's order, and the amounts in between
 * must never be visible cross-tenant: `user`, `seller` and the kind are
 * stored on every row precisely so the access check is one comparison, not
 * a join nobody remembers to do.
 *
 * `lineSnapshot` keeps the product/brand/HSN/rate AS INVOICED, not as the
 * catalogue says today: a price edited after purchase must not silently
 * rewrite a printed document.
 */
const invoiceLineSchema = new mongoose.Schema(
  {
    orderItemId: { type: mongoose.Schema.Types.ObjectId },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    brand: String,
    variantSummary: String,
    hsn: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceInclusive: { type: Number, required: true },
    grossInclusive: { type: Number, required: true },
    discountShare: { type: Number, default: 0 },
    taxableInclusive: { type: Number, required: true },
    gstRatePercent: { type: Number, required: true },
    gstComponent: { type: Number, required: true },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

const invoiceSummarySchema = new mongoose.Schema(
  {
    merchandiseInclusive: { type: Number, required: true },
    discountTotal: { type: Number, default: 0 },
    deliveryChargeInclusive: { type: Number, default: 0 },
    platformFeeInclusive: { type: Number, default: 0 },
    codHandlingInclusive: { type: Number, default: 0 },
    chargedTotal: { type: Number, required: true },
    roundOff: { type: Number, default: 0 },
    taxTotal: { type: Number, required: true },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    supplyKind: { type: String, enum: ['intra', 'inter', 'mixed'], default: 'intra' },
  },
  { _id: false }
);

const customerServiceLineSchema = new mongoose.Schema(
  {
    nature: { type: String, required: true },
    sac: { type: String, required: true },
    baseInclusive: { type: Number, required: true },
    gstRatePercent: { type: Number, required: true },
    gstComponent: { type: Number, required: true },
    perSellerStateSame: { type: Boolean },
  },
  { _id: false }
);

const sellerServiceLineSchema = new mongoose.Schema(
  {
    nature: { type: String, required: true },
    sac: String,
    baseAmount: { type: Number, required: true },
    gstRatePercent: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    perItem: [{ product: mongoose.Schema.Types.ObjectId, name: String, base: Number }],
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    type: { type: String, enum: ['customer', 'seller'], required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true },
    // one seller-partitioned order can belong to exactly one shopper and one
    // shop; BOTH ids are stored so 'mine' checks never join to read them.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },

    buyerSnapshot: {
      name: String,
      phone: String,
      email: String,
      address: String,
      city: String,
      state: String,
      pincode: String,
      gstNumber: { type: String, default: '' },
    },
    sellerSnapshot: {
      storeName: String,
      gstNumber: { type: String, default: '' },
      city: String,
      state: String,
    },

    lines: [invoiceLineSchema],
    serviceLines: [
      {
        nature: String,
        sac: String,
        baseInclusive: Number,
        gstRatePercent: Number,
        gstComponent: Number,
        perSellerStateSame: Boolean,
        _id: false,
      },
    ],
    summary: { type: invoiceSummarySchema, required: true },

    // the seller's own document: deductions the platform billed for THIS
    // order, straight from the settlement math (see header).
    commissionPercentage: { type: Number },
    commissionBase: Number,
    commissionAmount: Number,
    fulfilmentRecharge: Number,
    sellerServices: [sellerServiceLineSchema],
    taxOnServicesTotal: Number,
    deductedTotal: Number,
    netPayableToSeller: Number,
    settlementSnapshot: {
      cashCollected: Number,
      paymentMethod: String,
      payoutProcessed: Boolean,
    },

    paymentMethod: String,
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    status: { type: String, enum: ['active', 'void'], default: 'active' },
    voidReason: { type: String, default: '' },
    voidAt: { type: Date },
    issuedAt: { type: Date, default: Date.now },
    supplyStateContext: { shippingState: String, sellerState: String, platformState: String },

    pdfPath: { type: String, default: '' },
    pdfRebuiltAt: { type: Date },
    mail: {
      to: String,
      lastAttemptAt: { type: Date },
      delivered: { type: Boolean },
      ok: { type: Boolean },
      reason: { type: String, default: '' },
      // 'issued' (at creation) and 'paid' (after capture) are deliberately
      // separate states so re-sending cannot happen silently on a webhook
      // retry after the document already went out.
      lastStage: { type: String, enum: ['', 'issued', 'paid'], default: '' },
    },
    // the invoice-issues-what-the-order-charges invariant, recorded at mint
    // time rather than only trusted.
    totalMatchesOrder: { type: Boolean, default: true },
  },
  { timestamps: true }
);

invoiceSchema.index({ type: 1, order: 1 }, { unique: true });

const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);

export default Invoice;
