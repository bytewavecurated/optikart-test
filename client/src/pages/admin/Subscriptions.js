import React, { useState, useEffect } from 'react';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const Subscriptions = () => {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try { const res = await adminApi.getSubscriptions(); setSubs(res.data.data || []); } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>Seller Subscriptions ({subs.length})</h1>
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div> : subs.length === 0 ? <div className="empty-state"><h3>No subscriptions</h3></div> : (
            <div className="card">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>{['Seller', 'Plan', 'Amount', 'Status', 'Start Date', 'End Date'].map((h) => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {subs.map((sub) => (
                    <tr key={sub._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500 }}>{sub.seller?.businessName || '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', textTransform: 'capitalize' }}>{sub.plan}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600 }}>₹{sub.amount}</td>
                      <td style={{ padding: '12px 16px' }}><span className={`badge ${sub.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{sub.status}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{new Date(sub.startDate).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{sub.endDate ? new Date(sub.endDate).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Subscriptions;
