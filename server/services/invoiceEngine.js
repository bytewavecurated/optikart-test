import fs from 'node:fs';
import path from 'node:path';
import Invoice from '../models/Invoice.js';
import Order from '../models/Order.js';
import TaxRule from '../models/TaxRule.js';
import { mintCode } from './entityIds.js';
import { resolveLineClass, extractInclusiveTax, splitTax, sameState, SERVICE_SAC } from './gst.js';
import { renderInvoicePdf } from './invoicePdf.js';
import { sendInvoiceMail } from './email.js';
import { writeGeneratedDocument, generatedDocPath } from './storage.js';
import { buildOrderSettlement } from './commissionTracking.js';

/*
 * The invoice ledger.
 *
 * INVARIANT, stated before anything else: every issued document satisfies
 * |invoice.summary.chargedTotal - order.totalAmount| <= 1 paisa - the
 * invoice says the amount that was actually charged, or it flags
 * `totalMatchesOrder:false` and LOUDS in the log rather than printing a
 * confident wrong legal document. The harness group asserts this equality
 * on orders issued through the real API, not on hand-built fixtures.
 *
 * Everything else in this file is in service of that sentence: the
 * inclusive-tax extract (the charged amount is the inclusive one),
 * per-line pro-rata of the ORDER's stored coupon discount (not a re-run of
 * scope maths - the invoice reflects what the discount actually took),
 * seller documents read from buildOrderSettlement/recorded order fields
 * (the same settlement that moves money, printed), and mail results stored
 * on the document row (so "we emailed it" is never a claim the database
 * cannot back).
 *
 * Failure policy at the money-path join: an invoice that cannot be minted
 * or a mail that cannot go out NEVER fails the order flow it decorates -
 * both states are recorded on the row and warned to structured logs. An
 * order existing with its invoice missing is a support ticket; an order
 * failing to be placed because its paperwork exploded is a lost sale and
 * a lie about stock the customer already earned.
 */

// anchored to THIS module (not the launch cwd) so the API writer, the
// invoice reader and any offline script always resolve the same folder even
// though server/, scripts/ and CI live in different cwds
const INVOICE_DIR = path.resolve(
  process.env.INVOICE_STORE_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'invoices-private')
);

const ensureDir = () => {
  try {
    fs.mkdirSync(INVOICE_DIR, { recursive: true });
  } catch {}
};

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const fyTag = (d = new Date()) => {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const a = m >= 4 ? y : y - 1;
  return `${String(a).slice(-2)}-${String((a + 1) % 100).padStart(2, '0')}`;
};

const proRate = (total, base, amount) => (base > 0 ? r2((amount * total) / base) : 0);

let rulesCache = null;
let rulesAt = 0;

/** Called by the tax-rule admin routes so a saved rule is live immediately:
 *  the ten-second cache is only a backfill optimisation, never a reason for a
 *  just-written classification to keep issuing old tax. */
export function invalidateTaxRules() {
  rulesCache = null;
  rulesAt = 0;
}

async function taxRules() {
  // rules change rarely (they are tax classifications); a ten-second
  // generation window keeps a hundred-order backfill from hammering the
  // same query per order while not being a cache that outlives an edit by
  // the admin at the desk.
  if (!rulesCache || Date.now() - rulesAt > 10000) {
    rulesCache = await TaxRule.find({}).lean();
    rulesAt = Date.now();
  }
  return rulesCache;
}

