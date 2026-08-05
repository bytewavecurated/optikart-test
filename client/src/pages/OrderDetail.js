import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiPackage, FiTruck, FiCheck, FiX, FiMapPin, FiCreditCard } from 'react-icons/fi';
import { orders } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

const STATUS_STEPS = ['pending', 'confirmed', 'shipped', 'delivered'];
const STATUS_COLORS = { pending: '#ff9f00', confirmed: '#2874f0', shipped: '#2874f0', delivered: '#26a541', cancelled: '#ff6161', returned: '#878787' };

const OrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await orders.getById(id);
        setOrder(res.data.data);
      } catch (err) {
        toast.error('Failed to load order');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const handleCancel = async () => {
    try {
      await orders.cancel(id, cancelReason);
      toast.success('Order cancelled');
      setOrder({ ...order, status: 'cancelled' });
      setShowCancel(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel order');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main className="container page-wrapper" style={{ display: 'flex', justifyContent: 'center' }}><div className="spinner spinner-lg" /></main>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main className="container page-wrapper">
          <div className="empty-state"><h3>Order not found</h3><Link to="/orders" className="btn btn-primary">Back to Orders</Link></div>
        </main>
        <Footer />
      </div>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(order.status);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <Link to="/orders" style={{ fontSize: '14px', color: 'var(--primary)', marginBottom: '16px', display: 'inline-block' }}>Back to Orders</Link>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '16px', alignItems: 'start' }} className="order-detail-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Order #{order._id.slice(-8).toUpperCase()}</h2>
                  <span className="badge" style={{ background: STATUS_COLORS[order.status], color: '#fff', fontSize: '13px', padding: '4px 12px', textTransform: 'capitalize' }}>{order.status}</span>
                </div>

                {order.status !== 'cancelled' && order.status !== 'returned' && (
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', padding: '16px 0' }}>
                    {STATUS_STEPS.map((step, idx) => (
                      <React.Fragment key={step}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '60px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: idx <= currentStep ? 'var(--primary)' : 'var(--border)', color: idx <= currentStep ? '#fff' : 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                            {idx < currentStep ? <FiCheck size={14} /> : idx + 1}
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: idx === currentStep ? 600 : 400, color: idx <= currentStep ? 'var(--primary)' : 'var(--text-light)', textTransform: 'capitalize' }}>{step}</span>
                        </div>
                        {idx < STATUS_STEPS.length - 1 && <div style={{ flex: 1, height: '2px', background: idx < currentStep ? 'var(--primary)' : 'var(--border)', margin: '0 4px', marginBottom: '20px' }} />}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {order.items?.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
                    <img src={item.product?.images?.[0] || '/placeholder-glasses.png'} alt="" style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '4px', border: '1px solid var(--border-light)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500 }}>{item.product?.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>{item.product?.brand}</div>
                      {item.variant && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{item.variant.label || `Power: ${item.variant.power}`}</div>}
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Qty: {item.quantity}</div>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>₹{item.product?.price * item.quantity}</div>
                  </div>
                ))}
              </div>

              {(order.status === 'delivered' || order.status === 'confirmed') && !showCancel && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  {order.status === 'delivered' && <button className="btn btn-outline btn-sm" onClick={() => toast.success('Return request submitted')}>Return / Exchange</button>}
                  {order.status === 'confirmed' && (
                    <button className="btn btn-danger btn-sm" onClick={() => setShowCancel(true)}>Cancel Order</button>
                  )}
                </div>
              )}

              {showCancel && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Reason for cancellation</h4>
                  <textarea className="input" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Tell us why you want to cancel" />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={handleCancel} className="btn btn-danger btn-sm">Confirm Cancel</button>
                    <button onClick={() => setShowCancel(false)} className="btn btn-outline btn-sm">Go Back</button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><FiMapPin size={16} /> Delivery Address</h3>
                <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 500 }}>{order.address?.fullName}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{order.address?.addressLine}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{order.address?.city}, {order.address?.state} - {order.address?.pincode}</div>
                  <div style={{ color: 'var(--text-light)', marginTop: '4px' }}>Phone: {order.address?.phone}</div>
                </div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><FiCreditCard size={16} /> Payment</h3>
                <div style={{ fontSize: '14px' }}>
                  <div style={{ textTransform: 'capitalize' }}>{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</div>
                  <div style={{ color: order.paymentStatus === 'paid' ? 'var(--success)' : 'var(--warning)', fontWeight: 500, marginTop: '4px' }}>{order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}</div>
                </div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Price Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Item Total</span><span>₹{order.subtotal}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Delivery</span><span>₹{order.deliveryCharges}</span></div>
                  {order.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}><span>Discount</span><span>-₹{order.discount}</span></div>}
                  <div className="divider" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '16px' }}><span>Total</span><span>₹{order.total}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`@media (max-width: 768px) { .order-detail-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
};

export default OrderDetail;
