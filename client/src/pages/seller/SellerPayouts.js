import React, { useState, useEffect, useCallback } from 'react';
import { FiDollarSign, FiClock, FiCheckCircle, FiAlertCircle, FiTruck } from 'react-icons/fi';
import api from '../../services/api';
import { toastError } from '../../services/errors.js';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import BackButton from '../../components/BackButton';

/**
 * Payouts.
 *
 * The statement is split the way the money actually moves: what the seller has
 * earned on delivered orders, what the platform has promised in a payout run, what
 * has reached the bank, and what is therefore still outstanding. Those four are not
 * the same number, and a screen that shows only a list of transfers leaves a shop
 * unable to tell "not yet paid" from "never going to be paid".
 */
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const dateLabel = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const STATUS_TONE = {
  completed: { color: 'var(--success)', bg: 'var(--success-light)' },
  processing: { color: 'var(--brand)', bg: 'var(--brand-tint)' },
  pending: { color: 'var(--warning)', bg: '#fdf3e3' },
  failed: { color: 'var(--danger)', bg: 'var(--danger-light)' }
};

const th = { padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '12px 14px', fontSize: 13.5, borderBottom: '1px solid var(--border-light)', verticalAlign: 'top' };

const Tile = ({ label, value, hint, tone }) => (
  <div className="card-flat" style={{ padding: '16px 18px' }}>
    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{label}</p>
    <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 800, color: tone || 'var(--text-primary)' }}>{value}</p>
    {hint && <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>{hint}</p>}
  </div>
);

export default function SellerPayouts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/seller/payouts/history');
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load the payout statement.');
      toastError(e, 'Could not load the payout statement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1 }} className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        </main>
        <Footer />
      </div>
    );
  }

  const s = data?.summary || {};
  const payouts = data?.payouts || [];
  const deliveries = data?.recentDeliveries || [];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <BackButton />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Payouts</h1>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--text-secondary)' }}>
            Commission is 3% of the order value. Platform-run delivery charges are deducted on top, so each line below reconciles from the order total.
          </p>

          {error && (
            <div className="card-flat" style={{ padding: 14, marginBottom: 16, borderLeft: '3px solid var(--danger)', color: 'var(--danger)', fontSize: 13.5 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Tile label="Earned on deliveries" value={money(s.earnings)} hint={`${s.deliveredOrders || 0} delivered order(s)`} />
            <Tile
              label="Outstanding"
              value={money(s.outstanding)}
              tone={s.outstanding > 0 ? 'var(--warning)' : 'var(--success)'}
              hint={s.outstanding > 0 ? 'Not yet included in any payout run' : 'Nothing unpaid'}
            />
            <Tile label="In a payout run" value={money(s.promised)} hint="Sent to the bank, not yet confirmed" tone="var(--brand)" />
            <Tile label="Paid to your account" value={money(s.paid)} hint={s.lastPayoutAt ? `Last settled ${dateLabel(s.lastPayoutAt)}` : 'No completed payout yet'} tone="var(--success)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
            <div className="card-flat" style={{ padding: '14px 16px', fontSize: 13.5, color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gross sales</span><strong style={{ color: 'var(--text-primary)' }}>{money(s.grossSales)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}><span>Platform commission</span><strong style={{ color: 'var(--danger)' }}>− {money(s.commission)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}><span>Delivered</span><strong style={{ color: 'var(--text-primary)' }}>{s.deliveredOrders || 0} orders</strong></div>
            </div>
            {s.codUncollected > 0 && (
              <div className="card-flat" style={{ padding: '14px 16px', borderLeft: '3px solid var(--warning)' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Cash on delivery not yet collected</p>
                <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                  {money(s.codUncollected)} is held back until the courier reports the cash collected. If a delivered COD order still shows here, the completion step was missed.
                </p>
              </div>
            )}
            {s.failedCount > 0 && (
              <div className="card-flat" style={{ padding: '14px 16px', borderLeft: '3px solid var(--danger)' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>{s.failedCount} failed payout{s.failedCount === 1 ? '' : 's'} ({money(s.failed)})</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Check the bank details below and contact support to retry these.</p>
              </div>
            )}
            {data?.bank?.accountNumber && (
              <div className="card-flat" style={{ padding: '14px 16px' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Paid into</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                  {data.bank.accountHolderName} · {data.bank.accountNumber} · {data.bank.ifscCode}
                </p>
              </div>
            )}
          </div>

          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px' }}>Payout runs</h2>
          {payouts.length === 0 ? (
            <div className="card-flat" style={{ padding: 26, textAlign: 'center', color: 'var(--text-secondary)' }}>
              <FiDollarSign size={30} />
              <p style={{ margin: '10px 0 0' }}>
                No payout run yet. {s.outstanding > 0
                  ? `${money(s.outstanding)} earned on delivered orders is waiting for the next one.`
                  : 'Payouts appear here once the platform settles a period.'}
              </p>
            </div>
          ) : (
            <div className="card-flat" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Payout', 'Period', 'Sales', 'Commission', 'Delivery borne', 'Net paid', 'Status', 'Completed'].map((h) => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => {
                    const tone = STATUS_TONE[p.status] || STATUS_TONE.pending;
                    return (
                      <tr key={p._id}>
                        <td style={{ ...td, fontWeight: 700 }}>{p.payoutNumber || String(p._id).slice(-8).toUpperCase()}</td>
                        <td style={{ ...td, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {dateLabel(p.period?.startDate)} → {dateLabel(p.period?.endDate)}
                        </td>
                        <td style={td}>{money(p.totalSales)}</td>
                        <td style={{ ...td, color: 'var(--danger)' }}>− {money(p.platformCommission)}</td>
                        <td style={{ ...td, color: 'var(--danger)' }}>− {money(p.deliveryCharges)}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{money(p.netAmount)}</td>
                        <td style={td}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: tone.color, background: tone.bg, padding: '3px 9px', borderRadius: 4, textTransform: 'capitalize' }}>
                            {p.status === 'completed' ? <FiCheckCircle size={12} /> : p.status === 'failed' ? <FiAlertCircle size={12} /> : <FiClock size={12} />}
                            {p.status}
                          </span>
                          {p.transactionId && <div style={{ fontSize: 11.5, color: 'var(--text-light)', marginTop: 4 }}>{p.transactionId}</div>}
                        </td>
                        <td style={{ ...td, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{dateLabel(p.completedAt || p.processedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {deliveries.length > 0 && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: '26px 0 10px' }}>
                <FiTruck size={15} style={{ verticalAlign: -2, marginRight: 8 }} />What is earning you money right now
              </h2>
              <div className="card-flat" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Order', 'Delivered', 'Order value', 'Commission', 'You keep', 'Payment'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {deliveries.map((o) => (
                      <tr key={o._id}>
                        <td style={{ ...td, fontWeight: 700 }}>{o.orderNumber}</td>
                        <td style={{ ...td, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{dateLabel(o.deliveredAt)}</td>
                        <td style={td}>{money(o.totalAmount)}</td>
                        <td style={{ ...td, color: 'var(--danger)' }}>− {money(o.commissionAmount)}</td>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--success)' }}>{money(o.netAmountToSeller)}</td>
                        <td style={{ ...td, color: o.paymentStatus === 'completed' ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                          {o.paymentMethod === 'cod' ? (o.paymentStatus === 'completed' ? 'Cash collected' : 'Cash pending') : (o.paymentStatus === 'completed' ? 'Paid online' : 'Payment pending')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-light)', margin: '10px 0 0' }}>The ten most recent delivered orders, so a missing figure can be traced to an order rather than guessed at.</p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
