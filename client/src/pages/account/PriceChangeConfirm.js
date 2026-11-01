import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { cart as cartApi } from '../../services/apiBridge';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi';

/**
 * Lands here from the link in the price-change email. The token in the query
 * string is the only authority - no sign-in is required, which is the point of
 * emailing a link - and the server re-checks expiry before applying anything.
 */
export default function PriceChangeConfirm() {
  const { stockId } = useParams();
  const [params] = useSearchParams();
  const decision = params.get('decision') === 'decline' ? 'decline' : 'accept';
  const token = params.get('token') || '';

  const [state, setState] = useState({ phase: 'working' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await cartApi.decidePriceChangeByToken(stockId, token, decision);
        if (!cancelled) setState({ phase: 'done', result: res.data });
      } catch (err) {
        if (cancelled) return;
        setState({
          phase: 'done',
          failed: true,
          expired: !!err.response?.data?.expired,
          message: err.response?.data?.message || 'This confirmation link is no longer valid.'
        });
      }
    })();
    return () => { cancelled = true; };
  }, [stockId, token, decision, cartApi]);

  const ok = state.phase === 'done' && !state.failed;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <Header />
      <main className="container" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div className="card-flat" style={{ maxWidth: 520, width: '100%', padding: 34, textAlign: 'center' }}>
          {state.phase === 'working' && (
            <>
              <FiClock size={36} style={{ color: 'var(--text-light)', marginBottom: 14 }} />
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Confirming…</h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Checking your link against the request.</p>
            </>
          )}
          {state.phase === 'done' && ok && (
            <>
              <FiCheckCircle size={38} style={{ color: 'var(--success)', marginBottom: 14 }} />
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>{decision === 'accept' ? 'Price accepted' : 'Change declined'}</h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 22px', lineHeight: 1.6 }}>{state.result.message}</p>
              <Link to="/seller/stock" className="btn btn-primary">Open my listings</Link>
            </>
          )}
          {state.phase === 'done' && state.failed && (
            <>
              <FiXCircle size={38} style={{ color: 'var(--danger)', marginBottom: 14 }} />
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>{state.expired ? 'The window has closed' : 'We could not apply that change'}</h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 22px', lineHeight: 1.6 }}>{state.message}</p>
              <Link to="/seller/stock" className="btn btn-outline">Review my listings</Link>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
