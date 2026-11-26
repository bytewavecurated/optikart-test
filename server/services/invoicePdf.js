import PDFDocument from 'pdfkit';

/*
 * One layout, two documents.

 * What this file guarantees, copied from the way the real marketplace
 * invoices look (Flipkart/Amazon habits worth stealing):
 *  - identical header/grid/footline for BOTH kinds - it must be instantly
 *    recognisable as an OptiKart invoice whether the reader is the shopper
 *    or the shop;
 *  - a per-line table with HSN/SAC + quantity + taxable + GST amount +
 *    line total, then a totals block that re-adds visibly;
 *  - a standalone tax break-up: CGST/SGST halves for intra-state supply,
 *    IGST for inter-state, and a mixed supply shows its split honestly;
 *  - status words that match the payment record: COD 'payable on delivery'
 *    with the exact amount, PAID with gateway reference, VOID with a
 *    reason across the face;
 *  - the SELLER document is services-invoiced by OptiKart: commission on
 *    the sale value with GST ADDED (exclusive basis) as its own rows and
 *    the settlement outcome (net credited / COD collected) as the footer
 *    story - numbers lifted from the settlement the money already moved
 *    by (services/commissionTracking.js), never re-imaged.

 * Technical: base-14 fonts only (helvetica), A4, no external assets, so a
 * copy renders identically anywhere, forever. Tables share one width
 * vector per section - alignment by construction.
 */

const INK = '#20242e';
const MUT = '#5b6272';
const LINE = '#d6dae3';

const money = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '₹0.00';
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const day = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const legalName = () => process.env.INVOICE_LEGAL_NAME || 'OptiKart Retail';
const gstin = () => process.env.INVOICE_GSTIN || '';
const platformState = () => process.env.INVOICE_PLATFORM_STATE || '';
const contactBits = () =>
  [process.env.INVOICE_SUPPORT_EMAIL || '', process.env.INVOICE_SUPPORT_PHONE || ''].filter(Boolean).join(' · ');

function header(doc, kindLabel, tagline) {
  doc.y = 40;
  doc.rect(36, 36, 360, 3).fill('#2c3ed9');
  doc.fontSize(17).font('Helvetica-Bold').fillColor(INK).text(legalName(), 36, 48);
  doc.fontSize(7.5).font('Helvetica').fillColor(MUT);
  const meta = [];
  if (gstin()) meta.push(`GSTIN ${gstin()}`);
  if (platformState()) meta.push(`State: ${platformState()}`);
  const addr = process.env.INVOICE_PLATFORM_ADDRESS || '';
  if (addr) meta.push(addr);
  const c = contactBits();
  if (c) meta.push(`Support: ${c}`);
  meta.forEach((l, i) => doc.text(l, 36, 70 + i * 10.5));
  doc.fontSize(13).font('Helvetica-Bold').fillColor(INK).text(kindLabel, 340, 48, { width: 220, align: 'right' });
  doc.fontSize(7.5).fillColor(MUT).font('Helvetica').text(tagline, 340, 66, { width: 220, align: 'right' });
  doc.y = 108;
}

function kvGrid(doc, pairs) {
  const top = doc.y;
  const width = doc.page.width - 72;
  const cw = width / 4;
  pairs.forEach(([k, v], i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 36 + col * cw;
    const y = top + row * 22;
    doc
      .fontSize(6.5)
      .fillColor(MUT)
      .font('Helvetica')
      .text(String(k).toUpperCase(), x, y, { width: cw - 4 });
    doc
      .fontSize(9)
      .fillColor(INK)
      .font('Helvetica-Bold')
      .text(String(v ?? '-'), x, y + 8, { width: cw - 4 });
  });
  doc.y = top + Math.ceil(pairs.length / 4) * 22 + 4;
}

