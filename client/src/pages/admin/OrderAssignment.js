import React, { useState, useEffect } from 'react';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';
import { FiMapPin, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi';

const OrderAssignment = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getOrders({ assignmentStatus: filter, limit: 100 });
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'var(--warning)',
      pending_acceptance: 'var(--primary)',
      accepted: 'var(--success)',
      rejected: 'var(--danger)',
      admin_required: 'var(--danger)',
      assigned: 'var(--primary)'
    };
    return colors[status] || 'var(--text-secondary)';
  };

  const getTimeRemaining = (deadline) => {
    if (!deadline) return null;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate - now;
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container page-wrapper">
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Loading orders...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container page-wrapper">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Order Assignment</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage order assignments and track seller acceptance</p>
        </div>

        {/* Filter Tabs */}
        <div className="card" style={{ padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {['pending', 'pending_acceptance', 'admin_required', 'accepted'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`btn ${filter === status ? 'btn-primary' : 'btn-outline'}`}
                style={{ textTransform: 'capitalize' }}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No orders with status: {filter}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {orders.map((order) => (
              <div key={order._id} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
                      Order #{order.orderNumber}
                    </h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
                      ₹{order.totalAmount?.toLocaleString()}
                    </div>
                    <span 
                      className="badge" 
                      style={{ 
                        background: getStatusColor(order.assignmentStatus),
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        textTransform: 'capitalize'
                      }}
                    >
                      {order.assignmentStatus?.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Order Details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Customer</div>
                    <div style={{ fontWeight: 600 }}>{order.user?.name || 'N/A'}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{order.user?.email}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Assigned Seller</div>
                    <div style={{ fontWeight: 600 }}>{order.seller?.storeName || 'Not assigned'}</div>
                    {order.seller && (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{order.seller.email}</div>
                    )}
                  </div>
                  {order.assignmentDistance && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Distance</div>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiMapPin size={14} />
                        {order.assignmentDistance} km
                      </div>
                    </div>
                  )}
                  {order.assignmentDeadline && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Deadline</div>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', color: getStatusColor(order.assignmentStatus) }}>
                        <FiClock size={14} />
                        {getTimeRemaining(order.assignmentDeadline)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Items ({order.items?.length || 0})</div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {order.items?.slice(0, 3).map((item, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                        {item.product?.images?.[0] && (
                          <img 
                            src={item.product.images[0]} 
                            alt={item.product?.title}
                            style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                          />
                        )}
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.product?.title || 'Product'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Qty: {item.quantity}</div>
                        </div>
                      </div>
                    ))}
                    {order.items?.length > 3 && (
                      <div style={{ display: 'flex', alignItems: 'center', padding: '8px', color: 'var(--text-secondary)' }}>
                        +{order.items.length - 3} more
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {order.assignmentNotes && (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: '3px solid var(--warning)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Notes</div>
                    <div style={{ fontSize: '13px' }}>{order.assignmentNotes}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default OrderAssignment;
