import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiFileText, FiDownload } from 'react-icons/fi';
import { invoices as invoicesApi } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { downloadInvoicePdf } from '../components/InvoiceDownload.js';

/*
 * The shopper's own invoices: every tax document minted for the orders
 * under THIS account (and only this account - the API returns 404 for any
 * other person's id, deliberately shaped like "does not exist"; a legal
 * document about someone else's purchase must not confirm existence even
 * by a status code).
 */
const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MyInvoices() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    invoicesApi
      .mine()
      .then((r) => setRows(r.data.invoices || []))
      .catch((e) => setErr(e.response?.data?.message || 'Could not load your invoices.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }} className="container page-wrapper">
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 6px' }}>
          <FiFileText style={{ color: 'var(--primary)', verticalAlign: -3, marginRight: 8 }} />
          My invoices
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
          Every tax invoice for your OptiKart orders, with GST shown separately where it applies.
        </p>

        {loading ? <p style={{ color: 'var(--text-light)' }}>Loading…</p> : null}
        {err ? <p style={{ color: 'var(--danger)' }}>{err}</p> : null}

        {!loading && !rows.length && !err ? (
          <div className="card-flat" style={{ padding: 20 }}>
            You have no invoices yet - the first is minted with your first order's confirmation.{' '}
            <Link to="/products" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              Shop
            </Link>
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
          {rows.map((r) => (
            <div
              key={r.invoiceNumber}
              className="card-flat"
              style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}
            >
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 800 }}>{r.invoiceNumber}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                  {r.issuedAt
                    ? new Date(r.issuedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : ''}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Link
                  to={`/orders/${r.orderId}`}
                  style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
                >
                  {r.orderNumber}
                </Link>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
                  {r.lines || r.linesCount || ''} · {String(r.paymentMethod || '').toUpperCase()} ·{' '}
                  {String(r.paymentStatus || '').toUpperCase()}
                  {r.status === 'void' ? ' · VOID/CANCELLED' : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800 }}>₹{money(r.summary?.chargedTotal)}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-light)' }}>incl GST {money(r.summary?.taxTotal)}</div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => downloadInvoicePdf(r.id, r.invoiceNumber).then((res) => res.ok || setErr(res.message))}
              >
                <FiDownload size={13} style={{ marginRight: 6, verticalAlign: -2 }} /> PDF
              </button>
            </div>
          ))}
        </div>
        {err ? <div style={{ color: 'var(--danger)', marginTop: 10 }}>{err}</div> : null}
      </main>
      <Footer />
    </div>
  );
}
