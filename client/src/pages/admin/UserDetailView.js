import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiUser, FiMail, FiPhone, FiCalendar, FiPackage, FiShoppingBag, FiDollarSign, FiMapPin, FiTrash2, FiShield, FiEye, FiEyeOff } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const UserDetailView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserDetails();
  }, [id]);

  const fetchUserDetails = async () => {
    try {
      const [userRes, ordersRes] = await Promise.all([
        adminApi.getUserById(id),
        adminApi.getUserOrders(id)
      ]);
      setUser(userRes.data.data);
      setOrders(ordersRes.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async (banType) => {
    const action = banType === 'ban' ? 'ban' : banType === 'shadow' ? 'shadow ban' : 'unban';
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;
    
    try {
      await adminApi.banUser(id, { 
        isBanned: banType === 'ban',
        isShadowBanned: banType === 'shadow',
        banReason: banType !== 'unban' ? 'Banned by admin' : ''
      });
      toast.success(`User ${action}ned successfully`);
      fetchUserDetails();
    } catch (err) {
      toast.error('Failed to update user status');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this user? This cannot be undone.')) return;
    try {
      await adminApi.deleteUser(id);
      toast.success('User deleted successfully');
      navigate('/admin/users');
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner spinner-lg" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1 }}>
          <div className="container page-wrapper" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <h2>User not found</h2>
            <button onClick={() => navigate('/admin/users')} className="btn btn-primary" style={{ marginTop: '20px' }}>
              Back to Users
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const totalSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const completedOrders = orders.filter(o => o.orderStatus === 'delivered').length;
  const cancelledOrders = orders.filter(o => o.orderStatus === 'cancelled').length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <button onClick={() => navigate('/admin/users')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--primary)', fontSize: '14px', fontWeight: 500, cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
            <FiArrowLeft /> Back to Users
          </button>

          {/* User Info Card */}
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700 }}>
                  {(user.name || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{user.name}</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>User ID: {user.userId || user._id}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!user.isBanned && !user.isShadowBanned && (
                  <>
                    <button onClick={() => handleBan('shadow')} className="btn btn-outline btn-sm" style={{ fontSize: '12px' }}>
                      <FiEyeOff size={14} /> Shadow Ban
                    </button>
                    <button onClick={() => handleBan('ban')} className="btn btn-danger btn-sm" style={{ fontSize: '12px' }}>
                      <FiShield size={14} /> Ban User
                    </button>
                  </>
                )}
                {(user.isBanned || user.isShadowBanned) && (
                  <button onClick={() => handleBan('unban')} className="btn btn-primary btn-sm" style={{ fontSize: '12px' }}>
                    <FiEye size={14} /> Unban User
                  </button>
                )}
                <button onClick={handleDelete} className="btn btn-danger btn-sm" style={{ fontSize: '12px' }}>
                  <FiTrash2 size={14} /> Delete
                </button>
              </div>
            </div>

            {user.isBanned && (
              <div style={{ background: '#ffebee', border: '1px solid #ef5350', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
                <p style={{ color: '#c62828', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>⚠️ User is Banned</p>
                <p style={{ color: '#c62828', fontSize: '12px' }}>Reason: {user.banReason || 'No reason provided'}</p>
                <p style={{ color: '#c62828', fontSize: '12px' }}>Banned on: {new Date(user.bannedAt).toLocaleDateString()}</p>
              </div>
            )}

            {user.isShadowBanned && !user.isBanned && (
              <div style={{ background: '#fff3e0', border: '1px solid #ff9800', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
                <p style={{ color: '#e65100', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>⚠️ User is Shadow Banned</p>
                <p style={{ color: '#e65100', fontSize: '12px' }}>User can still access the platform but with limited visibility</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Email</p>
                <p style={{ fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiMail size={14} /> {user.email}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Phone</p>
                <p style={{ fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiPhone size={14} /> {user.phone || 'Not provided'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Joined</p>
                <p style={{ fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiCalendar size={14} /> {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              {user.addresses && user.addresses.length > 0 && (
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Default Address</p>
                  <p style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FiMapPin size={14} /> {user.addresses[0].city}, {user.addresses[0].state}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Total Orders</p>
                  <p style={{ fontSize: '24px', fontWeight: 700 }}>{orders.length}</p>
                </div>
                <FiPackage size={32} style={{ color: 'var(--primary)', opacity: 0.3 }} />
              </div>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Total Spent</p>
                  <p style={{ fontSize: '24px', fontWeight: 700 }}>₹{totalSpent.toLocaleString()}</p>
                </div>
                <FiDollarSign size={32} style={{ color: 'var(--success)', opacity: 0.3 }} />
              </div>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Completed</p>
                  <p style={{ fontSize: '24px', fontWeight: 700 }}>{completedOrders}</p>
                </div>
                <FiShoppingBag size={32} style={{ color: 'var(--success)', opacity: 0.3 }} />
              </div>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Cancelled</p>
                  <p style={{ fontSize: '24px', fontWeight: 700 }}>{cancelledOrders}</p>
                </div>
                <FiTrash2 size={32} style={{ color: 'var(--danger)', opacity: 0.3 }} />
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Order History</h3>
            {orders.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>No orders found</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                      {['Order ID', 'Date', 'Items', 'Amount', 'Status', 'Payment'].map(h => (
                        <th key={h} style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: 500 }}>#{order.orderNumber || order._id.slice(-6)}</td>
                        <td style={{ padding: '12px', fontSize: '13px' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px', fontSize: '13px' }}>{order.items?.length || 0} items</td>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: 600 }}>₹{order.totalAmount?.toLocaleString()}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontSize: '11px', 
                            fontWeight: 600,
                            background: order.orderStatus === 'delivered' ? '#e8f5e9' : order.orderStatus === 'cancelled' ? '#ffebee' : '#fff3e0',
                            color: order.orderStatus === 'delivered' ? '#2e7d32' : order.orderStatus === 'cancelled' ? '#c62828' : '#e65100'
                          }}>
                            {order.orderStatus}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontSize: '11px', 
                            fontWeight: 600,
                            background: order.paymentStatus === 'completed' ? '#e8f5e9' : '#ffebee',
                            color: order.paymentStatus === 'completed' ? '#2e7d32' : '#c62828'
                          }}>
                            {order.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default UserDetailView;
