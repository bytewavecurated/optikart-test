import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPackage, FiChevronRight } from 'react-icons/fi';
import { orders } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';

const STATUS_COLORS = { pending: '#ff9f00', confirmed: '#2874f0', shipped: '#2874f0', delivered: '#26a541', cancelled: '#ff6161', returned: '#878787' };

const UserOrders = () => {
  const [orderList, setOrderList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await orders.getAll({ status: filter !== 'all' ? filter : undefined });
        setOrderList(res.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (isAuthenticated) fetchOrders();
    else setLoading(false);
  }, [filter, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main className="container page-wrapper">
          <div className="empty-state">
            <FiPackage style={{ fontSize: '64px', color: 'var(--text-light)', marginBottom: '16px' }} />
            <h3>Please login to view orders</h3>
            <Link to="/login" className="btn btn-primary">Login</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>My Orders</h1>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((s) => (
              <button key={s} onClick={() => setFilter(s)} style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, border: `1px solid ${filter === s ? 'var(--primary)' : 'var(--border)'}`, background: filter === s ? 'var(--primary-light)' : '#fff', color: filter === s ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', textTransform: 'capitalize' }}>
                {s}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner spinner-lg" /></div>
          ) : orderList.length === 0 ? (
            <div className="empty-state">
              <FiPackage style={{ fontSize: '64px', color: 'var(--text-light)', marginBottom: '16px' }} />
              <h3>No orders found</h3>
              <p>You haven't placed any orders yet.</p>
              <Link to="/" className="btn btn-primary">Start Shopping</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {orderList.map((order) => (
                <Link key={order._id} to={`/orders/${order._id}`} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', transition: 'box-shadow 0.2s' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <img src={order.items?.[0]?.product?.images?.[0] || '/placeholder-glasses.png'} alt="" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Order #{order._id.slice(-8).toUpperCase()}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{order.items?.length || 0} item(s)</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>₹{order.total}</div>
                    <span className="badge" style={{ background: STATUS_COLORS[order.status] || 'var(--text-light)', color: '#fff', textTransform: 'capitalize' }}>{order.status}</span>
                  </div>
                  <FiChevronRight style={{ color: 'var(--text-light)' }} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default UserOrders;