async function buildCustomerInvoice(order) {
  const [User, Seller, Product] = await Promise.all([
    import('../models/User.js').then((m) => m.default),
    import('../models/Seller.js').then((m) => m.default),
    import('../models/Product.js').then((m) => m.default),
  ]);
  const rules = await taxRules();
  const [user, seller] = await Promise.all([
    User.findById(order.user).select('name email phone').lean(),
    Seller.findById(order.seller).lean(),
  ]);

  const couponDiscount = r2(order.couponDiscount || 0);
  const subtotal = r2(
    order.subtotal || (order.items || []).reduce((s, i) => s + r2((i.price || 0) * (i.quantity || 1)), 0)
  );

  const lines = [];
  let sumGross = 0;
  let sumDisc = 0;
  let sumTaxable = 0;
  let sumGst = 0;
  const perLineMeta = [];

  for (const it of order.items || []) {
    const prod = it.product
      ? await Product.findById(it.product).select('name title brand category description hsnCode').lean()
      : null;
    const cls = await resolveLineClass(prod || { category: 'sunglasses' }, rules);
    const unit = r2(it.price);
    const qty = Math.max(1, Number(it.quantity) || 1);
    const gross = r2(unit * qty);
    const discShare = proRate(gross, subtotal, couponDiscount);
    const taxable = r2(gross - discShare);
    const { exclusive, gst } = extractInclusiveTax(taxable, cls.rate);
    const st = Boolean(seller?.address?.state) && sameState(seller?.address?.state, order.shippingAddress?.state);
    const split = splitTax(gst, st);
    sumGross = r2(sumGross + gross);
    sumDisc = r2(sumDisc + discShare);
    sumTaxable = r2(sumTaxable + taxable);
    sumGst = r2(sumGst + gst);
    lines.push({
      orderItemId: it._id,
      product: it.product,
      name: prod ? String(prod.title || prod.name || prod.description || '').slice(0, 90) : 'Item',
      brand: prod?.brand,
      variantSummary: [
        it.variant?.color,
        it.variant?.size,
        it.variant?.power ? `Power ${it.variant.power}` : '',
        it.variant?.lensType,
      ]
        .filter(Boolean)
        .join(' '),
      hsn: cls.hsn,
      quantity: qty,
      unitPriceInclusive: unit,
      grossInclusive: gross,
      discountShare: discShare,
      taxableInclusive: taxable,
      gstRatePercent: cls.rate,
      gstComponent: gst,
      ...split,
      lineTotal: taxable,
    });
    perLineMeta.push({ st });
  }
  // pro-rata drift: the paise the per-line shares could not carry go to the
  // LAST line that matched a discount, so merchandise+discount == subtotal.
  if (couponDiscount && lines.length) {
    const last = lines[lines.length - 1];
    const drift = r2(couponDiscount - sumDisc);
    if (drift) {
      last.discountShare = r2(last.discountShare + drift);
      last.taxableInclusive = r2(last.taxableInclusive - drift);
      last.gstComponent = extractInclusiveTax(last.taxableInclusive, last.gstRatePercent).gst;
      const st = perLineMeta[perLineMeta.length - 1].st;
      Object.assign(last, splitTax(last.gstComponent, st));
      last.lineTotal = last.taxableInclusive;
      sumGst = r2(lines.reduce((s, l) => s + l.gstComponent, 0));
      sumTaxable = r2(lines.reduce((s, l) => s + l.taxableInclusive, 0));
    }
  }

  const deliveryCharged = r2(order.deliveryCharge || 0);
  const platformCharged = r2(order.platformFee || 0);
  const selfDeliveryCharged = r2(order.selfDeliveryCharge || 0);
  const cod = r2(order.codFee || 0);
  const serviceLines = [];
  const taxOfSvc = (incl, rate) => extractInclusiveTax(incl, rate).gst;

  if (deliveryCharged) {
    const s0 = SERVICE_SAC.delivery;
    const st = Boolean(seller?.address?.state) ? sameState(seller.address.state, stateFrom(order)) : true;
    const incl = deliveryCharged;
    const gst = taxOfSvc(incl, s0.rate);
    serviceLines.push({
      nature: 'delivery',
      sac: s0.sac,
      baseInclusive: incl,
      gstRatePercent: s0.rate,
      gstComponent: gst,
      perSellerStateSame: !!st,
    });
  }
  if (platformCharged) {
    const s0 = SERVICE_SAC.platform;
    serviceLines.push({
      nature: 'platform',
      sac: s0.sac,
      baseInclusive: platformCharged,
      gstRatePercent: s0.rate,
      gstComponent: taxOfSvc(platformCharged, s0.rate),
      perSellerStateSame: true,
    });
  }
  if (selfDeliveryCharged) {
    serviceLines.push({
      nature: 'delivery',
      sac: SERVICE_SAC.fulfilment.sac,
      baseInclusive: selfDeliveryCharged,
      gstRatePercent: 18,
      gstComponent: taxOfSvc(selfDeliveryCharged, 18),
      perSellerStateSame: true,
    });
  }
  if (cod) {
    serviceLines.push({
      nature: 'cod',
      sac: SERVICE_SAC.cod.sac,
      baseInclusive: cod,
      gstRatePercent: SERVICE_SAC.cod.rate,
      gstComponent: taxOfSvc(cod, SERVICE_SAC.cod.rate),
      perSellerStateSame: true,
    });
  }

  const svcGst = r2(serviceLines.reduce((s, l) => s + l.gstComponent, 0));
  const computed = r2(sumTaxable + serviceLines.reduce((s, l) => s + l.baseInclusive, 0));
  const charged = r2(order.totalAmount);
  const roundOff = r2(charged - computed);
  const taxTotal = r2(sumGst + svcGst);

  // aggregate CGST/SGST/IGST across goods+services
  let cgst = 0,
    sgst = 0,
    igst = 0;
  for (const l of lines) {
    cgst = r2(cgst + l.cgst);
    sgst = r2(sgst + l.sgst);
    igst = r2(igst + l.igst);
  }
  const pstate = process.env.INVOICE_PLATFORM_STATE || seller?.address?.state || order.shippingAddress?.state;
  for (const s0 of serviceLines) {
    const same = sameState(
      s0.perSellerStateSame === false ? seller?.address?.state : pstate,
      order.shippingAddress?.state
    );
    const sp = splitTax(s0.gstComponent, same);
    cgst = r2(cgst + sp.cgst);
    sgst = r2(sgst + sp.sgst);
    igst = r2(igst + sp.igst);
  }
  const sumChecks = r2(cgst + sgst + igst);
  const supplyKind = lines.some((l) => l.igst > 0) ? (lines.some((l) => l.cgst > 0) ? 'mixed' : 'inter') : 'intra';

  const doc = {
    type: 'customer',
    order: order._id,
    orderNumber: order.orderNumber,
    user: order.user,
    seller: order.seller,
    buyerSnapshot: {
      name: order.shippingAddress?.name || user?.name || '',
      phone: order.shippingAddress?.phone || user?.phone || '',
      email: order.shippingAddress?.email || user?.email || '',
      address: order.shippingAddress?.street || '',
      city: order.shippingAddress?.city || '',
      state: order.shippingAddress?.state || '',
      pincode: order.shippingAddress?.pincode || '',
    },
    sellerSnapshot: {
      storeName: seller?.storeName || 'Seller',
      gstNumber: seller?.gstNumber || '',
      city: seller?.address?.city || seller?.city || '',
      state: seller?.address?.state || seller?.state || '',
    },
    lines,
    serviceLines,
    summary: {
      merchandiseInclusive: r2(sumGross),
      discountTotal: sumDisc,
      deliveryChargeInclusive: deliveryCharged + selfDeliveryCharged,
      platformFeeInclusive: platformCharged,
      codHandlingInclusive: cod,
      chargedTotal: charged,
      roundOff,
      taxTotal: sumChecks,
      cgstTotal: cgst,
      sgstTotal: sgst,
      igstTotal: igst,
      supplyKind,
    },
    paymentMethod: order.paymentMethod,
    paymentStatus:
      order.paymentStatus === 'completed' || order.paymentStatus === 'refunded'
        ? order.paymentStatus
        : order.paymentStatus,
    issuedAt: order.createdAt,
    totalMatchesOrder:
      Math.abs(charged - (sumTaxable + deliveryCharged + platformCharged + selfDeliveryCharged + cod)) <= 0.01,
  };
  return doc;
}

