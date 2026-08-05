import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiShoppingBag, FiDollarSign, FiPackage, FiTrendingUp, FiTruck, FiTag, FiFileText, FiSettings } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const AdminDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await adminApi.dashboard();
        setDashboard(res.data.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const stats = dashboard?.stats || {};
  const navItems = [
    { label: 'Users', path: '/admin/users', icon: <FiUsers />, color: '#2874f0' },
    { label: 'Sellers', path: '/admin/sellers', icon: <FiShoppingBag />, color: '#ff9f00' },
    { label: 'Orders', path: '/admin/orders', icon: <FiPackage />, color: '#26a541' },
    { label: 'Revenue', path: '/admin/revenue', icon: <FiDollarSign />, color: '#ff6161' },
    { label: 'Subscriptions', path: '/admin/subscriptions', icon: <FiTrendingUp />, color: '#7c4dff' },
    { label: 'Staff', path: '/admin/staff', icon: <FiSettings />, color: '#00bcd4' },
    { label: 'Coupons', path: '/admin/coupons', icon: <FiTag />, color: '#e91e63' },
    { label: 'Blogs', path: '/admin/blogs', icon: <FiFileText />, color: '#ff5722' },
    { label: 'Delivery', path: '/admin/delivery', icon: <FiTruck />, color: '#607d8b' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>Admin Dashboard</h1>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                {[
                  { label: 'Total Users', value: stats.totalUsers || 0, icon: <FiUsers />, color: '#2874f0', bg: '#e8f0fe' },
                  { label: 'Total Sellers', value: stats.totalSellers || 0, icon: <FiShoppingBag />, color: '#ff9f00', bg: '#fff3e0' },
                  { label: 'Total Orders', value: stats.totalOrders || 0, icon: <FiPackage />, color: '#26a541', bg: '#e8f5e9' },
                  { label: 'Revenue', value: `₹${(stats.totalRevenue || 0).toLocaleString()}`, icon: <FiDollarSign />, color: '#ff6161', bg: '#fce4ec' },
                ].map((card) => (
                  <div key={card.label} className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div><p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '4px' }}>{card.label}</p><h3 style={{ fontSize: '24px', fontWeight: 700 }}>{card.value}</h3></div>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{card.icon}</div>
                    </div>
                  </div>
                ))}
              </div>

              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Management</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                {navItems.map((item) => (
                  <Link key={item.path} to={item.path} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center', transition: 'box-shadow 0.2s' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${item.color}15`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{item.icon}</div>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.label}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminDashboard;
