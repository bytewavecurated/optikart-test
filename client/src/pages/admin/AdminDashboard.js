import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiShoppingBag, FiDollarSign, FiPackage, FiTrendingUp, FiTruck, FiTag, FiFileText, FiSettings, FiActivity, FiImage, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';

const AdminDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await adminApi.dashboard();
        setDashboard(res.data.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const stats = dashboard?.stats || {};

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers || 0, icon: <FiUsers />, color: '#2874f0', bg: '#e8f0fe' },
    { label: 'Total Sellers', value: stats.totalSellers || 0, icon: <FiShoppingBag />, color: '#ff9f00', bg: '#fff3e0' },
    { label: 'Total Orders', value: stats.totalOrders || 0, icon: <FiPackage />, color: '#26a541', bg: '#e8f5e9' },
    { label: 'Revenue', value: `₹${(stats.totalRevenue || 0).toLocaleString('en-IN')}`, icon: <FiDollarSign />, color: '#ff6161', bg: '#fce4ec' },
  ];

  const quickLinks = [
    { label: 'Manage Users', path: '/admin/users', icon: <FiUsers />, color: '#2874f0' },
    { label: 'Manage Sellers', path: '/admin/sellers', icon: <FiShoppingBag />, color: '#ff9f00' },
    { label: 'View Orders', path: '/admin/orders', icon: <FiPackage />, color: '#26a541' },
    { label: 'Revenue Analytics', path: '/admin/revenue', icon: <FiDollarSign />, color: '#ff6161' },
    { label: 'Subscriptions', path: '/admin/subscriptions', icon: <FiTrendingUp />, color: '#7c4dff' },
    { label: 'Sale Events', path: '/admin/sale-events', icon: <FiActivity />, color: '#e91e63' },
    { label: 'Banners', path: '/admin/banners', icon: <FiImage />, color: '#00bcd4' },
    { label: 'Coupons', path: '/admin/coupons', icon: <FiTag />, color: '#ff5722' },
    { label: 'Blog Management', path: '/admin/blogs', icon: <FiFileText />, color: '#607d8b' },
    { label: 'Staff Management', path: '/admin/staff', icon: <FiSettings />, color: '#9c27b0' },
    { label: 'Delivery', path: '/admin/delivery', icon: <FiTruck />, color: '#795548' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {statCards.map((card) => (
          <div key={card.label} className="card" style={{ padding: '20px', borderLeft: `4px solid ${card.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px', margin: 0 }}>{card.label}</p>
                <h3 style={{ fontSize: '28px', fontWeight: 700, color: '#212121', margin: '8px 0 0 0' }}>{card.value}</h3>
              </div>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: card.bg,
                color: card.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px'
              }}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#212121' }}>Quick Access</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
          {quickLinks.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                padding: '20px',
                background: '#fff',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                textDecoration: 'none',
                transition: 'all 0.2s',
                border: '1px solid #e0e0e0',
                textAlign: 'center'
              }}
              className="quick-link-card"
            >
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: `${item.color}15`,
                color: item.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px'
              }}>
                {item.icon}
              </div>
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#212121' }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#212121' }}>Recent Activity</h2>
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          <FiPackage size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <p style={{ fontSize: '14px' }}>Activity feed coming soon</p>
        </div>
      </div>

      <style>{`
        .quick-link-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          border-color: #2874f0 !important;
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