function stateFrom(order) {
  return String(order?.shippingAddress?.state || '');
}

/* ---------------------------- seller document ---------------------------- */

async function buildSellerInvoice(order) {
  const Seller = (await import('../models/Seller.js')).default;
  const Product = (await import('../models/Product.js')).default;
  const seller = await Seller.findById(order.seller).lean();
  const settlement = buildOrderSettlement(order);
  const commissionBase = r2(order.subtotal - (order.couponDiscount || 0));
  const commissionAmount = r2(order.commissionAmount || settlement.commissionAmount);
  const fulfilment = r2(order.fulfilmentRecharge || settlement.fulfilmentCost);
  const net = r2(order.netAmountToSeller || settlement.netAmountToSeller);
  const chargedTotal = r2(order.totalAmount);
  const platformState = process.env.INVOICE_PLATFORM_STATE || '';
  const st = Boolean(seller?.address?.state) && sameState(seller?.address?.state, platformState);
  // SERVICES ARE EXCLUSIVE-BASIS FOR THE SELLER: the commission is a fee and
  // GST is ADDED on top (18%). The base values are what the platform billed
  // on top of merchandise/deductions, the document says so and the totals
  // keep `netAmountToSeller` untouched - net is what moved/settles.
  const taxOn = (base, rate = 18) => r2((base * rate) / 100);

  const lines = [];
  for (const it of order.items || []) {
    const prod = it.product ? await Product.findById(it.product).select('name title brand').lean() : null;
    const cls = await resolveLineClass(prod || { category: 'sunglasses' }, await taxRules());
    const incl = r2((it.price || 0) * (it.quantity || 1));
    lines.push({
      orderItemId: it._id,
      product: it.product,
      name: prod ? String(prod.title || prod.name).slice(0, 90) : 'Item',
      brand: prod?.brand,
      hsn: cls.hsn,
      quantity: it.quantity || 1,
      unitPriceInclusive: r2(it.price || 0),
      grossInclusive: incl,
      taxableInclusive: incl,
      gstRatePercent: commissionPct(order),
      gstComponent: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      lineTotal: incl,
    });
  }

  const perItemComm = r2(commissionAmount / Math.max(1, lines.length));
  const serviceLines = [];
  if (commissionAmount)
    serviceLines.push({
      nature: 'Platform commission',
      sac: SERVICE_SAC.commission.sac,
      baseAmount: commissionAmount,
      gstRatePercent: 18,
      gstAmount: taxOn(commissionAmount),
      perItem: lines.map((l) => ({ product: l.product, name: l.name, base: perItemComm })),
    });
  if (fulfilment)
    serviceLines.push({
      nature: 'Fulfilment recharge',
      sac: SERVICE_SAC.fulfilment.sac,
      baseAmount: fulfilment,
      gstRatePercent: 18,
      gstAmount: taxOn(fulfilment),
      perItem: [],
    });

  const taxOnServicesTotal = r2(serviceLines.reduce((s, l) => s + l.gstAmount, 0));

  return {
    type: 'seller',
    order: order._id,
    orderNumber: order.orderNumber,
    user: order.user,
    seller: order.seller,
    buyerSnapshot: { name: seller?.storeName || 'Seller' },
    sellerSnapshot: {
      storeName: seller?.storeName || 'Seller',
      gstNumber: seller?.gstNumber || '',
      city: seller?.address?.city || seller?.city || '',
      state: seller?.address?.state || seller?.state || '',
    },
    lines,
    sellerServices: serviceLines,
    commissionPercentage: commissionPct(order),
    commissionBase,
    commissionAmount,
    fulfilmentRecharge: fulfilment,
    taxOnServicesTotal,
    deductedTotal: r2(commissionAmount + fulfilment + taxOnServicesTotal),
    netPayableToSeller: net,
    settlementSnapshot: {
      cashCollected: r2(order.cashCollected || 0),
      paymentMethod: order.paymentMethod,
      payoutProcessed: !!order.payoutProcessed,
    },
    summary: {
      merchandiseInclusive: r2(order.subtotal || chargedTotal),
      discountTotal: r2(order.couponDiscount || 0),
      chargedTotal,
      roundOff: 0,
      taxTotal: taxOnServicesTotal,
      cgstTotal: st ? r2(taxOnServicesTotal / 2) : 0,
      sgstTotal: st ? r2(taxOnServicesTotal - r2(taxOnServicesTotal / 2)) : 0,
      igstTotal: st ? 0 : taxOnServicesTotal,
      supplyKind: st ? 'intra' : 'inter',
    },
    paymentMethod: order.paymentMethod,
    paymentStatus:
      order.paymentStatus === 'completed' || (order.paymentMethod === 'cod' && order.orderStatus === 'delivered')
        ? 'completed'
        : order.paymentStatus,
    totalMatchesOrder: true,
  };
}

