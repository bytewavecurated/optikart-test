import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { executive as executiveApi } from '../../services/api';
import { listOf } from '../../services/apiResponse';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { FiTruck, FiArrowLeft, FiMapPin, FiClock, FiPackage } from 'react-icons/fi';

const th = { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 14, borderBottom: '1px solid var(--border-light)', verticalAlign: 'top' };

const STATUS_LABELS = {
  pending: 'Pending', confirmed: 'Confirmed', packed: 'Packed',
  picked_up: 'Picked up', in_transit: 'In transit', delivered: 'Delivered',
  cancelled: 'Cancelled', return_requested: 'Return requested', returned: 'Returned'
};

const title = (t, sub) => (
  <div style={{ marginBottom: 20 }}>
    <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{t}</h1>
    <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{sub}</p>
  </div>
);

function DeliveriesView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    executiveApi.getAssignedDeliveries()
      .then((res) => setRows(listOf(res.data)))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => {
    if (status && r.orderStatus !== status) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return [r.orderId, r.customer?.name, r.customer?.email, r.seller?.storeName, r.deliveryPartner?.name]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search order, customer, seller or partner"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input" style={{ maxWidth: 220 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_LABELS).map((k) => <option key={k} value={k}>{STATUS_LABELS[k]}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading deliveries...</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>No deliveries match this view.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Order</th><th style={th}>Customer</th><th style={th}>Seller / pickup</th>
              <th style={th}>Items</th><th style={th}>Partner</th><th style={th}>Status</th><th style={th}>Amount</th>
            </tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r._id}>
                  <td style={td}>
                    <Link to={`/executive/delivery/${r._id}`} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                      {r.orderId || r._id}
                    </Link>
                  </td>
                  <td style={td}>
                    <div>{r.customer?.name || 'N/A'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{r.customer?.phone} {r.customer?.email ? `· ${r.customer.email}` : ''}</div>
                  </td>
                  <td style={td}>
                    <div>{r.seller?.storeName || 'N/A'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{r.seller?.address || r.seller?.city || ''}</div>
                  </td>
                  <td style={td}>{(r.items || []).map((i) => `${i.name} x${i.quantity}`).join(', ') || '-'}</td>
                  <td style={td}>
                    {r.deliveryPartner ? `${r.deliveryPartner.name} (${r.deliveryPartner.phone})` : (r.trackingId ? `Shiprocket ${r.trackingId}` : 'Not assigned')}
                  </td>
                  <td style={td}>{STATUS_LABELS[r.orderStatus] || r.orderStatus}</td>
                  <td style={td}>Rs. {(r.totalAmount || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function CustomersView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    executiveApi.getCustomers()
      .then((res) => setRows(listOf(res.data)))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) =>
    !query || [r.name, r.email, r.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(query.toLowerCase())));

  return (
    <>
      <input className="input" style={{ maxWidth: 340, marginBottom: 18 }} placeholder="Search customers"
        value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? <p style={{ padding: 40, textAlign: 'center' }}>Loading customers...</p>
          : filtered.length === 0 ? <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>No customers on your assigned orders yet.</p>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Name</th><th style={th}>Phone</th><th style={th}>Email</th><th style={th}>Orders</th><th style={th}>Spent</th><th style={th}>Last order</th></tr></thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c._id}>
                    <td style={td}>{c.name}</td><td style={td}>{c.phone || '-'}</td><td style={td}>{c.email || '-'}</td>
                    <td style={td}>{c.orders}</td><td style={td}>Rs. {Math.round(c.spent).toLocaleString('en-IN')}</td>
                    <td style={td}>{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('en-IN') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </>
  );
}

function ReportsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    executiveApi.getReports()
      .then((res) => setData(res.data.data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>Loading reports...</p>;
  if (!data || !data.totals || data.totals.orders === 0) {
    return <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
      No completed work to report on yet. Reports appear once orders are assigned to you.
    </div>;
  }

  const totalUnits = data.totals.orders;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Orders handled', value: totalUnits },
          { label: 'Revenue', value: `Rs. ${Math.round(data.totals.revenue).toLocaleString('en-IN')}` },
          { label: 'Delivery fees', value: `Rs. ${Math.round(data.totals.deliveryFees).toLocaleString('en-IN')}` },
          { label: 'Distance covered', value: `${data.totals.distanceKm} km` }
        ].map((c) => (
          <div key={c.label} className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Status</th><th style={th}>Orders</th><th style={th}>Value</th></tr></thead>
          <tbody>
            {data.byStatus.map((s) => (
              <tr key={s.status}><td style={td}>{STATUS_LABELS[s.status] || s.status}</td><td style={td}>{s.count}</td><td style={td}>Rs. {Math.round(s.amount).toLocaleString('en-IN')}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Date</th><th style={th}>Orders</th><th style={th}>Value</th></tr></thead>
          <tbody>
            {data.daily.map((d) => (
              <tr key={d.date}><td style={td}>{d.date}</td><td style={td}>{d.count}</td><td style={td}>Rs. {Math.round(d.amount).toLocaleString('en-IN')}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DetailView() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    executiveApi.getDeliveryDetails(id)
      .then((res) => setOrder(res.data.data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>Loading delivery...</p>;
  if (!order) return <div className="card" style={{ padding: 48, textAlign: 'center' }}>This delivery could not be found.</div>;

  const journey = order.deliveryJourney || [];

  return (
    <>
      <Link to="/executive/deliveries" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600, marginBottom: 16 }}>
        <FiArrowLeft size={16} /> Back to deliveries
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 20px' }}>Order {order.orderId || order._id}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Customer</h3>
          <p style={{ margin: '0 0 6px' }}>{order.customer?.name}</p>
          <p style={{ margin: '0 0 6px', color: 'var(--text-secondary)' }}>{order.customer?.phone} · {order.customer?.email}</p>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
            {[order.shippingAddress?.street, order.shippingAddress?.city, order.shippingAddress?.pincode].filter(Boolean).join(', ')}
          </p>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Source & partner</h3>
          <p style={{ margin: '0 0 6px' }}><FiTruck size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{order.seller?.storeName || 'Seller not set'}</p>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {order.deliveryPartner ? `${order.deliveryPartner.name} · ${order.deliveryPartner.phone}` : 'No partner assigned'}
          </p>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Items</h3>
          {(order.items || []).map((it, i) => (
            <div key={i} style={{ marginBottom: 8, fontSize: 14 }}>
              <div>{it.name} × {it.quantity}</div>
              {it.lensConfig && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Lens: {it.lensConfig.lensType} {it.lensConfig.lensPackage ? `/ ${it.lensConfig.lensPackage}` : ''}
                  {it.lensConfig.power?.sphereRight ? ` · OD ${it.lensConfig.power.sphereRight}` : ''}
                  {it.lensConfig.power?.sphereLeft ? ` / OS ${it.lensConfig.power.sphereLeft}` : ''}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Locations</h3>
          <p style={{ margin: '0 0 8px', fontSize: 13 }}>
            <FiMapPin size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Pickup: {order.pickupLocation?.address || 'Seller store'}
          </p>
          <p style={{ margin: 0, fontSize: 13 }}>
            <FiMapPin size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Drop: {[order.shippingAddress?.street, order.shippingAddress?.city, order.shippingAddress?.pincode].filter(Boolean).join(', ')}
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginTop: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}><FiClock size={15} style={{ verticalAlign: 'middle', marginRight: 8 }} />Delivery journey</h3>
        {journey.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No status updates recorded yet. Current status: {STATUS_LABELS[order.orderStatus] || order.orderStatus}</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {journey.map((j, i) => (
              <li key={i} style={{ marginBottom: 8, fontSize: 14 }}>
                {STATUS_LABELS[j.status] || j.status}
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{j.note} · {new Date(j.at).toLocaleString('en-IN')}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

export default function ExecutiveSection({ section = 'deliveries' }) {
  const headings = {
    deliveries: ['Deliveries', 'Every order you are responsible for delivering'],
    customers: ['Customers', 'Buyers on the orders assigned to you'],
    reports: ['Reports', 'Volume, value and status breakdown of your work'],
    detail: ['Delivery detail', 'Complete journey of a single delivery']
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <Header />
      <main className="container" style={{ flex: 1, maxWidth: 1400 }}>
        <div style={{ display: 'flex', gap: 8, margin: '20px 0' }}>
          <Link to="/executive/dashboard" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FiPackage size={15} /> Dashboard
          </Link>
          <Link to="/executive/deliveries" className={`btn ${section === 'deliveries' ? 'btn-primary' : 'btn-outline'}`}>Deliveries</Link>
          <Link to="/executive/customers" className={`btn ${section === 'customers' ? 'btn-primary' : 'btn-outline'}`}>Customers</Link>
          <Link to="/executive/reports" className={`btn ${section === 'reports' ? 'btn-primary' : 'btn-outline'}`}>Reports</Link>
        </div>

        {title(...(headings[section] || headings.deliveries))}

        {section === 'deliveries' && <DeliveriesView />}
        {section === 'customers' && <CustomersView />}
        {section === 'reports' && <ReportsView />}
        {section === 'detail' && <DetailView />}
      </main>
      <Footer />
    </div>
  );
}
