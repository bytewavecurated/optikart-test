import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiPackage, FiTruck, FiCheck, FiMapPin, FiCreditCard, FiArrowLeft, FiRefreshCw, FiHome, FiBox, FiX } from 'react-icons/fi';
import { orders } from '../services/api';
import { oneOf } from '../services/apiResponse.js';
import { toastError } from '../services/errors.js';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

// The lifecycle the platform actually records on an Order.
const FLOW = [
  { key: 'pending', label: 'Order placed', icon: <FiPackage size={14} /> },
  { key: 'confirmed', label: 'Confirmed', icon: <FiCheck size={14} /> },
  { key: 'packed', label: 'Packed', icon: <FiBox size={14} /> },
  { key: 'picked_up', label: 'Picked up', icon: <FiTruck size={14} /> },
  { key: 'in_transit', label: 'In transit', icon: <FiMapPin size={14} /> },
  { key: 'delivered', label: 'Delivered', icon: <FiHome size={14} /> }
];

const READABLE = {
  pending: 'Pending', confirmed: 'Confirmed', packed: 'Packed', picked_up: 'Picked up',
  in_transit: 'In transit', delivered: 'Delivered', cancelled: 'Cancelled',
  return_requested: 'Return requested', returned: 'Returned'
};

const money = (n) => Number(n || 0).toLocaleString('en-IN');

const Row = ({ label, value, strong }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: strong ? 15 : 13.5, fontWeight: strong ? 700 : 400, borderBottom: strong ? 'none' : '1px solid var(--border-light)' }}>
    <span style={{ color: strong ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</span>
    <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
  </div>
);

const Card = ({ title, icon, children, style }) => (
  <div className="card-flat" style={{ padding: 20, ...style }}>
    {title && (
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--brand)' }}>{icon}</span>{title}
      </h2>
    )}
    {children}
  </div>
);