function commissionPct(order) {
  const v = Number(order.commissionPercentage);
  return Number.isFinite(v) && v >= 0 ? v : 3;
}

/* ----------------------------- mint + persist ----------------------------- */

async function ensurePdf(inv, order) {
  ensureDir();
  try {
    const plain = inv && typeof inv.toObject === 'function' ? inv.toObject({ getters: true }) : inv;
    const buf = await renderInvoicePdf(plain, order);
    const written = await writeGeneratedDocument({ name: inv.invoiceNumber, buffer: buf });
    inv.pdfPath = written.rel;
    inv.pdfRebuiltAt = new Date();
    return buf;
  } catch (e) {
    console.error(
      JSON.stringify({ event: 'invoice_pdf_failed', num: inv.invoiceNumber, error: String(e.message).slice(0, 150) })
    );
    return null;
  }
}

async function deliverMail(inv, order, pdf, stage) {
  if (!pdf) return;
  let to;
  if (inv.type === 'customer') {
    to = inv.buyerSnapshot?.email;
    if (!to) {
      const u = await (await import('../models/User.js')).default.findById(inv.user).select('email').lean();
      to = u?.email;
    }
  } else {
    const sl = await (
      await import('../models/Seller.js')
    ).default
      .findById(inv.seller)
      .select('businessEmail email')
      .lean();
    to = sl?.email || sl?.businessEmail;
  }
  if (!to) {
    inv.mail = {
      ...(inv.mail || {}),
      ok: false,
      delivered: false,
      reason: 'no-recipient',
      lastStage: inv.mail?.lastStage || '',
      lastAttemptAt: new Date(),
    };
    return;
  }
  const subject =
    inv.type === 'customer'
      ? `Invoice ${inv.invoiceNumber} for order ${inv.orderNumber}`
      : `OptiKart tax invoice ${inv.invoiceNumber} for order ${inv.orderNumber}`;
  const intro =
    inv.type === 'customer'
      ? stage === 'paid'
        ? [`Your order ${inv.orderNumber} is confirmed and paid. The tax invoice is attached.`]
        : [
            `Thank you for ordering from ${inv.sellerSnapshot.storeName}. Your tax invoice for order ${inv.orderNumber} is attached. Payment is ${inv.paymentMethod === 'cod' ? 'cash on delivery' : 'due via the selected method'}.`,
          ]
      : [
          `Invoice for the commission and services OptiKart billed on order ${inv.orderNumber}. The net amount ${inv.paymentMethod === 'cod' ? 'collected in cash and settled' : 'credited'} to you is ₹${Number(
            inv.netPayableToSeller || 0
          ).toFixed(2)}.`,
        ];

  const res = await sendInvoiceMail({
    to,
    subject,
    introLines: intro,
    pdfBuffer: pdf,
    filename: `OptiKart-${inv.invoiceNumber}.pdf`,
    kind: inv.type,
  }).catch((e) => ({ success: false, delivered: false, reason: 'call-failed' }));
  inv.mail = {
    to,
    ok: res.success,
    delivered: !!res.delivered,
    reason: res.reason || '',
    lastStage: stage,
    lastAttemptAt: new Date(),
  };
  const status = String(res.success && res.delivered ? 'info' : res.success ? 'warn' : 'error');
  console[status === 'error' ? 'error' : 'log'](
    JSON.stringify({
      event: 'invoice_mail',
      num: inv.invoiceNumber,
      type: inv.type,
      ok: !!res.success,
      delivered: !!res.delivered,
      reason: res.reason,
    })
  );
}

