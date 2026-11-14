import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { toast } from '../../services/api';
import { toastError } from '../../services/errors';
// Feather has no bank or rupee glyph; FiIndianRupee silently existed only in
// my head and broke the build the last time it was used here.
import { FiRefreshCw, FiCreditCard, FiCheck, FiAlertTriangle, FiDollarSign } from 'react-icons/fi';

/*
 * The half of partner payouts a person has to operate.
 *
 * The settlement endpoints existed before this screen did, which meant the only
 * way to pay a delivery partner out of the queue was a `curl` call. A withdrawal
 * that cannot be settled is money a named person is owed and has not received,
 * so leaving the write path API-only is the same failure as a button that does
 * nothing, with a longer delay before anyone notices.
 *
 * What this screen deliberately does NOT do is mark anything paid without a bank
 * reference. `settlePartnerWithdrawal` refuses it server-side - an untraceable
 * payment in someone's earnings history is worse than a pending one - so the form
 * requires the reference too and the error arrives as a message instead of a
 * silently disabled button.
 */
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const PartnerPayoutQueue = () => {
  const [data, setData] = useState({ withdrawals: [], count: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [refs, setRefs] = useState({});
  const [notes, setNotes] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/delivery-partner/payouts/pending');
      setData({
        withdrawals: res.data?.withdrawals || [],
        count: res.data?.count || 0,
        totalValue: res.data?.totalValue || 0
      });
    } catch (err) {
      setError(err.response?.data?.message || 'The payout queue could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const settle = async (row) => {
    const reference = String(refs[row.withdrawalId] || '').trim();
    if (reference.length < 6) {
      toast.warn('Enter the bank transfer reference (UTR) actually used. Settlement without one is refused.');
      return;
    }
    setBusy(row.withdrawalId);
    try {
      const res = await api.post(
        `/delivery-partner/payouts/${row.withdrawalId}/settle`,
        { partnerId: row.partner.id, reference, note: notes[row.withdrawalId] || '' }
      );
      toast.success(res.data?.message || 'Withdrawal marked as settled.');
      setRefs((prev) => ({ ...prev, [row.withdrawalId]: '' }));
      setNotes((prev) => ({ ...prev, [row.withdrawalId]: '' }));
      await load();
    } catch (err) {
      toastError(err, err.response?.data?.message || err.response?.data?.error || 'Settlement failed.');
    } finally {
      setBusy('');
    }
  };

  const cell = { padding: '9px 12px', fontSize: 13, borderBottom: '1px solid var(--border-light)', verticalAlign: 'top' };
  const head = { padding: '9px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'left' };

  return (
    <div style={{ padding: '0 0 36px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiDollarSign style={{ color: 'var(--primary)' }} /> Partner payout queue
        </h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link to="/admin/cash-reconciliation" style={{ fontSize: 12.5, color: 'var(--primary)' }}>Cash reconciliation</Link>
          <button className="btn btn-quiet" onClick={load} disabled={loading}>
            <FiRefreshCw style={{ marginRight: 6 }} />{loading ? 'Loading' : 'Refresh'}
          </button>
        </div>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 820, lineHeight: 1.6 }}>
        Withdrawal requests held as <em>awaiting settlement</em>: the money is reserved against the partner's balance
        but has not been recorded as paid, because no RazorpayX payout accepted it. Pay the partner through the bank,
        then enter the transfer reference here. The amount only leaves their available balance when real money moved -
        this used to stamp a fabricated <code>payout_&lt;timestamp&gt;</code> reference and mark it processed.
      </p>

      {error && (
        <div style={{ display: 'flex', gap: 10, padding: 12, marginBottom: 16, borderRadius: 'var(--radius)', background: 'rgba(220,38,38,.07)', color: 'var(--danger)', fontSize: 13 }}>
          <FiAlertTriangle style={{ marginTop: 2 }} /><span>{error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Awaiting settlement', value: data.count },
          { label: 'Total to pay out', value: inr(data.totalValue) }
        ].map((card) => (
          <div key={card.label} className="card" style={{ padding: 14, border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
              {typeof card.value === 'number' ? card.value.toLocaleString('en-IN') : card.value}
            </div>
          </div>
        ))}
      </div>

      {!loading && data.withdrawals.length === 0 && !error && (
        <div className="card" style={{ padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>
          Nothing is waiting. Every partner withdrawal has either been paid through the gateway or settled here with a
          bank reference. Partners can request one withdrawal per day, so a quiet queue is normal - it is worth
          confirming the queue is empty rather than assuming, which is why this page counts what it fetched.
        </div>
      )}

      {data.withdrawals.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-soft, #fafafa)' }}>
                  <th style={head}>Partner</th>
                  <th style={head}>Bank account</th>
                  <th style={{ ...head, textAlign: 'right' }}>Requested</th>
                  <th style={{ ...head, textAlign: 'right' }}>Net pays</th>
                  <th style={head}>Record the transfer</th>
                </tr>
              </thead>
              <tbody>
                {data.withdrawals.map((row) => (
                  <tr key={row.withdrawalId}>
                    <td style={cell}>
                      <div style={{ fontWeight: 700 }}>{row.partner?.name || 'Partner'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        {row.partner?.uniqueId}{row.partner?.phone ? ` · ${row.partner.phone}` : ''}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-light)' }}>
                        requested {row.requestedAt ? new Date(row.requestedAt).toLocaleString('en-IN') : 'unknown'}
                      </div>
                    </td>
                    <td style={cell}>
                      {row.bank?.accountNumber ? (
                        <>
                          <div style={{ fontFamily: 'monospace', fontSize: 12.5 }}>
                            <FiCreditCard size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                            {row.bank.accountNumber}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            {row.bank.ifsc}{row.bank.holder ? ` · ${row.bank.holder}` : ''}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--danger)', fontSize: 12 }}>No bank details on file - the partner must add them before payment.</span>
                      )}
                    </td>
                    <td style={{ ...cell, textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>{inr(row.amount)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-light)' }}>
                        fee {inr(row.platformFee)} · net {inr(row.netPaid)}
                      </div>
                    </td>
                    <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{inr(row.netPaid)}</td>
                    <td style={cell}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <input
                          className="input"
                          style={{ width: 170 }}
                          placeholder="Bank reference / UTR"
                          value={refs[row.withdrawalId] || ''}
                          onChange={(e) => setRefs((p) => ({ ...p, [row.withdrawalId]: e.target.value }))}
                        />
                        <input
                          className="input"
                          style={{ width: 150 }}
                          placeholder="Note (optional)"
                          value={notes[row.withdrawalId] || ''}
                          onChange={(e) => setNotes((p) => ({ ...p, [row.withdrawalId]: e.target.value }))}
                        />
                        <button
                          className="btn btn-primary"
                          style={{ padding: '7px 13px', fontSize: 12.5 }}
                          disabled={busy === row.withdrawalId || !row.bank?.accountNumber}
                          onClick={() => settle(row)}
                        >
                          <FiCheck style={{ marginRight: 6 }} />
                          {busy === row.withdrawalId ? 'Settling' : 'Mark settled'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerPayoutQueue;
