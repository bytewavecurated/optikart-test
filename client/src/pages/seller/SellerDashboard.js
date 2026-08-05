import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPackage, FiShoppingBag, FiDollarSign, FiTrendingUp, FiPlus, FiBell } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { seller as sellerApi, notifications } from '../../services/api';
import { onNewOrder, offNewOrder } from '../../services/socket';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const SellerDashboard = () => {
  const { seller: sellerData } = useAuth();
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, totalProducts: 0, pendingOrders: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analyticsRes, ordersRes, notifRes] = await Promise.allSettled([
          sellerApi.getAnalytics('7d'),
          sellerApi.getOrders({ limit: 5 }),
          notifications.getAll({ limit: 1, unread: true }),
        ]);
        if (analyticsRes.status === 'fulfilled') setStats(analyticsRes.value.data.data || {});
        if (ordersRes.status === 'fulfilled') setRecentOrders(ordersRes.value.data.data || []);
        if (notifRes.status === 'fulfilled') setNotifCount(notifRes.value.data.pagination?.total || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    const handleNewOrder = () => {
      toast.success('New order received!');
      fetchData();
    };
    onNewOrder(handleNewOrder);
    return () => offNewOrder(handleNewOrder);
  }, []);

  const statCards = [
    { label: 'Total Orders', value: stats.totalOrders, icon: <FiShoppingBag />, color: '#2874f0', bg: '#e8f0fe', link: '/seller/orders' },
    { label: 'Revenue', value: `₹${(stats.totalRevenue || 0).toLocaleString()}`, icon: <FiDollarSign />, color: '#26a541', bg: '#e8f5e9', link: '/seller/analytics' },
    { label: 'Products', value: stats.totalProducts, icon: <FiPackage />, color: '#ff9f00', bg: '#fff3e0', link: '/seller/products' },
    { label: 'Pending Orders', value: stats.pendingOrders, icon: <FiTrendingUp />, color: '#ff6161', bg: '#fce4ec', link: '/seller/orders' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Welcome, {sellerData?.businessName || 'Seller'}</h1>
              <p style={{ fontSize: '14px', color: 'var(--text-light)' }}>Here's what's happening with your store</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Link to="/seller/products" className="btn btn-primary"><FiPlus /> Add Product</Link>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner spinner-lg" /></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {statCards.map((card) => (
                  <Link key={card.label} to={card.link} className="card" style={{ padding: '20px', transition: 'box-shadow 0.2s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '4px' }}>{card.label}</p>
                        <h3 style={{ fontSize: '24px', fontWeight: 700 }}>{card.value}</h3>
                      </div>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{card.icon}</div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Recent Orders</h2>
                  <Link to="/seller/orders" style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 500 }}>View All</Link>
                </div>
                {recentOrders.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>No orders yet</div>
                ) : (
                  <div>
                    {recentOrders.map((order) => (
                      <div key={order._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border-light)' }}>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: 500 }}>#{order._id.slice(-8).toUpperCase()}</span>
                          <span style={{ fontSize: '13px', color: 'var(--text-light)', marginLeft: '12px' }}>{new Date(order.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600 }}>₹{order.total}</span>
                          <span className="badge" style={{ background: order.status === 'delivered' ? 'var(--success-light)' : 'var(--warning-light)', color: order.status === 'delivered' ? 'var(--success)' : 'var(--warning)', textTransform: 'capitalize' }}>{order.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SellerDashboard;