async function attachMintedNumber(invDoc, entityKey) {
  await mintCode(Invoice, invDoc, entityKey);
  return invDoc;
}

export async function issueOrderInvoices(orderOrId, { stage = 'issued' } = {}) {
  // callers hand us strings, ObjectIds, or hydrated docs (recordCommission
  // passes order._id - an OBJECTID, which `typeof === 'string'` mistook for a
  // document and then "loaded" as a raw id: the 2026-11 seller-doc failures
  // were exactly this. Discriminate on the model, not on the JS type.
  const order =
    orderOrId && orderOrId.constructor && orderOrId.constructor.modelName === 'Order'
      ? orderOrId
      : await Order.findById(orderOrId?._id ?? orderOrId);
  if (!order) return { ok: false, error: 'order-not-found' };
  const results = [];

  // ---- customer doc (always)
  let cust = await Invoice.findOne({ type: 'customer', order: order._id });
  if (!cust) {
    try {
      const data = await buildCustomerInvoice(order);
      const doc = new Invoice(data);
      await attachMintedNumber(doc, 'invoiceCustomer');
      await doc.save();
      cust = doc;
    } catch (e) {
      console.error(
        JSON.stringify({
          event: 'invoice_customer_mint_failed',
          order: order?.orderNumber,
          error: String(e.message).slice(0, 160),
          stack: String(e.stack || '')
            .split('\n')
            .slice(1, 4)
            .join('|')
            .slice(0, 240),
        })
      );
    }
  } else if (stage === 'paid' && (cust.paymentStatus !== 'completed' || cust.status === 'void')) {
    if (cust.status === 'void') {
      cust.status = 'active';
      cust.voidReason = '';
      cust.voidAt = undefined;
    }
    cust.paymentStatus = 'completed';
  }

  if (cust) {
    let pdf = null;
    let pdfMissing = false;
    try {
      const p = path.join(
        INVOICE_DIR,
        String(cust.pdfPath || '')
          .split('/')
          .pop() || ''
      );
      pdfMissing = !cust.pdfPath || !p || !fs.existsSync(p);
      if (!pdfMissing) pdf = fs.readFileSync(p);
    } catch {
      pdfMissing = true;
    }
    if (stage === 'paid') pdf = null;
    if (pdfMissing || !pdf || stage === 'paid' || order.paymentStatus === 'completed' || (!cust.pdfPath && !pdf)) {
      pdf = await ensurePdf(cust, order);
    }
    const shouldMail = stage === 'paid' ? !cust.mail?.lastStage || cust.mail.lastStage !== 'paid' : !cust.mail;
    if (shouldMail) await deliverMail(cust, order, pdf, stage);
    await cust.save().catch(() => {});
    results.push({ kind: 'customer', number: cust.invoiceNumber, mail: cust.mail?.reason });
  }

  // ---- seller doc (only once the order is at/beyond delivered, or when the
  // caller explicitly asked (backfill / settle hook)).
  if (stage === 'settled' || ['delivered', 'completed'].includes(order.orderStatus)) {
    let sell = await Invoice.findOne({ type: 'seller', order: order._id });
    if (!sell) {
      try {
        const data = await buildSellerInvoice(order);
        if (!data?.orderNumber)
          console.error(
            JSON.stringify({
              event: 'seller_data_missing',
              keys: Object.keys(data || {}),
              order: String(order?.orderNumber),
            })
          );
        const doc = new Invoice(data);
        await attachMintedNumber(doc, 'invoiceSeller');
        await doc.save();
        sell = doc;
        const pdf = await ensurePdf(sell, order);
        await deliverMail(sell, order, pdf, 'issued');
        await sell.save().catch(() => {});
        results.push({ kind: 'seller', number: sell.invoiceNumber, mail: sell.mail?.reason });
      } catch (e) {
        console.error(
          JSON.stringify({
            event: 'invoice_seller_mint_failed',
            order: order?.orderNumber,
            error: String(e.message).slice(0, 160),
            stack: String(e.stack || '')
              .split('\n')
              .slice(1, 4)
              .join('|')
              .slice(0, 240),
          })
        );
        return { ok: false, error: e.message, results };
      }
    }
  }

  console.log(
    JSON.stringify({
      event: 'invoice_issued',
      order: order.orderNumber,
      issued: results.map((r) => `${r.kind}:${r.number}`).join(' '),
    })
  );
  return { ok: true, results };
}

