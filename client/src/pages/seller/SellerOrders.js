import React, { useState, useEffect } from 'react';
import { FiPackage, FiChevronRight } from 'react-icons/fi';
import { seller as sellerApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const STATUS_COLORS = { pending: '#ff9f00', confirmed: '#2874f0', shipped: '#2874f0', delivered: '#26a541', cancelled: '#ff6161' };
const STATUS_FLOW = ['pending', 'confirmed', 'shipped', 'delivered'];

const SellerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchOrders(); }, [filter]);

  const fetchOrders = async () => {
    try {
      const res = await sellerApi.getOrders({ status: filter !== 'all' ? filter : undefined });
      setOrders(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateStatus = async (orderId, newStatus) => {
    try {
      await sellerApi.updateOrderStatus(orderId, newStatus);
      toast.success(`Order marked as ${newStatus}`);
      fetchOrders();
    } catch (err) { toast.error('Failed to update status'); }
  };

  const getNextStatus = (current) => {
    const idx = STATUS_FLOW.indexOf(current);
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>Orders</h1>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((s) => (
              <button key={s} onClick={() => setFilter(s)} style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, border: `1px solid ${filter === s ? 'var(--primary)' : 'var(--border)'}`, background: filter === s ? 'var(--primary-light)' : '#fff', color: filter === s ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', textTransform: 'capitalize' }}>{s}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div>
          ) : orders.length === 0 ? (
            <div className="empty-state"><FiPackage style={{ fontSize: '64px', color: 'var(--text-light)', marginBottom: '16px' }} /><h3>No orders found</h3></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {orders.map((order) => {
                const next = getNextStatus(order.status);
                return (
                  <div key={order._id} className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span style={{ fontSize: '15px', fontWeight: 600 }}>#{order._id.slice(-8).toUpperCase()}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-light)', marginLeft: '12px' }}>{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700 }}>₹{order.total}</span>
                        <span className="badge" style={{ background: STATUS_COLORS[order.status], color: '#fff', textTransform: 'capitalize' }}>{order.status}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                      {order.items?.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                          <img src={item.product?.images?.[0] || '/placeholder-glasses.png'} alt="" style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '4px' }} />
                          <span style={{ flex: 1 }}>{item.product?.name}</span>
                          <span style={{ color: 'var(--text-light)' }}>x{item.quantity}</span>
                          <span style={{ fontWeight: 500 }}>₹{item.product?.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>{order.address?.fullName} - {order.address?.city}</span>
                      {next && (
                        <button onClick={() => updateStatus(order._id, next)} className="btn btn-primary btn-sm">Mark as {next}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SellerOrders;
