import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FiFileText, FiPackage, FiShoppingBag, FiHeadphones, FiSearch, FiCheckCircle } from 'react-icons/fi';

const th = { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 14, borderBottom: '1px solid var(--border-light)', verticalAlign: 'top' };

const VIEW_LABELS = {
  overview: ['Work Overview', 'What is waiting for you right now'],
  blogs: ['Blog Management', 'Draft and published content'],
  products: ['Product Management', 'Listings awaiting verification'],
  orders: ['Order Management', 'Dispatch and delivery queue'],
  returns: ['Support Tickets', 'Customer returns in progress']
};

export default function StaffWorkspace({ view = 'overview' }) {
  const { staff, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const identity = staff || user || {};

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let res;
        if (view === 'blogs') res = await api.get('/staff/blogs', { params: { search } });
        else if (view === 'products') res = await api.get('/staff/products', { params: { search, verification: statusFilter } });
        else if (view === 'orders') res = await api.get('/staff/orders', { params: { search, status: statusFilter } });
        else if (view === 'returns') res = await api.get('/staff/returns', { params: { search, status: statusFilter } });
        else res = await api.get('/staff/overview');

        if (!cancelled) setData(res.data);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          toast.error(err.response?.data?.message || 'Could not load your work queue');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [view, search, statusFilter]);

  const [heading, subtitle] = VIEW_LABELS[view] || VIEW_LABELS.overview;

  const rows = data
    ? (view === 'blogs' ? (data.blogs || [])
      : view === 'products' ? (data.products || [])
      : view === 'orders' ? (data.orders || [])
      : view === 'returns' ? (data.returns || [])
      : [])
    : [];

  return (
    <div style={{ padding: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{heading}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{subtitle}</p>
          {identity.name && (
            <p style={{ fontSize: 13, color: 'var(--text-light)', margin: '6px 0 0' }}>
              Signed in as {identity.name} {data?.role ? `- role: ${String(data.role).replace(/_/g, ' ')}` : ''}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <FiSearch size={15} style={{ position: 'absolute', left: 11, top: 13, color: 'var(--text-light)' }} />
            <input className="input" style={{ paddingLeft: 34, width: 260 }} placeholder="Search records..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {view !== 'overview' && view !== 'blogs' && (
            <select className="input" style={{ width: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {view === 'products' && ['pending', 'verified', 'data_incorrect'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              {view === 'orders' && ['pending', 'confirmed', 'packed', 'picked_up', 'in_transit', 'delivered', 'cancelled'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              {view === 'returns' && ['requested', 'approved', 'picked_up', 'received', 'completed', 'rejected'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 50, textAlign: 'center' }}><div className="spinner" /></div>
      ) : view === 'overview' ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {(data?.queues || []).map((q) => (
              <div key={q.key} className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{q.label}</div>
                <div style={{ fontSize: 30, fontWeight: 800 }}>{q.value}</div>
              </div>
            ))}
            {(!data?.queues || data.queues.length === 0) && (
              <div className="card" style={{ padding: 24, gridColumn: '1 / -1' }}>
                No metrics configured for this staff role.
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Your work areas</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link to="/staff/orders/manage" className="btn btn-outline" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><FiShoppingBag size={15} /> Orders</Link>
              <Link to="/staff/products/manage" className="btn btn-outline" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><FiPackage size={15} /> Products</Link>
              <Link to="/staff/blogs/manage" className="btn btn-outline" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><FiFileText size={15} /> Blogs</Link>
              <Link to="/staff/support/tickets" className="btn btn-outline" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><FiHeadphones size={15} /> Returns and tickets</Link>
            </div>
            {Array.isArray(data?.permissions) && data.permissions.length > 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 14, marginBottom: 0 }}>
                Permissions: {data.permissions.join(', ')}
              </p>
            )}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <FiCheckCircle size={34} style={{ marginBottom: 12, color: 'var(--success)' }} />
          <p style={{ margin: 0 }}>Nothing in this queue right now.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {view === 'blogs' && (<><th style={th}>Title</th><th style={th}>Category</th><th style={th}>Status</th><th style={th}>Views</th><th style={th}>Created</th></>)}
                {view === 'products' && (<><th style={th}>Product</th><th style={th}>Brand</th><th style={th}>Seller</th><th style={th}>Price</th><th style={th}>Verification</th></>)}
                {view === 'orders' && (<><th style={th}>Order</th><th style={th}>Customer</th><th style={th}>Seller</th><th style={th}>Status</th><th style={th}>Amount</th><th style={th}>Placed</th></>)}
                {view === 'returns' && (<><th style={th}>Return</th><th style={th}>Order</th><th style={th}>Reason</th><th style={th}>Status</th><th style={th}>Raised</th></>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  {view === 'blogs' && (<>
                    <td style={td}>{r.title}</td>
                    <td style={td}>{r.category || 'general'}</td>
                    <td style={td}>{r.isPublished ? 'Published' : 'Draft'}</td>
                    <td style={td}>{r.views || 0}</td>
                    <td style={td}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '-'}</td>
                  </>)}
                  {view === 'products' && (<>
                    <td style={td}>{r.title}</td>
                    <td style={td}>{r.brand || '-'}</td>
                    <td style={td}>{r.storeName || r.seller?.storeName || '-'}</td>
                    <td style={td}>Rs. {(r.discountedPrice || r.price || 0).toLocaleString('en-IN')}</td>
                    <td style={td}>{String(r.verificationStatus || 'pending').replace(/_/g, ' ')}</td>
                  </>)}
                  {view === 'orders' && (<>
                    <td style={{ ...td, fontWeight: 600 }}>{r.orderId || r._id}</td>
                    <td style={td}>{r.user?.name || '-'}<div style={{ fontSize: 12, color: 'var(--text-light)' }}>{r.user?.phone}</div></td>
                    <td style={td}>{r.seller?.storeName || '-'}</td>
                    <td style={td}>{String(r.orderStatus || '').replace(/_/g, ' ')}</td>
                    <td style={td}>Rs. {(r.totalAmount || 0).toLocaleString('en-IN')}</td>
                    <td style={td}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '-'}</td>
                  </>)}
                  {view === 'returns' && (<>
                    <td style={td}>{String(r._id).slice(-8)}</td>
                    <td style={td}>{r.order?.orderId || '-'}</td>
                    <td style={td}>{r.reason || '-'}</td>
                    <td style={td}>{r.status}</td>
                    <td style={td}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '-'}</td>
                  </>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.total !== undefined && rows.length > 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 14 }}>
          Showing {rows.length} of {data.total} records.
        </p>
      )}
    </div>
  );
}
