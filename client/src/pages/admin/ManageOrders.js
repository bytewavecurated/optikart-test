import React, { useState, useEffect } from 'react';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const STATUS_COLORS = { pending: '#ff9f00', confirmed: '#2874f0', shipped: '#2874f0', delivered: '#26a541', cancelled: '#ff6161', returned: '#878787' };

const ManageOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchOrders(); }, [filter]);
  const fetchOrders = async () => {
    try { const res = await adminApi.getOrders({ status: filter !== 'all' ? filter : undefined }); setOrders(res.data.data || []); } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>All Orders ({orders.length})</h1>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((s) => (
              <button key={s} onClick={() => setFilter(s)} style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '13px', border: `1px solid ${filter === s ? 'var(--primary)' : 'var(--border)'}`, background: filter === s ? 'var(--primary-light)' : '#fff', color: filter === s ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', textTransform: 'capitalize' }}>{s}</button>
            ))}
          </div>
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div> : orders.length === 0 ? <div className="empty-state"><h3>No orders found</h3></div> : (
            <div className="card">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>{['Order ID', 'Customer', 'Items', 'Total', 'Status', 'Date'].map((h) => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>#{order._id.slice(-8).toUpperCase()}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{order.address?.fullName || order.user?.name || '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{order.items?.length || 0}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600 }}>₹{order.total}</td>
                      <td style={{ padding: '12px 16px' }}><span className="badge" style={{ background: STATUS_COLORS[order.status], color: '#fff', textTransform: 'capitalize' }}>{order.status}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-light)' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
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

export default ManageOrders;
