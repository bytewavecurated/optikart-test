import React, { useState, useEffect, useCallback } from 'react';
import { FiPackage, FiSearch, FiChevronLeft, FiChevronRight, FiTruck } from 'react-icons/fi';
import { seller as sellerApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';
import { listOf, paginationOf } from '../../services/apiResponse.js';
import { toastError } from '../../services/errors.js';
import { FILTER_STATUSES, STATUS_LABELS } from '../../utils/orderStatuses.js';
import BackButton from '../../components/BackButton';

/*
 * Allowed next states. This mirrors the transition table in
 * `server/routes/seller.js` exactly: offering a move the server would refuse is
 * worse than offering none, because the seller clicks it and gets an error.
 */
const NEXT_STATUSES = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered']
};

const STATUS_COLORS = {
  pending: 'var(--warning)', confirmed: 'var(--brand)', packed: 'var(--brand)',
  picked_up: 'var(--brand)', in_transit: 'var(--brand)', delivered: 'var(--success)',
  cancelled: 'var(--danger)', return_requested: 'var(--warning)', returned: 'var(--text-secondary)'
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const variantSummary = (item) => {
  const v = item.variant || {};
  const parts = [v.color, v.size, v.lensType, v.power ? `${v.power > 0 ? '+' : ''}${v.power}` : '']
    .filter(Boolean);
  return parts.join(' · ');
};

const SellerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [filter, setFilter] = useState('all');
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sellerApi.getOrders({
        status: filter !== 'all' ? filter : undefined,
        q: query || undefined,
        page: pageInfo.page,
        limit: 10
      });
      setOrders(listOf(res.data));
      setPageInfo({ ...pageInfo, ...(paginationOf(res.data) || {}) });
    } catch (error) {
      toastError(error, 'Could not load your orders');
    } finally {
      setLoading(false);
    }
    // pageInfo.page is read through the state below so changing page refetches.
  }, [filter, query, pageInfo.page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateStatus = async (order, next) => {
    setSaving(`${order._id}:${next}`);
    try {
      await sellerApi.updateOrderStatus(order._id, next);
      toast.success(next === 'cancelled' ? 'Order cancelled' : `Order marked ${STATUS_LABELS[next] || next}`);
      fetchOrders();
    } catch (error) {
      toastError(error, 'The server refused that status change');
    } finally {
      setSaving('');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <BackButton />
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>Orders</h1>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <form
              onSubmit={(e) => { e.preventDefault(); setPageInfo({ ...pageInfo, page: 1 }); setQuery(term.trim()); }}
              style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}
            >
              <FiSearch size={15} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-light)' }} />
              <input
                className="input"
                style={{ paddingLeft: 34 }}
                placeholder="Search order number, customer name, phone or pincode"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </form>
            {query && (
              <button
                className="btn btn-outline"
                onClick={() => { setTerm(''); setQuery(''); setPageInfo({ ...pageInfo, page: 1 }); }}
              >
                Clear search
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {FILTER_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { setFilter(s); setPageInfo({ ...pageInfo, page: 1 }); }}
                style={{
                  padding: '6px 16px', borderRadius: 'var(--radius-xl)', fontSize: '13px', fontWeight: 500,
                  border: `1px solid ${filter === s ? 'var(--primary)' : 'var(--border)'}`,
                  background: filter === s ? 'var(--primary-light)' : 'var(--bg-white)',
                  color: filter === s ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', textTransform: 'capitalize'
                }}
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s] || s}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
              {pageInfo.total ? `${pageInfo.total} order${pageInfo.total === 1 ? '' : 's'}` : ''}
            </span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <FiPackage style={{ fontSize: '56px', color: 'var(--text-light)', marginBottom: '16px' }} />
              <h3>{query ? 'No orders match that search' : 'No orders found'}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                {query ? 'Check the order number or the customer phone number.' : 'Orders placed on your store appear here.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {orders.map((order) => {
                const status = order.orderStatus || order.status;
                const nextOptions = NEXT_STATUSES[status] || [];
                const cod = order.paymentMethod === 'cod';
                const paidUpfront = !cod && order.paymentStatus === 'paid';
                const lines = order.items || [];
                return (
                  <div key={order._id} className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700 }}>{order.orderNumber || `#${String(order._id).slice(-8).toUpperCase()}`}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                          {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span
                          style={{
                            fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
                            color: STATUS_COLORS[status] || 'var(--text-secondary)', border: `1px solid ${STATUS_COLORS[status] || 'var(--border)'}`,
                            borderRadius: 4, padding: '2px 8px'
                          }}
                        >
                          {STATUS_LABELS[status] || String(status).replace(/_/g, ' ')}
                        </span>
                        {order.deliveryAssignmentMode === 'self' && (
                          <span className="chip" style={{ fontSize: 11.5 }}><FiTruck size={12} /> {order.assignedDeliveryPartner ? 'Partner pickup' : 'Awaiting partner'}</span>
                        )}
                        {order.deliveryAssignmentMode === 'shiprocket' && (
                          <span className="chip" style={{ fontSize: 11.5 }}>Courier: Shiprocket</span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700 }}>{money(order.totalAmount)}</div>
                        <div style={{ fontSize: 12, color: cod ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                          {cod ? `Collect ${money(order.totalAmount)} on delivery` : paidUpfront ? 'Paid online' : 'Payment pending'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                      {lines.map((item, idx) => {
                        const product = item.product || {};
                        const lineTotal = Number(item.price ?? product.price ?? 0) * Number(item.quantity || 1);
                        const variant = variantSummary(item);
                        return (
                          <div key={item._id || idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                            <img src={product.images?.[0] || '/placeholder.svg'} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: 'var(--radius-xs)', background: 'var(--bg-secondary)' }} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              {product.title || product.name || item.name || 'Product'}
                              {variant && <span style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}> — {variant}</span>}
                            </span>
                            <span style={{ color: 'var(--text-light)' }}>×{item.quantity}</span>
                            <span style={{ fontWeight: 500, minWidth: 78, textAlign: 'right' }}>{money(lineTotal)}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                          {order.shippingAddress?.name || order.user?.name || 'Customer'}
                          {(order.shippingAddress?.phone || order.user?.phone) && (
                            <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · {order.shippingAddress?.phone || order.user?.phone}</span>
                          )}
                        </div>
                        <div>
                          {[order.shippingAddress?.street, order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', ') || 'Address unavailable'}
                          {order.shippingAddress?.pincode ? ` - ${order.shippingAddress.pincode}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {nextOptions.map((next) => (
                          <button
                            key={next}
                            onClick={() => updateStatus(order, next)}
                            disabled={saving === `${order._id}:${next}`}
                            className={next === 'cancelled' ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'}
                            style={next === 'cancelled' ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : undefined}
                          >
                            {saving === `${order._id}:${next}`
                              ? 'Working…'
                              : next === 'cancelled' ? 'Cancel order' : `Mark as ${STATUS_LABELS[next] || next.replace(/_/g, ' ')}`}
                          </button>
                        ))}
                        {nextOptions.length === 0 && status !== 'delivered' && status !== 'cancelled' && status !== 'returned' && status !== 'return_requested' && (
                          <span style={{ fontSize: 12.5, color: 'var(--text-light)' }}>Waiting for the courier partner</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pageInfo.pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
              <button
                className="btn btn-outline btn-sm"
                disabled={pageInfo.page <= 1}
                onClick={() => setPageInfo({ ...pageInfo, page: pageInfo.page - 1 })}
              >
                <FiChevronLeft size={14} /> Previous
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Page {pageInfo.page} of {pageInfo.pages}</span>
              <button
                className="btn btn-outline btn-sm"
                disabled={pageInfo.page >= pageInfo.pages}
                onClick={() => setPageInfo({ ...pageInfo, page: pageInfo.page + 1 })}
              >
                Next <FiChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SellerOrders;