export async function voidOrderInvoices(order, reason = 'order cancelled') {
  const up = { status: 'active' };
  const rows = await Invoice.find({ order: order._id || order, ...up });
  for (const r of rows) {
    r.status = 'void';
    r.voidReason = reason;
    r.voidAt = new Date();
    await ensurePdf(r, { orderNumber: r.orderNumber }); // re-render with VOID stamp
    await r.save();
  }
  if (rows.length)
    console.log(JSON.stringify({ event: 'invoice_voided', order: rows[0].orderNumber, reason, count: rows.length }));
  return rows.length;
}

export async function ensurePaidStamp(order) {
  const cust = await Invoice.findOne({ type: 'customer', order: order._id });
  if (cust && cust.paymentStatus !== 'completed') {
    const res = await issueOrderInvoices(order, { stage: 'paid' });
    return res;
  }
  // already stamped: only rebuild pdf if the file is gone
  if (cust && (!cust.pdfPath || !fs.existsSync(path.resolve(process.cwd(), '..', cust.pdfPath)))) {
    await ensurePdf(cust, order);
    await cust.save();
  }
  return { ok: true, existed: true };
}

export function invoicePdfPath(inv) {
  return generatedDocPath(inv.pdfPath);
}

function _legacyInvoicePdfPath(inv) {
  // ONE resolution rule for every process (API, scripts, backfill): filename
  // inside the module-anchored store. Historical relative/absolute junk in
  // old rows is normalised here and cannot make a reader miss a file, so
  // cwd stopped mattering the day this function became the only accessor.
  const raw = String(inv.pdfPath || '');
  if (!raw) return '';
  return path.join(INVOICE_DIR, raw.split('/').pop());
}

export const INVOICE_PDF_ROOT = INVOICE_DIR;

export { voidOrderInvoices as voidInvoicesForOrder };
