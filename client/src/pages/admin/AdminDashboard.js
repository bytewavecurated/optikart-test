import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiShoppingBag, FiDollarSign, FiPackage, FiTrendingUp, FiTruck, FiTag, FiFileText, FiSettings, FiActivity, FiImage, FiArrowUp, FiArrowDown, FiBarChart2, FiPieChart } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';

const AdminDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await adminApi.dashboard();
        setDashboard(res.data.dashboard || res.data.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const stats = dashboard?.stats || dashboard || {};
  const recentOrders = dashboard?.recentOrders || dashboard?.recent_orders || [];

  // Only figures the API actually returns are shown - no invented month-on-month
  // deltas, which would misread as real analytics.
  const statCards = [
    { label: 'Customers', value: (stats.totalUsers || 0).toLocaleString('en-IN'), icon: <FiUsers /> },
    { label: 'Sellers', value: (stats.totalSellers || 0).toLocaleString('en-IN'), sub: `${stats.verifiedSellers || 0} verified`, icon: <FiShoppingBag /> },
    { label: 'Orders', value: (stats.totalOrders || 0).toLocaleString('en-IN'), sub: `${stats.pendingOrders || 0} pending`, icon: <FiPackage /> },
    { label: 'Revenue', value: `Rs. ${(stats.totalRevenue || 0).toLocaleString('en-IN')}`, sub: `Avg order Rs. ${(stats.avgOrderValue || 0).toLocaleString('en-IN')}`, icon: <FiDollarSign /> },
  ];

  const quickLinks = [
    { label: 'Manage Users', path: '/admin/users', icon: <FiUsers />, color: 'var(--brand)', desc: 'View and manage all users' },
    { label: 'Manage Sellers', path: '/admin/sellers', icon: <FiShoppingBag />, color: 'var(--brand)', desc: 'Oversee seller accounts' },
    { label: 'Manage Executives', path: '/admin/executives', icon: <FiSettings />, color: 'var(--brand)', desc: 'Control executive access' },
    { label: 'Manage Manufacturers', path: '/admin/manufacturers', icon: <FiPackage />, color: 'var(--brand)', desc: 'Manage manufacturer accounts' },
    { label: 'View Orders', path: '/admin/orders', icon: <FiPackage />, color: 'var(--brand)', desc: 'Track all orders' },
    { label: 'Revenue Analytics', path: '/admin/revenue', icon: <FiBarChart2 />, color: 'var(--brand)', desc: 'Financial insights' },
    { label: 'Sale Events', path: '/admin/sale-events', icon: <FiActivity />, color: '#e91e63', desc: 'Create sales events' },
    { label: 'Banners', path: '/admin/banners', icon: <FiImage />, color: 'var(--brand)', desc: 'Manage homepage banners' },
    { label: 'Coupons', path: '/admin/coupons', icon: <FiTag />, color: '#ff5722', desc: 'Create discount codes' },
    { label: 'Blog Management', path: '/admin/blogs', icon: <FiFileText />, color: '#607d8b', desc: 'Manage blog content' },
    { label: 'Staff Management', path: '/admin/staff', icon: <FiSettings />, color: 'var(--brand)', desc: 'Manage staff accounts' },
    { label: 'Delivery', path: '/admin/delivery', icon: <FiTruck />, color: '#795548', desc: 'Track deliveries' },
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
      {/* Welcome Section */}
      <div style={{
        background: 'var(--bg-white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
        marginBottom: '28px',
        color: 'var(--text-primary)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            Welcome back, Admin!
          </h1>
          <p style={{ fontSize: '16px', margin: 0, opacity: 0.95 }}>
            Here's what's happening with your store today.
          </p>
        </div>
        <div style={{ 
          position: 'absolute', 
          right: '-50px', 
          top: '-50px', 
          width: '200px', 
          height: '200px', 
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '50%'
        }} />
        <div style={{ 
          position: 'absolute', 
          right: '50px', 
          bottom: '-30px', 
          width: '150px', 
          height: '150px', 
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '50%'
        }} />
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        {statCards.map((card, idx) => (
          <div key={idx} style={{ 
            background: '#fff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s ease'
          }} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <p style={{ fontSize: '14px', color: '#757575', margin: '0 0 8px 0', fontWeight: 500 }}>{card.label}</p>
                <h3 style={{ fontSize: '32px', fontWeight: 800, color: '#212121', margin: 0, letterSpacing: '-0.5px' }}>
                  {card.value}
                </h3>
              </div>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                fontSize: 20,
                flexShrink: 0
              }}>
                {card.icon}
              </div>
            </div>
            {card.sub && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0 0' }}>{card.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#212121', letterSpacing: '-0.5px' }}>
              Quick Access
            </h2>
            <p style={{ fontSize: '14px', color: '#757575', margin: '4px 0 0 0' }}>
              Manage your store efficiently
            </p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {quickLinks.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                padding: '24px',
                background: '#fff',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                textDecoration: 'none',
                transition: 'all 0.3s ease',
                border: '1px solid #f0f0f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}
              className="quick-link-card"
            >
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: `${item.color}15`,
                color: item.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                flexShrink: 0
              }}>
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#212121', display: 'block', marginBottom: '4px' }}>
                  {item.label}
                </span>
                <span style={{ fontSize: '13px', color: '#757575' }}>
                  {item.desc}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div style={{ 
        background: '#fff',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px', color: '#212121', margin: '0 0 24px 0' }}>
          Recent Activity
        </h2>
        {recentOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20,
              background: 'var(--brand-tint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--brand)', fontSize: 32, margin: '0 auto 20px'
            }}>
              <FiPieChart />
            </div>
            <p style={{ fontSize: 16, color: '#757575', margin: 0 }}>No orders have been placed yet</p>
            <p style={{ fontSize: 14, color: '#9e9e9e', margin: '8px 0 0 0' }}>
              New orders will appear here as soon as customers start checking out.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {recentOrders.map((o) => (
              <Link
                key={o._id}
                to="/admin/orders"
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                  padding: '12px 14px', border: '1px solid #f0f0f0', borderRadius: 10,
                  textDecoration: 'none', color: 'inherit'
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{o.orderId || o._id}</div>
                  <div style={{ fontSize: 12, color: '#9e9e9e' }}>
                    {o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN') : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    Rs. {(o.totalAmount || 0).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: 12, color: '#757575', textTransform: 'capitalize' }}>
                    {(o.orderStatus || 'pending').replace(/_/g, ' ')}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
        .quick-link-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          border-color: ${quickLinks[0]?.color || '#667eea'} !important;
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
