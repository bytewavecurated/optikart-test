import React, { useState, useEffect } from 'react';
import { FiTrendingUp, FiDollarSign, FiShoppingBag, FiPackage } from 'react-icons/fi';
import { seller as sellerApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const SellerAnalytics = () => {
  const [period, setPeriod] = useState('30d');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await sellerApi.getAnalytics(period);
        setAnalytics(res.data.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, [period]);

  const stats = analytics?.stats || {};

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Analytics</h1>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{ label: '7 Days', value: '7d' }, { label: '30 Days', value: '30d' }, { label: '90 Days', value: '90d' }].map((p) => (
                <button key={p.value} onClick={() => setPeriod(p.value)} style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '13px', border: `1px solid ${period === p.value ? 'var(--primary)' : 'var(--border)'}`, background: period === p.value ? 'var(--primary)' : '#fff', color: period === p.value ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>{p.label}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Total Revenue', value: `₹${(stats.revenue || 0).toLocaleString()}`, icon: <FiDollarSign />, color: '#26a541', bg: '#e8f5e9' },
                  { label: 'Total Orders', value: stats.orders || 0, icon: <FiShoppingBag />, color: '#2874f0', bg: '#e8f0fe' },
                  { label: 'Avg Order Value', value: `₹${stats.avgOrderValue || 0}`, icon: <FiTrendingUp />, color: '#ff9f00', bg: '#fff3e0' },
                  { label: 'Products Sold', value: stats.productsSold || 0, icon: <FiPackage />, color: '#ff6161', bg: '#fce4ec' },
                ].map((card) => (
                  <div key={card.label} className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div><p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '4px' }}>{card.label}</p><h3 style={{ fontSize: '24px', fontWeight: 700 }}>{card.value}</h3></div>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{card.icon}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="analytics-grid">
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Top Selling Products</h3>
                  {analytics?.topProducts?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {analytics.topProducts.map((product, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                          <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
                          <div style={{ flex: 1 }}><div style={{ fontSize: '14px', fontWeight: 500 }}>{product.name}</div><div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{product.sold} sold</div></div>
                          <span style={{ fontSize: '14px', fontWeight: 600 }}>₹{product.revenue}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p style={{ fontSize: '14px', color: 'var(--text-light)' }}>No data available</p>}
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Recent Activity</h3>
                  {analytics?.recentActivity?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {analytics.recentActivity.map((activity, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderBottom: '1px solid var(--border-light)' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}><div style={{ fontSize: '14px' }}>{activity.description}</div><div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{new Date(activity.timestamp).toLocaleString()}</div></div>
                        </div>
                      ))}
                    </div>
                  ) : <p style={{ fontSize: '14px', color: 'var(--text-light)' }}>No recent activity</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
      <style>{`@media (max-width: 768px) { .analytics-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
};

export default SellerAnalytics;
