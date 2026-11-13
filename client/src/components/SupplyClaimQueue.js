import React, { useCallback, useEffect, useState } from 'react';
import api, { toast } from '../services/api';
import { FiCheck, FiX, FiInbox, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';

/*
 * One panel for both halves of the supply-claim decision.
 *
 * The brand answers "did we supply this shop"; the platform then verifies the
 * listing itself. Same shape of work - a claim, a stated source, a person who
 * can accept or refuse it with a reason - so one component takes the two
 * endpoints and renders whichever queue it is pointed at, rather than a second
 * near-identical screen that drifts the next time someone adds a field.
 *
 * Rejecting always needs a reason: the shop is told why, and "no" without a
 * sentence cannot be acted on.
 */
const SupplyClaimQueue = ({
  fetchUrl,
  decideUrl,
  stage,
  emptyTitle = 'Nothing waiting',
  emptyText = 'No shop has asked to list your brand for approval right now.'
}) => {
  const [rows, setRows] = useState([]);
  const [grandfathered, setGrandfathered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [reasons, setReasons] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(fetchUrl);
      const body = res.data || {};
      const list = body.requests ?? body.awaitingVerification ?? [];
      setRows(Array.isArray(list) ? list : []);
      setGrandfathered(Array.isArray(body.grandfathered) ? body.grandfathered : []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load the queue.');
    } finally {
      setLoading(false);
    }
  }, [fetchUrl]);

  useEffect(() => { load(); }, [load]);

  const decide = async (row, decision) => {
    const reason = String(reasons[row.id] || '').trim();
    if (decision === 'reject' && reason.length < 5) {
      toast.error('Tell the shop why, in enough words to act on.');
      return;
    }
    setBusyId(row.id);
    try {
      const res = await api.post(decideUrl, {
        listingKind: row.listingKind,
        listingId: row.id,
        decision,
        reason
      });
      toast.success(res.data?.message || (decision === 'approve' ? 'Approved.' : 'Refused.'));
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'That decision could not be recorded.');
    } finally {
      setBusyId('');
    }
  };

  const proofLabel = {
    manufacturer_purchase: 'bought from the brand',
    brand_distribution: 'supplied as a stockist',
    other: 'NOT sourced from the brand'
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {rows.length} claim{rows.length === 1 ? '' : 's'} waiting on {stage}
        </div>
        <button className="btn btn-quiet" onClick={load} disabled={loading}>
          <FiRefreshCw style={{ marginRight: 6 }} />{loading ? 'Loading' : 'Refresh'}
        </button>
      </div>

      {!loading && rows.length === 0 && (
        <div className="card" style={{ padding: 18, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <FiInbox size={22} style={{ marginBottom: 6 }} />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emptyTitle}</div>
          <div style={{ fontSize: 12.5 }}>{emptyText}</div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((row) => {
          const listing = row.listing || {};
          const proof = listing.sellerProof || {};
          const history = (listing.history || []).slice(-3);
          return (
            <div key={row.id} className="card" style={{ padding: 14, border: '1px solid var(--border-light)', borderRadius: 'var(--radius)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{row.title || row.brand || 'A listing'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {row.brand ? `${row.brand} · ` : ''}
                    listed through {row.listingKind === 'storefront' ? 'their storefront' : 'order-stock claim'}
                    {listing.declarationCount > 1 ? ` · declared ${listing.declarationCount} times` : ''}
                  </div>
                </div>
                <span style={{
                  fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                  background: proof.kind === 'other' ? 'rgba(217, 119, 6, .14)' : 'rgba(22, 163, 74, .12)',
                  color: proof.kind === 'other' ? 'var(--warning-dark, #8a6d3b)' : 'var(--success)'
                }}>
                  {proofLabel[proof.kind] || 'source not stated'}
                </span>
              </div>

              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.55 }}>
                {proof.kind === 'other'
                  ? <>Stated source: <em>&ldquo;{proof.note}&rdquo;</em></>
                  : <>Reference given: <strong>{proof.reference}</strong>{proof.note ? ` — ${proof.note}` : ''}</>}
                {proof.declaredAt ? ` · ${new Date(proof.declaredAt).toLocaleString('en-IN')}` : ''}
                {proof.declaredBy ? ` · by ${proof.declaredBy}` : ''}
              </div>

              {history.length > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6 }}>
                  {history.map((h, i) => (
                    <div key={i}>{new Date(h.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {h.action}{h.by ? ` (${h.by})` : ''}{h.detail ? ` — ${h.detail}` : ''}</div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <input
                  className="input"
                  style={{ flex: '1 1 220px' }}
                  placeholder={stage === 'the brand' ? 'Reason, if you did not supply them' : 'Why this is verified, or what is wrong with it'}
                  value={reasons[row.id] || ''}
                  onChange={(e) => setReasons({ ...reasons, [row.id]: e.target.value })}
                />
                <button className="btn btn-primary" disabled={busyId === row.id} onClick={() => decide(row, 'approve')}>
                  <FiCheck style={{ marginRight: 6 }} />{stage === 'the brand' ? 'We supplied them' : 'Verify listing'}
                </button>
                <button className="btn btn-quiet" style={{ color: 'var(--danger)' }} disabled={busyId === row.id} onClick={() => decide(row, 'reject')}>
                  <FiX style={{ marginRight: 6 }} />Refuse
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {grandfathered.length > 0 && (
        <div style={{ marginTop: 18, padding: 14, border: '1px dashed var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-soft, #fafafa)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 700 }}>
            <FiAlertTriangle style={{ color: 'var(--warning-dark, #8a6d3b)' }} />
            {grandfathered.length} listings were selling before supply claims became a rule
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            They keep selling: hiding a catalogue that existed under the old rules would break the storefront for
            reasons nobody caused. But no brand ever confirmed these, and that is recorded rather than implied.
            Work through them by asking the shop for its invoice, or pause the listing.
          </p>
        </div>
      )}
    </div>
  );
};

export default SupplyClaimQueue;
