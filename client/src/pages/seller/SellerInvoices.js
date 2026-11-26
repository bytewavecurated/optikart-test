import React, { useState, useEffect, useCallback } from 'react';
import { FiFileText, FiDownload } from 'react-icons/fi';
import { invoices as invoicesApi } from '../../services/api';
import { toastError } from '../../services/errors.js';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import BackButton from '../../components/BackButton';
import { downloadInvoicePdf } from '../../components/InvoiceDownload.js';

const money = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/*
 * Seller - Invoices.
 *
 * Per order: the sale value billed to the shop, the commission + its GST,
 * any fulfilment recharge, and the net that was credited (COD: what the
 * rider collected against what lands here). This is the document the shop's
 * own accountant files against, and the numbers come from the settlement
 * that already moved the money - the page shows the same truth the platform
 * booked, and every row downloads as a real tax invoice.
 */
export default function SellerInvoices() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    invoicesApi
      .sellerList()
      .then((r) => setRows(r.data.invoices || []))
      .catch((e) => setErr(e.response?.data?.message || 'Could not load invoices.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }} className="container page-wrapper">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <BackButton to="/seller/dashboard" />
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
            <FiFileText style={{ verticalAlign: -3, color: 'var(--primary)', marginRight: 8 }} />
            Invoices for orders
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 6 }}>
          One document per delivered order: commission and platform charges billed to you (GST on those shown
          separately), and the net amount credited to your settlement. Keep these for your GST filings - they match the
          amounts the platform booked, line for line.
        </p>

        {loading ? <div style={{ padding: 30, color: 'var(--text-light)' }}>Loading your invoices…</div> : null}
        {err ? <div style={{ padding: 14, color: 'var(--danger)' }}>{err}</div> : null}

        {!loading && !rows.length ? (
          <div className="card-flat" style={{ padding: 22, marginTop: 12, color: 'var(--text-secondary)' }}>
            No seller invoices yet. They are minted automatically when an order reaches DELIVERED and settlement records
            the commission. Until then, your{' '}
            <a href="/seller/payouts" style={{ color: 'var(--primary)' }}>
              payouts
            </a>{' '}
            view already shows the same amounts.
          </div>
        ) : null}

        {!loading && rows.length ? (
          <div
            style={{
              overflowX: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              marginTop: 12,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr>
                  {[
                    'Invoice',
                    'Order',
                    'Issued',
                    'Sale value',
                    'Commission + GST',
                    'Fulfilment',
                    'Net credited',
                    'Payment',
                    ' ',
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '9px 12px',
                        textAlign: ['Sale value', 'Commission + GST', 'Fulfilment', 'Net credited'].includes(h)
                          ? 'right'
                          : 'left',
                        fontSize: 11,
                        letterSpacing: '.05em',
                        textTransform: 'uppercase',
                        color: 'var(--text-light)',
                        background: 'var(--bg-secondary)',
                        position: 'sticky',
                        top: 0,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const svc = r.serviceLines || [];
                  const svcsTotal = svc.reduce((x, l) => x + (l.baseAmount || 0), 0);
                  return (
                    <tr key={r.id || r.invoiceNumber}>
                      <td style={{ padding: '9px 12px', fontWeight: 700 }}>{r.invoiceNumber}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{r.orderNumber}</td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        {r.issuedAt ? new Date(r.issuedAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>{money(r.summary?.chargedTotal)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                        {money(r.commissionAmount)}{' '}
                        <span style={{ fontSize: 11, color: 'var(--text-light)' }}>
                          + GST {money(r.taxOnServicesTotal)}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                        {money(svcsTotal - (r.commissionAmount || 0))}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                        {money(r.netPayableToSeller)}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        {String(r.paymentStatus).toUpperCase()} · {r.paymentMethod === 'cod' ? 'COD cash' : 'prepaid'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() =>
                            downloadInvoicePdf(r.id || r.invoiceNumber, r.invoiceNumber).then((res) => {
                              if (!res.ok) toastError(new Error(res.message || ''));
                            })
                          }
                        >
                          <FiDownload size={12} style={{ marginRight: 5, verticalAlign: -2 }} /> PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
