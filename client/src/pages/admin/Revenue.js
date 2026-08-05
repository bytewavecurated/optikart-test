import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiTrendingUp, FiShoppingBag } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const Revenue = () => {
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    const fetch = async () => {
      try { const res = await adminApi.getRevenue({ period }); setRevenue(res.data.data); } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, [period]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Revenue</h1>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{ label: '7 Days', value: '7d' }, { label: '30 Days', value: '30d' }, { label: '90 Days', value: '90d' }, { label: '1 Year', value: '1y' }].map((p) => (
                <button key={p.value} onClick={() => setPeriod(p.value)} style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '13px', border: `1px solid ${period === p.value ? 'var(--primary)' : 'var(--border)'}`, background: period === p.value ? 'var(--primary)' : '#fff', color: period === p.value ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>{p.label}</button>
              ))}
            </div>
          </div>
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Total Revenue', value: `₹${(revenue?.total || 0).toLocaleString()}`, icon: <FiDollarSign />, color: '#26a541', bg: '#e8f5e9' },
                  { label: 'Platform Fees', value: `₹${(revenue?.platformFees || 0).toLocaleString()}`, icon: <FiTrendingUp />, color: '#2874f0', bg: '#e8f0fe' },
                  { label: 'Seller Payouts', value: `₹${(revenue?.sellerPayouts || 0).toLocaleString()}`, icon: <FiShoppingBag />, color: '#ff9f00', bg: '#fff3e0' },
                  { label: 'Orders', value: revenue?.orderCount || 0, icon: <FiShoppingBag />, color: '#ff6161', bg: '#fce4ec' },
                ].map((card) => (
                  <div key={card.label} className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div><p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '4px' }}>{card.label}</p><h3 style={{ fontSize: '24px', fontWeight: 700 }}>{card.value}</h3></div>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{card.icon}</div>
                    </div>
                  </div>
                ))}
              </div>
              {revenue?.monthlyBreakdown?.length > 0 && (
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Monthly Breakdown</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Month', 'Revenue', 'Orders', 'Avg Value'].map((h) => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {revenue.monthlyBreakdown.map((m, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '10px 16px', fontSize: '14px' }}>{m.month}</td>
                          <td style={{ padding: '10px 16px', fontSize: '14px', fontWeight: 600 }}>₹{m.revenue?.toLocaleString()}</td>
                          <td style={{ padding: '10px 16px', fontSize: '14px' }}>{m.orders}</td>
                          <td style={{ padding: '10px 16px', fontSize: '14px' }}>₹{m.avgValue?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Revenue;