const OrderDetail = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchOrder = async () => {
      try {
        const res = await orders.getById(id);
        if (!cancelled) setOrder(oneOf(res.data, 'order'));
      } catch (err) {
        if (!cancelled) toastError(err, 'Failed to load order');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchOrder();
    return () => { cancelled = true; };
  }, [id]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await orders.cancel(id, 'No longer needed');
      toast.success('Order cancelled');
      setOrder((o) => ({ ...o, orderStatus: 'cancelled' }));
    } catch (err) {
      toastError(err, 'Could not cancel this order');
    } finally {
      setCancelling(false);
    }
  };

  const reorder = () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to add these items again');
      return;
    }
    let added = 0;
    (order.items || []).forEach((it) => {
      const p = it.product;
      if (p && p.isActive !== false && (p.stock || 0) >= (it.quantity || 1)) {
        if (addToCart(p, it.variant || null, it.quantity || 1)) added += 1;
      }
    });
    if (added) { toast.success(`${added} item${added > 1 ? 's' : ''} added to cart`); }
    else { toast.error('These items are no longer available'); }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container page-wrapper" style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner spinner-lg" />
        </div>
        <Footer />
      </>
    );
  }

  if (!order) {
    return (
      <>
        <Header />
        <div className="container page-wrapper">
          <div className="card-flat" style={{ padding: 48, textAlign: 'center' }}>
            <h2 style={{ marginTop: 0 }}>Order not found</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>This order does not exist or is not on your account.</p>
            <Link to="/orders" className="btn btn-primary">Back to orders</Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const status = order.orderStatus || 'pending';
  const terminal = ['cancelled', 'returned'].includes(status);
  const currentIndex = FLOW.findIndex((f) => f.key === status);
  const addr = order.shippingAddress || {};
  const paidUpfront = order.paymentStatus === 'completed';
  const canCancel = !terminal && ['pending', 'confirmed'].includes(status);
  const canReturn = status === 'delivered';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <Header />
      <main className="container" style={{ flex: 1, padding: '20px 20px 48px', maxWidth: 1100 }}>
        <Link to="/orders" className="btn btn-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 14 }}>
          <FiArrowLeft size={15} /> All orders
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Order {order.orderNumber || order._id}</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              Placed {order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
            </p>
          </div>
          <span className={`badge badge-soft-${terminal ? 'danger' : status === 'delivered' ? 'success' : 'neutral'}`} style={{ padding: '6px 12px', fontWeight: 700 }}>
            {READABLE[status] || status}
          </span>
        </div>

        {!terminal && (
          <Card title="Tracking" icon={<FiTruck size={16} />} style={{ marginBottom: 16 }}>
            <ol className="rail" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: 8, overflowX: 'auto' }}>
              {FLOW.map((f, i) => {
                const done = !terminal && currentIndex > i;
                const current = currentIndex === i;
                return (
                  <li key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 'max-content' }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: '50%', display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: done ? 'var(--success)' : current ? 'var(--brand)' : 'var(--bg-subtle)',
                      color: done || current ? '#fff' : 'var(--text-light)'
                    }}>
                      {done ? <FiCheck size={14} /> : f.icon}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: current ? 700 : 500, color: done || current ? 'var(--text-primary)' : 'var(--text-light)' }}>
                      {f.label}
                    </span>
                    {i < FLOW.length - 1 && <span style={{ width: 22, height: 1, background: 'var(--border)' }} />}
                  </li>
                );
              })}
            </ol>

            {(order.deliveryJourney || []).length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                <p className="eyebrow" style={{ margin: '0 0 8px' }}>Delivery journey</p>
                {order.deliveryJourney.map((j, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '4px 0', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{READABLE[j.status] || j.status}</span>
                    <span>{j.at ? new Date(j.at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}{j.note ? ` - ${j.note}` : ''}</span>
                  </div>
                ))}
              </div>
            )}

            {order.shiprocketTrackingUrl && (
              <a href={order.shiprocketTrackingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-quiet" style={{ marginTop: 14, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <FiMapPin size={15} /> Track shipment {order.shiprocketTrackingId ? `(${order.shiprocketTrackingId})` : ''}
              </a>
            )}
          </Card>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 330px', gap: 16, alignItems: 'start' }} className="order-detail-grid">
          <div>
            <Card title={`Items (${(order.items || []).length})`} icon={<FiPackage size={16} />} style={{ marginBottom: 16 }}>
              {(order.items || []).map((it, i) => {
                const p = it.product || {};
                return (
                  <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: i < (order.items.length - 1) ? '1px solid var(--border-light)' : 'none' }}>
                    <img
                      src={(p.images && p.images[0]) || '/assets/face-1.svg'}
                      alt={it.name || p.title || ''}
                      style={{ width: 72, height: 72, objectFit: 'contain', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link to={p._id ? `/product/${p._id}` : '#'} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {it.name || p.title || 'Item'}
                      </Link>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {p.brand ? `${p.brand} - ` : ''}Qty {it.quantity}
                        {it.variant && (it.variant.color || it.variant.size) ? ` - ${[it.variant.color, it.variant.size].filter(Boolean).join(', ')}` : ''}
                      </div>
                      {it.lensConfig && (
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, background: 'var(--bg-subtle)', borderRadius: 6, padding: '6px 8px' }}>
                          <strong style={{ fontWeight: 700 }}>Lens:</strong> {[it.lensConfig.lensType, it.lensConfig.lensPackage, it.lensConfig.coating].filter(Boolean).join(' / ') || 'custom'}
                          {it.lensConfig.power?.sphereRight ? ` - OD ${it.lensConfig.power.sphereRight}` : ''}
                          {it.lensConfig.power?.sphereLeft ? ` / OS ${it.lensConfig.power.sphereLeft}` : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>Rs. {money((it.price || 0) * (it.quantity || 1))}</div>
                  </div>
                );
              })}
            </Card>

            <Card title="Payment summary" icon={<FiCreditCard size={16} />}>
              <Row label="Item total" value={`Rs. ${money(order.subtotal)}`} />
              {order.couponDiscount > 0 && <Row label={`Coupon${order.couponApplied ? ` (${order.couponApplied})` : ''}`} value={`- Rs. ${money(order.couponDiscount)}`} />}
              <Row label={paidUpfront ? 'Delivery' : 'Delivery (payable on order)'} value={order.deliveryCharge ? `Rs. ${money(order.deliveryCharge)}` : 'Free'} />
              <Row label="Platform fee" value={`Rs. ${money(order.platformFee)}`} />
              <Row label="Paid via" value={order.paymentMethod === 'cod' ? 'Cash on delivery' : paidUpfront ? 'Prepaid' : 'Awaiting payment'} />
              <Row label="Order total" value={`Rs. ${money(order.totalAmount)}`} strong />
            </Card>
          </div>

          <div>
            <Card title="Delivery to" icon={<FiMapPin size={16} />} style={{ marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{addr.name || addr.fullName || '-'}</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {[addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
              </p>
              {addr.phone && <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{addr.phone}</p>}
              {order.deliveryDate && (
                <p style={{ margin: '10px 0 0', fontSize: 13 }}>
                  Delivered {new Date(order.deliveryDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                </p>
              )}
            </Card>

            {order.seller && (
              <Card title="Sold by" icon={<FiBox size={16} />} style={{ marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{order.seller.storeName || order.seller.name || '-'}</p>
                {order.seller.sellerId && (
                  <Link to={`/products?sellerCode=${encodeURIComponent(order.seller.sellerId)}`} style={{ fontSize: 13, color: 'var(--brand)', display: 'inline-block', marginTop: 6 }}>
                    View store
                  </Link>
                )}
              </Card>
            )}

            <div style={{ display: 'grid', gap: 8 }}>
              <button className="btn btn-quiet" onClick={reorder} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                <FiRefreshCw size={15} /> Buy these again
              </button>
              {canReturn && (
                <Link to={`/orders/${order._id}/return`} className="btn btn-outline" style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <FiRefreshCw size={15} /> Return or exchange
                </Link>
              )}
              {canCancel && (
                <button
                  className="btn btn-outline"
                  onClick={handleCancel}
                  disabled={cancelling}
                  style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                >
                  <FiX size={15} /> {cancelling ? 'Cancelling...' : 'Cancel order'}
                </button>
              )}
              {order.cancellationReason && (
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0 }}>Reason: {order.cancellationReason}</p>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 900px) {
          .order-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default OrderDetail;

