import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { toastError } from '../../services/errors';
import { FiRefreshCw, FiAlertTriangle, FiDollarSign } from 'react-icons/fi';

/*
 * Cash collected on delivery, reconciled.
 *
 * Somebody physically took money at a door. Until the amount was recorded when
 * that was confirmed, an admin could see that a cash order was "paid" and not
 * how much was in the envelope, which meant the only reconciliation available
 * was trust, and the only way to find out about a shortfall was a dispute.
 *
 * `discrepancy` is the number that matters: cash that should be in the box and
 * has not been recorded as taken. It is shown first among the partners, because
 * that is where asking begins.
 *
 * The ₹39 per-order cash-handling charge is broken out from merchandise. It is
 * the platform's money, not a shop's, and leaving it folded into the goods total
 * is how a payout argument starts with both sides certain and the arithmetic
 * silent.
 */
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const CashReconciliation = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/cash-reconciliation', { params: { days } });
      setData(res.data);
    } catch (error) {
      toastError(error, 'The cash could not be reconciled right now.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const totals = data?.totals || {};
  const unrecorded = data?.unrecorded || {};

  const cell = { padding: '9px 12px', fontSize: 13, borderBottom: '1px solid var(--border-light)' };
  const head = { padding: '9px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'left' };

  return (
    <div style={{ padding: '0 0 36px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiDollarSign style={{ color: 'var(--primary)' }} /> Cash reconciliation
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Window</label>
          <select className="input" style={{ width: 120 }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 14, 30, 90, 180].map((d) => <option key={d} value={d}>last {d} days</option>)}
          </select>
          <button className="btn btn-quiet" onClick={load} disabled={loading}>
            <FiRefreshCw style={{ marginRight: 6 }} />{loading ? 'Loading' : 'Refresh'}
          </button>
        </div>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 800, lineHeight: 1.6 }}>
        Delivered cash orders in the window. What should have been collected, what was recorded against each
        pickup, and the difference. Cash-handling charges (flat ₹39 per order) are listed apart from merchandise:
        that money is the platform's and is never part of a seller's payout.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Cash orders', value: totals.orders ?? 0, plain: true },
          { label: 'Due to be collected', value: inr(totals.due) },
          { label: 'Recorded as collected', value: inr(totals.recorded) },
          { label: 'Difference', value: inr(totals.discrepancy), alarm: Number(totals.discrepancy) !== 0 },
          { label: 'Of which handling charges', value: inr(totals.cashHandlingCharges) },
          { label: 'Of which merchandise', value: inr(totals.merchandise) }
        ].map((card) => (
          <div key={card.label} className="card" style={{ padding: 14, border: card.alarm ? '1px solid var(--danger)' : '1px solid var(--border-light)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: card.alarm ? 'var(--danger)' : 'var(--text-primary)' }}>
              {card.plain ? Number(card.value).toLocaleString('en-IN') : card.value}
            </div>
          </div>
        ))}
      </div>

      {Number(totals.discrepancy) !== 0 && (
        <div style={{ display: 'flex', gap: 10, padding: 14, marginBottom: 18, borderRadius: 'var(--radius)', background: 'rgba(220, 38, 38, .07)', color: 'var(--danger)', fontSize: 13 }}>
          <FiAlertTriangle style={{ marginTop: 2 }} />
          <span>
            {inr(totals.discrepancy)} was due on delivered cash orders and has no recorded collection
            {unrecorded.count ? ` across ${unrecorded.count} order${unrecorded.count === 1 ? '' : 's'}` : ''}.
            Confirm with the partner named below before treating any of it as missing.
          </span>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>By partner</h2>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>largest gap first</span>
        </div>
        {(data?.byPartner || []).length === 0 ? (
          <div style={{ padding: 18, fontSize: 13, color: 'var(--text-secondary)' }}>No delivered cash orders in this window.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-soft, #fafafa)' }}>
                  <th style={head}>Collected by</th>
                  <th style={{ ...head, textAlign: 'right' }}>Orders</th>
                  <th style={{ ...head, textAlign: 'right' }}>Due</th>
                  <th style={{ ...head, textAlign: 'right' }}>Recorded</th>
                  <th style={{ ...head, textAlign: 'right' }}>Handling</th>
                  <th style={{ ...head, textAlign: 'right' }}>Difference</th>
                </tr>
              </thead>
              <tbody>
                {data.byPartner.map((row) => (
                  <tr key={row.who}>
                    <td style={{ ...cell, fontWeight: 600 }}>{row.who}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{row.orders}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{inr(row.due)}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{inr(row.recorded)}</td>
                    <td style={{ ...cell, textAlign: 'right', color: 'var(--text-secondary)' }}>{inr(row.handling)}</td>
                    <td style={{ ...cell, textAlign: 'right', fontWeight: 700, color: row.difference ? 'var(--danger)' : 'var(--success)' }}>
                      {inr(row.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(unrecorded.orders || []).length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Delivered with no recorded collection</h2>
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Older orders, completed before the amount was recorded - or a pickup nobody confirmed. Worth walking
              through before the next shift closes.
            </p>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: '10px 16px 16px', display: 'grid', gap: 6 }}>
            {unrecorded.orders.map((o) => (
              <li key={o.orderNumber} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--border-light)', padding: '6px 0' }}>
                <span style={{ fontWeight: 600 }}>{o.orderNumber}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {inr(o.totalAmount)}
                  {o.deliveredAt ? ` · delivered ${new Date(o.deliveredAt).toLocaleDateString('en-IN')}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CashReconciliation;
