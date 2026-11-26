#!/usr/bin/env node
/**
 * Backfill invoices for orders that predate the invoice engine (or whose
 * paperwork failed at the time - the logs will show invoice_*_failed rows,
 * and this tool is the remedy either way).
 *
 * Idempotent by construction: issueOrderInvoices re-uses the existing row if
 * one is found and only RE-CREATES what is missing, so this can run in a
 * loop forever. `--delivered-only` skips the customer-doc pass for very old
 * test data nobody wants to mail. DRY-RUN prints what would be minted.
 *
 *   MONGODB_URI=... node scripts/invoices_backfill.mjs [--limit=N] [--delivered-only] [--dry]
 */
import Order from '../server/models/Order.js';

// scripts/ has no node_modules of its own; the models hand us the live
// mongoose instance (every suite uses this exact accessor)
const mongoose = Order.db.base;

const BASE = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eyewear-platform';
const args = new Set(process.argv.slice(2));
const limitN = (() => {
  const a = [...args].find((x) => x.startsWith('--limit='));
  return a ? Math.max(0, Number(a.split('=')[1]) || 0) : 0;
})();
const deliveredOnly = args.has('--delivered-only');
const dry = args.has('--dry');

let done = 0;
let made = 0;
let skips = 0;

async function main() {
  await mongoose.connect(BASE);
  const Invoice = (await import('../server/models/Invoice.js')).default;
  const eng = await import('../server/services/invoiceEngine.js');
  const filter = deliveredOnly ? { orderStatus: { $in: ['delivered', 'completed'] } } : {};
  const cursor = Order.find(filter)
    .sort({ createdAt: 1 })
    .limit(limitN || 0)
    .cursor();
  const t0 = Date.now();
  for await (const order of cursor) {
    done += 1;
    const hasCust = await Invoice.exists({ type: 'customer', order: order._id });
    const settled = ['delivered', 'completed'].includes(order.orderStatus);
    const hasSell = settled ? await Invoice.exists({ type: 'seller', order: order._id }) : true;
    // docs on paper are NOT enough: the PDF must exist on disk too. The
    // inventory probe reports `filesMissing` precisely because rows and
    // filesystem can diverge (host swap, partial restore); the engine's
    // issue pass re-renders whatever it finds absent, so skipping here is
    // only correct when both docs exist AND their files resolve.
    let filesOk = true;
    if (hasCust && hasSell) {
      const { invoicePdfPath } = await import('../server/services/invoiceEngine.js');
      const fs0 = await import('node:fs');
      const docs = await Invoice.find({ order: order._id }).select('pdfPath').lean();
      filesOk = docs.every((d) => d.pdfPath && fs0.existsSync(invoicePdfPath(d)));
    }
    if (hasCust && hasSell && filesOk) {
      skips += 1;
      continue;
    }
    if (dry) {
      console.log('WOULD MINT', order.orderNumber, settled ? '(customer+seller)' : '(customer)');
      made += 1;
      continue;
    }
    const r = await eng.issueOrderInvoices(order._id, { stage: settled ? 'settled' : 'issued' });
    if (r.ok === false) console.error('FAILED', order.orderNumber, r.error);
    else made += (r.results || []).length;
  }
  console.log(
    `scanned ${done}, minted ${made} documents, skipped ${skips} complete orders in ${((Date.now() - t0) / 1000).toFixed(1)}s`
  );
  await mongoose.connection.close();
}

main().catch((e) => {
  console.error('backfill failed:', e.message);
  process.exitCode = 1;
});