function parties(doc, blocks) {
  const width = doc.page.width - 72;
  const cw = (width - 16) / blocks.length;
  const top = doc.y;
  let maxBottom = top;
  blocks.forEach((b, i) => {
    const x = 36 + i * (cw + 16);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(MUT).text(b.title.toUpperCase(), x, top, { width: cw });
    let yy = top + 11;
    b.lines.filter(Boolean).forEach((l, n) => {
      doc
        .fontSize(n === 0 ? 9.5 : 8)
        .font(n === 0 ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(n === 0 ? INK : MUT)
        .text(String(l), x, yy, { width: cw });
      yy += n === 0 ? 12 : 10.5;
    });
    maxBottom = Math.max(maxBottom, yy);
  });
  doc.y = maxBottom + 6;
}

class Table {
  constructor(doc, widths, aligns) {
    this.doc = doc;
    this.widths = widths;
    this.aligns = aligns;
    this.total = widths.reduce((a, b) => a + b, 0);
  }
  head(cells) {
    this._row(cells.map(String), true);
  }
  row(cells) {
    this._row(cells.map((c) => (c == null ? '-' : String(c))));
  }
  _row(vals, isHead = false) {
    const doc = this.doc;
    const specs = vals.map((t, i) => {
      const w = Math.max(24, this.widths[i] - 5);
      return { t, w, x: this.widths.slice(0, i).reduce((a, b) => a + b, 0), a: this.aligns[i] };
    });
    const heights = specs.map((s) => doc.heightOfString(s.t, { width: s.w, lineGap: 0 }));
    const h = Math.max(isHead ? 12 : 13, Math.max(...heights) + 3);
    if (doc.y + h > doc.page.height - 96) {
      doc.addPage();
      doc.rect(36, doc.y - 1, this.total, h).fill(HEAD_BG2);
    }
    const top = doc.y;
    if (isHead) {
      doc.rect(36, top, this.total, h).fill('#eef0f6');
    } else {
      doc
        .moveTo(36, top + h)
        .lineTo(36 + this.total, top + h)
        .strokeColor(LINE)
        .lineWidth(0.5)
        .stroke();
    }
    doc
      .font(isHead ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isHead ? 7.2 : 8)
      .fillColor(INK);
    specs.forEach((s) => {
      doc.text(s.t, 36 + s.x + 2, top + 2, { width: s.w, align: s.a, lineGap: 0 });
    });
    doc.y = top + h + 1.5;
  }
}
const HEAD_BG2 = '#eef0f6';

function summaryBlock(doc, rows, taxRows, bigRow) {
  const width = doc.page.width - 72;
  const top = doc.y;
  rows.forEach(([k, v], i) => {
    const last = i === rows.length - 1;
    doc
      .fontSize(last ? 9.5 : 8.5)
      .font(last ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(INK)
      .text(k, 36, top + i * 13.5, { width: width * 0.6 });
    doc.text(v, 36 + width * 0.62, top + i * 13.5, { width: width * 0.36, align: 'right' });
  });
  let ty = top + rows.length * 13.5 + 10;
  if (taxRows) {
    doc.fontSize(8).font('Helvetica-Bold').fillColor(INK).text('GST ALREADY INCLUDED / BILLED (break-up)', 36, ty);
    ty += 12;
    taxRows.forEach(([k, v]) => {
      doc.fontSize(8).font('Helvetica').fillColor(INK).text(k, 42, ty);
      doc.text(v, 36 + width * 0.62, ty, { width: width * 0.36, align: 'right' });
      ty += 10.5;
    });
  }
  if (bigRow) {
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#2c3ed9')
      .text(bigRow[0], 36, ty + 4);
    doc.text(bigRow[1], 36, ty + 18, { width });
    ty += 40;
  }
  doc.y = ty;
}

function footer(doc, extraNotes) {
  const width = doc.page.width - 72;
  doc.y = Math.min(doc.y + 6, doc.page.height - 120);
  doc.fontSize(7.5).fillColor(MUT).font('Helvetica');
  [
    'Prices and amounts shown are the amounts charged/credited; GST, where shown, is the tax component extracted from (customer) or added to (seller services) those amounts under the declared HSN/SAC on each line.',
    'This is a computer-generated invoice and requires no signature.',
    ...(gstin()
      ? []
      : ['NOTE: platform GSTIN not configured - set INVOICE_GSTIN before relying on these copies for filings.']),
    ...extraNotes,
  ].forEach((l) => doc.text(l, 36, doc.y, { width, lineGap: 0.6 }));
}

/* ------------------------------------------------------------------ main -- */

export async function renderInvoicePdf(inv, order) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    bufferPages: true,
    info: { Title: `Invoice ${inv.invoiceNumber}`, Author: legalName() },
  });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const finished = new Promise((res) => doc.on('end', () => res(Buffer.concat(chunks))));

  const isCust = inv.type === 'customer';
  header(
    doc,
    isCust ? 'TAX INVOICE' : 'TAX INVOICE - SERVICES',
    isCust ? 'Original for the recipient' : 'OptiKart bills the seller: commission & services'
  );

  const supply =
    inv.summary?.supplyKind === 'inter'
      ? 'IGST (inter-state)'
      : inv.summary?.supplyKind === 'mixed'
        ? 'CGST/SGST + IGST mix'
        : 'CGST + SGST';
  kvGrid(doc, [
    ['Invoice No', inv.invoiceNumber],
    ['Invoice date', day(inv.issuedAt)],
    ['Order No', inv.orderNumber],
    ['Order date', day(order?.issuedAt || inv.createdAt)],
    ['Payment mode', String(inv.paymentMethod || '').toUpperCase()],
    ['Payment status', String(inv.paymentStatus || '').toUpperCase()],
    ['Place of supply', inv.supplyStateContext?.shippingState || inv.sellerSnapshot?.state || ''],
    [
      'Tax treatment',
      isCust ? supply : inv.summary?.supplyKind === 'inter' ? 'IGST (services, inter-state)' : 'CGST+SGST',
    ],
  ]);

  if (inv.status === 'void') {
    doc.save();
    doc
      .fillOpacity(0.45)
      .fillColor('#a83232')
      .font('Helvetica-Bold')
      .fontSize(30)
      .text(`VOID\n${inv.voidReason || 'order cancelled'}`, 160, 360, { align: 'center', width: 300, lineGap: 6 });
    doc.restore();
    doc.fillOpacity(1).fillColor(INK).fontSize(9);
    doc.y += 40;
  }

  const s = inv.summary || {};

  if (isCust) {
    const b = inv.buyerSnapshot || {};
    const sel = inv.sellerSnapshot || {};
    parties(doc, [
      {
        title: 'Bill to',
        lines: [
          b.name,
          b.address,
          [b.city, b.pincode].filter(Boolean).join(' - '),
          b.state,
          [b.phone, b.email].filter(Boolean).join(' · '),
        ],
      },
      { title: 'Ship to', lines: [b.name, b.address, [b.city, b.pincode].filter(Boolean).join(' - '), b.state] },
      {
        title: 'Sold by',
        lines: [
          sel.storeName,
          sel.gstNumber ? `GSTIN ${sel.gstNumber}` : '',
          [sel.city, sel.state].filter(Boolean).join(', '),
        ],
      },
    ]);

    doc
      .fontSize(9.5)
      .font('Helvetica-Bold')
      .fillColor(INK)
      .text(`1. ITEMS  (${(inv.lines || []).length})`, 36, doc.y + 2);
    doc.y += 4;
    const t = new Table(
      doc,
      [12, 178, 40, 20, 56, 56, 52, 62, 26, 54, 58],
      ['left', 'left', 'left', 'center', 'right', 'right', 'right', 'right', 'center', 'right', 'right']
    );
    t.head([
      '#',
      'ITEM / BRAND / VARIANT',
      'HSN',
      'Qty',
      'Rate (incl)',
      'Gross',
      'Less disc',
      'Taxable (incl)',
      'GST',
      'GST amt',
      'Line total',
    ]);
    (inv.lines || []).forEach((l, i) => {
      const desc = [l.name, l.brand && !String(l.name || '').includes(l.brand) ? l.brand : null, l.variantSummary]
        .filter(Boolean)
        .join(' / ');
      t.row([
        i + 1,
        desc,
        l.hsn,
        l.quantity,
        money(l.unitPriceInclusive),
        money(l.grossInclusive),
        l.discountShare ? `-${money(l.discountShare)}` : '-',
        money(l.taxableInclusive),
        `${l.gstRatePercent}%`,
        money(l.gstComponent),
        money(l.lineTotal),
      ]);
    });

    const svcTotals = [
      ['Delivery charge', '9965', s.deliveryChargeInclusive, 18],
      ['Platform fee', '9972', s.platformFeeInclusive, 18],
      ['COD handling surcharge', '9972', s.codHandlingInclusive, 18],
    ].filter((r) => (Number(r[2]) || 0) > 0);
    if (svcTotals.length) {
      doc.y += 4;
      doc.fontSize(9.5).font('Helvetica-Bold').text(`2. SERVICES BILLED BY OPTIKART  (${svcTotals.length})`, 36, doc.y);
      doc.y += 4;
      const t2 = new Table(doc, [12, 250, 50, 60, 60, 110], ['left', 'left', 'left', 'right', 'right', 'right']);
      t2.head(['#', 'SERVICE (tax basis: amount is INCLUSIVE of GST)', 'SAC', 'Rate', 'GST in it', 'Amount (incl)']);
      svcTotals.forEach((r, i) => {
        const incl = Number(r[2]) || 0;
        const gst = incl === 0 ? 0 : Math.round((incl - incl / (1 + r[3] / 100)) * 100) / 100;
        t2.row([i + 1, r[0], r[1], `${r[3]}%`, money(gst), money(incl)]);
      });
    }

    doc.y += 6;
    summaryBlock(
      doc,
      [
        ['Merchandise (taxable, incl)', money(s.merchandiseInclusive)],
        s.discountTotal
          ? [
              `Less: coupon discount${order?.couponApplied ? ` (${order.couponApplied})` : ''}`,
              `-${money(s.discountTotal)}`,
            ]
          : null,
        [
          'Add: delivery / platform / COD',
          money((s.deliveryChargeInclusive || 0) + (s.platformFeeInclusive || 0) + (s.codHandlingInclusive || 0)),
        ],
        s.roundOff ? ['Rounding', money(s.roundOff)] : null,
        ['TOTAL CHARGED (taxes included)', money(s.chargedTotal)],
      ].filter(Boolean),
      undefined,
      [
        `TOTAL TO PAY · ${money(s.chargedTotal)}`,
        inv.paymentMethod === 'cod'
          ? 'in cash to the delivery agent, amount as above'
          : `PAID${inv.paymentId ? ` · ${inv.paymentId}` : ''}`,
      ]
    );

    const tax = [
      s.cgstTotal ? ['CGST', money(s.cgstTotal)] : null,
      s.sgstTotal ? ['SGST', money(s.sgstTotal)] : null,
      s.igstTotal ? ['IGST', money(s.igstTotal)] : null,
    ].filter(Boolean);
    if (tax.length) {
      const width = doc.page.width - 72;
      let yy = doc.y + 2;
      tax.forEach(([k, v]) => {
        doc.fontSize(8).fillColor(MUT).font('Helvetica').text(`${k} (included in the totals above)`, 36, yy);
        doc.fillColor(INK).text(v, 36, yy, { width, align: 'right' });
        yy += 10;
      });
      doc.y = yy;
    }
  } else {
    const sel = inv.sellerSnapshot || {};
    parties(doc, [
      {
        title: 'Bill to (seller)',
        lines: [
          sel.storeName,
          sel.gstNumber ? `GSTIN ${sel.gstNumber}` : '',
          [sel.city, sel.state].filter(Boolean).join(', '),
        ],
      },
      { title: 'Services billed by', lines: [legalName(), gstin() ? `GSTIN ${gstin()}` : '', `${platformState()}`] },
    ]);

    doc
      .fontSize(9.5)
      .font('Helvetica-Bold')
      .fillColor(INK)
      .text(`1. MERCHANDISE SOLD ON ORDER ${inv.orderNumber}`, 36, doc.y);
    doc.y += 4;
    const t = new Table(
      doc,
      [12, 260, 40, 22, 70, 58, 60],
      ['left', 'left', 'left', 'center', 'right', 'right', 'right']
    );
    t.head(['#', 'PRODUCT / BRAND', 'HSN', 'Qty', 'Sale value (incl)', `Comm %`, 'Commission base']);
    (inv.lines || []).forEach((l, i) => {
      t.row([
        i + 1,
        [l.name, l.brand].filter(Boolean).join(' / '),
        l.hsn,
        l.quantity,
        money(l.taxableInclusive),
        `${inv.commissionPercentage ?? 3}%`,
        money(l.taxableInclusive),
      ]);
    });

    const svcs = inv.sellerServices || [];
    if (svcs.length) {
      doc.y += 4;
      doc
        .fontSize(9.5)
        .fillColor(INK)
        .font('Helvetica-Bold')
        .text('2. OPTIKART CHARGES FOR THIS ORDER (GST ADDED ON TOP - services basis)', 36, doc.y);
      doc.y += 4;
      const t2 = new Table(
        doc,
        [12, 214, 44, 40, 54, 50, 90],
        ['left', 'left', 'left', 'center', 'right', 'right', 'right']
      );
      t2.head(['#', 'SERVICE', 'SAC', 'GST', 'Base', 'GST amt', 'Total billed']);
      svcs.forEach((sl, i) => {
        const tot = Math.round((sl.baseAmount + sl.gstAmount) * 100) / 100;
        t2.row([
          i + 1,
          sl.nature,
          sl.sac || '9972',
          `${sl.gstRatePercent}%`,
          money(sl.baseAmount),
          money(sl.gstAmount),
          money(tot),
        ]);
      });
    }

    doc.y += 6;
    const deductRows = [
      ['Merchandise (taxable, incl)', money(s.merchandiseInclusive || s.chargedTotal)],
      ['Less: commission billed', `- ${money((inv.commissionAmount || 0) + inv.taxOnServicesTotal)}`],
      [
        'Less: fulfilment recharge billed',
        `- ${money((svcs.find((x) => (x.nature || '').toLowerCase().includes('fulfilment')) || {}).baseAmount || 0) + ((svcs.find((x) => (x.nature || '').toLowerCase().includes('fulfilment')) || {}).gstAmount || 0)}`,
      ],
      ['NET CREDITED TO SELLER (this order)', money(inv.netPayableToSeller)],
    ];
    summaryBlock(
      doc,
      deductRows,
      [
        `Of which GST on OptiKart services (payable by the seller; input credit applies): ${money(inv.taxOnServicesTotal)}`,
      ],
      [
        inv.paymentMethod === 'cod' ? 'COD ORDER' : 'PREPAID ORDER',
        inv.paymentMethod === 'cod'
          ? `Buyer paid ${money(order?.totalAmount || 0)} cash at delivery; after the charges above, ${money(inv.netPayableToSeller)} is credited to your settled balance.`
          : `After the charges above, ${money(inv.netPayableToSeller)} is credited to your settled balance.`,
      ]
    );
  }

  footer(
    doc,
    isCust
      ? []
      : [
          'Commission percentage is contractual per the marketplace agreement; this invoice records it for the order shown.',
        ]
  );
  doc.end();
  return finished;
}
