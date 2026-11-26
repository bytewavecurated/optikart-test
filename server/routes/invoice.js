import express from 'express';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import TaxRule from '../models/TaxRule.js';
import Order from '../models/Order.js';
import Seller from '../models/Seller.js';
import { verifyToken, verifyAdmin, verifyAnySeller, verifyAnyPrincipal } from '../middleware/auth.js';
import {
  issueOrderInvoices,
  voidOrderInvoices,
  invoicePdfPath as invoicePdfPathFor,
  invalidateTaxRules,
} from '../services/invoiceEngine.js';
import { buildListQuery, listResponse } from '../services/adminQuery.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Invoices, as an API surface.
 *
 * The access rule is deliberately boring: a document answers to its OWN
 * kind and its OWN people. `user` sees their customer invoices; `seller`
 * sees the seller documents of their own shop; admin (with `staff` allowed
 * - the desk staff are the ones answering "send me the invoice again")
 * sees everything and operates the mint/void tooling. A customer fetching
 * a seller document returns 404, not 403 - existence itself is not
 * public information outside its owning parties (same doctrine the order
 * routes use for cross-tenant ids; scripts/invoicing_e2e.mjs asserts it).
 *
 * The PDFs come off disk with the SAME auth as the JSON, streamed inline;
 * nothing here depends on the name being secret.
 */

const router = express.Router();
const oid = (s) => (mongoose.isValidObjectId(String(s)) ? new mongoose.Types.ObjectId(String(s)) : null);

const canSee = (inv, principal, req) => {
  /*
   * verifyAnyPrincipal labels tokens by their decoded role (defaulting to
   * 'user'), and seller-console tokens carry NO role claim: the honest tell
   * is whether THIS request resolved a Seller document. Admin/staff see all;
   * a shopper sees only their own customer document; a shop sees only the
   * seller documents minted for ITS orders.
   */
  const declared = String(principal?.role ?? 'user');
  const isSellerActor = !!(req?.seller || principal?.seller);
  const role = declared === 'user' && isSellerActor ? 'seller' : declared;
  if (role === 'admin' || role === 'staff') return true;
  const id = String(principal?.id ? (principal.id._id ?? principal.id) : (principal?.userId ?? ''));
  if (role === 'user') return inv.type === 'customer' && String(inv.user?._id || inv.user || '') === id;
  if (role === 'seller' || role === 'manufacturerSeller')
    return inv.type === 'seller' && String(inv.seller?._id || inv.seller || '') === id;
  return false;
};
const shape = (inv) => ({
  id: inv._id,
  invoiceNumber: inv.invoiceNumber,
  type: inv.type,
  orderNumber: inv.orderNumber,
  orderId: String(inv.order?._id || inv.order || ''),
  issuedAt: inv.issuedAt,
  status: inv.status,
  paymentMethod: inv.paymentMethod,
  paymentStatus: inv.paymentStatus,
  summary: inv.summary,
  netPayableToSeller: inv.netPayableToSeller ?? undefined,
  commissionPercentage: inv.commissionPercentage ?? undefined,
  commissionAmount: inv.commissionAmount ?? undefined,
  taxOnServicesTotal: inv.taxOnServicesTotal ?? undefined,
  serviceLines: inv.type === 'seller' ? inv.sellerServices || [] : undefined,
  linesCount: (inv.lines || []).length,
  totalMatchesOrder: inv.totalMatchesOrder,
  lines: (inv.lines || []).length + ` line(s)`, // brief for lists only
  mail: inv.mail,
});

/* ============================== ADMIN (FIRST):
 * order matters: '/:id' casts ids and would answer 500 to real admin
 * traffic if these were declared below it (and I23 failed exactly that
 * way on the first live pass).
 */
/* --------------------------------- admin --------------------------------- */
router.get('/admin/list', verifyToken, verifyAdmin, async (req, res) => {
  try {
    /*
     * Unknown sort/window/type values are REFUSED, not silently ignored: the
     * admin console builds its dropdowns from this vocabulary, and a typo (or
     * a probe) that quietly returned default-sorted data teaches the next
     * integrator the wrong contract (same rule the admin list-query audit
     * enforces across the other big tables).
     */
    const SORTS = ['', 'issuedAt', 'amount', 'number'];
    if (req.query.sort && !SORTS.includes(req.query.sort)) {
      return res
        .status(400)
        .json({ success: false, message: `sort must be one of: ${SORTS.filter(Boolean).join(', ')}` });
    }
    if (req.query.type && !['customer', 'seller'].includes(req.query.type)) {
      return res.status(400).json({ success: false, message: 'type must be customer or seller' });
    }
    const { query, sort, skip, limit, meta } = buildListQuery(req.query, {
      base: {},
      fields: [
        'invoiceNumber',
        'orderNumber',
        'buyerSnapshot.name',
        'sellerSnapshot.storeName',
        'sellerSnapshot.gstNumber',
        'lines.name',
      ],
      statuses: {
        active: { status: 'active' },
        void: { status: 'void' },
        paid: { paymentStatus: 'completed' },
        unpaid: { paymentStatus: 'pending' },
      },
      sortable: {
        issuedAt: { issuedAt: -1 },
        amount: { 'summary.chargedTotal': -1 },
        number: { invoiceNumber: 1 },
      },
    });
    const extra = [];
    if (req.query.type && ['customer', 'seller'].includes(req.query.type)) extra.push({ type: req.query.type });
    if (req.query.seller && mongoose.isValidObjectId(req.query.seller)) extra.push({ seller: oid(req.query.seller) });
    if (req.query.paymentMethod) extra.push({ paymentMethod: req.query.paymentMethod });
    if (req.query.dateFrom || req.query.dateTo) {
      const rng = {};
      if (req.query.dateFrom) rng.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) rng.$lte = new Date(`${req.query.dateTo}T23:59:59.999Z`);
      if (rng.$gte || rng.$lte) extra.push({ issuedAt: rng });
    }
    if (req.query.order && mongoose.isValidObjectId(req.query.order)) extra.push({ order: oid(req.query.order) });
    const finalQuery = extra.length ? { $and: [query, ...extra] } : query;
    const invoices = await Invoice.find(finalQuery)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('seller', 'storeName')
      .populate('user', 'name');
    const total = await Invoice.countDocuments(finalQuery);
    listResponse(res, 'invoices', invoices.map(shape), total, meta);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Invoice list failed: ${String(error.message).slice(0, 120)}`,
      error: error.message,
    });
  }
});

router.get('/admin/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const rows = await Invoice.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          charged: { $sum: { $cond: [{ $eq: ['$type', 'customer'] }, '$summary.chargedTotal', 0] } },
          tax: { $sum: { $cond: [{ $eq: ['$type', 'customer'] }, '$summary.taxTotal', '$taxOnServicesTotal'] } },
          commissionBilled: { $sum: { $cond: [{ $eq: ['$type', 'seller'] }, { $add: ['$commissionAmount', 0] }, 0] } },
          netToSellers: { $sum: { $cond: [{ $eq: ['$type', 'seller'] }, { $add: ['$netPayableToSeller', 0] }, 0] } },
        },
      },
    ]);
    const counts = Object.fromEntries((rows || []).map((r) => [r._id, r]));
    res.json({
      success: true,
      stats: {
        customer: {
          count: counts.customer?.count || 0,
          totalCharged: Math.round(counts.customer?.charged || 0),
          gstCollected: Math.round((counts.customer?.tax || 0) * 100) / 100,
        },
        seller: {
          count: counts.seller?.count || 0,
          commissionBilled: Math.round((counts.seller?.commissionBilled || 0) * 100) / 100,
          serviceTaxBilled: Math.round((counts.seller?.tax || 0) * 100) / 100,
          netToSellers: Math.round((counts.seller?.netToSellers || 0) * 100) / 100,
        },
        byMonth: undefined,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Stats failed.', error: error.message });
  }
});

/* monthly count + value buckets: dateFrom/dateTo applied to both kinds */

router.get('/admin/bymonth', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const rows = await Invoice.aggregate([
      ...(req.query.dateFrom ? [{ $match: { issuedAt: { $gte: new Date(req.query.dateFrom) } } }] : []),
      {
        $group: {
          _id: { y: { $year: '$issuedAt' }, m: { $month: '$issuedAt' }, t: '$type' },
          n: { $sum: 1 },
          v: { $sum: '$summary.chargedTotal' },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    res.json({ success: true, months: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'By-month failed.', error: error.message });
  }
});

router.post('/admin/ensure/:orderId', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    const out = await issueOrderInvoices(order, { stage: order.orderStatus === 'delivered' ? 'settled' : 'issued' });
    res.json({ success: out.ok !== false, ...out });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Ensure failed.', error: error.message });
  }
});

/* ------------------------------- customer ------------------------------- */
router.get('/mine', verifyToken, async (req, res) => {
  try {
    const invoices = await Invoice.find({ user: req.user._id, type: 'customer' }).sort({ issuedAt: -1 });
    res.json({ success: true, invoices: invoices.map(shape) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/* --------------------------------- seller -------------------------------- */
router.get('/seller', verifyAnySeller, async (req, res) => {
  try {
    const s = req.seller || (req.manufacturerSeller && req.manufacturerSeller._id);
    const invoices = await Invoice.find({ seller: s._id, type: 'seller' }).sort({ issuedAt: -1 });
    res.json({ success: true, invoices: invoices.map(shape) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/* ----------------------------- one document ------------------------------ */
router.get('/:id', verifyAnyPrincipal, async (req, res) => {
  try {
    const q = oid(req.params.id) || { invoiceNumber: decodeURIComponent(String(req.params.id || '').toUpperCase()) };
    const inv = await Invoice.findOne(q)
      .populate('user', 'name')
      .populate('seller', 'storeName')
      .populate('lines.product', 'title brand');
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (!canSee(inv, req.principal, req))
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    res.json({ success: true, invoice: inv, downloadUrl: `/api/invoices/${inv._id}/pdf` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/:id/pdf', verifyAnyPrincipal, async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.id);
    if (!inv || !canSee(inv, req.principal, req))
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    const file = invoicePdfPathFor(inv);
    if (!fs.existsSync(file)) {
      // the document itself, not the directory layout, decides the error
      return res.status(410).json({
        success: false,
        message: `The PDF for ${inv.invoiceNumber} is not on this storage; regenerate it from the invoice page.`,
      });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="OptiKart-${inv.invoiceNumber}.pdf"`);
    fs.createReadStream(file).pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/* ------------------------------- re-mailing ------------------------------ */
router.post('/:id/resend', verifyAnyPrincipal, async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.id);
    if (!inv || !canSee(inv, req.principal, req))
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    const file = invoicePdfPathFor(inv);
    if (!fs.existsSync(file))
      return res
        .status(410)
        .json({ success: false, message: 'No PDF to resend; regenerate it from the admin invoice view (ensure).' });
    const order = await Order.findById(inv.order).populate('seller', 'email storeName');
    const { sendInvoiceMail } = await import('../services/email.js');
    const to = inv.type === 'customer' ? inv.buyerSnapshot?.email : order?.seller?.email;
    if (!to)
      return res.status(400).json({ success: false, message: 'No email on file for the recipient of this document.' });
    const out = await sendInvoiceMail({
      to,
      subject:
        inv.type === 'customer'
          ? `Invoice ${inv.invoiceNumber} for order ${inv.orderNumber}`
          : `OptiKart tax invoice ${inv.invoiceNumber} for order ${inv.orderNumber}`,
      introLines: [
        inv.type === 'customer'
          ? `Your tax invoice for order ${inv.orderNumber}.`
          : `Invoice ${inv.invoiceNumber} - billed to you by OptiKart for order ${inv.orderNumber}.`,
      ],
      pdfBuffer: fs.readFileSync(file),
      filename: `OptiKart-${inv.invoiceNumber}.pdf`,
      kind: inv.type,
    });
    inv.mail = {
      ...inv.mail,
      to,
      ok: out.success,
      delivered: !!out.delivered,
      reason: out.reason,
      lastStage: inv.mail?.lastStage || 'issued',
      lastAttemptAt: new Date(),
    };
    await inv.save();
    res.json({ success: out.success, delivered: !!out.delivered, reason: out.reason });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.get('/tax-rules', verifyToken, async (req, res) => {
  try {
    res.json({ success: true, rules: await TaxRule.find({}).sort({ scope: 1, value: 1 }) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

router.post('/tax-rules', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { scope, value, hsn, ratePercent, confirmed, notes } = req.body;
    if (!['category', 'brand', 'product'].includes(scope) || !value || !hsn) {
      return res
        .status(400)
        .json({ success: false, message: 'scope (category|brand|product), value and hsn are required.' });
    }
    if (!Number.isFinite(Number(ratePercent)) || Number(ratePercent) < 0 || Number(ratePercent) > 43) {
      return res.status(400).json({ success: false, message: 'ratePercent must be 0-43.' });
    }
    const rule = await TaxRule.findOneAndUpdate(
      { scope, value: String(value).trim() },
      {
        scope,
        value: String(value).trim(),
        hsn: String(hsn).trim(),
        ratePercent: Number(ratePercent),
        confirmed: !!confirmed,
        notes: notes || '',
        updatedBy: req.user._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    invalidateTaxRules();
    res.json({
      success: true,
      rule,
      created: rule.createdAt && rule.updatedAt && String(rule.createdAt) === String(rule.updatedAt),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Rule save failed.', error: error.message });
  }
});

router.delete('/tax-rules/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const r = await TaxRule.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ success: false, message: 'Rule not found.' });
    invalidateTaxRules();
    res.json({ success: true, message: 'Tax rule removed; the category default applies again.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Delete failed.', error: error.message });
  }
});

export default router;
