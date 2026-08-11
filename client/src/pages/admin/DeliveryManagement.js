import React, { useState, useEffect } from 'react';
import { FiTruck, FiPackage, FiSearch } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const STATUS_COLORS = { pending: '#ff9f00', picked: '#2874f0', in_transit: '#2874f0', delivered: '#26a541', failed: '#ff6161' };

const DeliveryManagement = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('deliveries');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const [delRes, pickRes] = await Promise.allSettled([adminApi.getDelivery(), adminApi.getPickups()]);
        if (delRes.status === 'fulfilled') setDeliveries(delRes.value.data.data || []);
        if (pickRes.status === 'fulfilled') setPickups(pickRes.value.data.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  // Filter function for search
  const filterBySearch = (items, searchFields) => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      searchFields.some(field => {
        const value = item[field];
        if (!value) return false;
        if (typeof value === 'string') return value.toLowerCase().includes(query);
        if (typeof value === 'object') {
          // Handle nested objects like address, customer, seller
          return Object.values(value).some(val => 
            val && typeof val === 'string' && val.toLowerCase().includes(query)
          );
        }
        return false;
      })
    );
  };

  const filteredDeliveries = filterBySearch(deliveries, ['orderId', 'customerName', 'status']);
  const filteredPickups = filterBySearch(pickups, ['orderId', 'seller.businessName', 'status']);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>Delivery Management</h1>
          
          {/* Search Bar */}
          <div style={{ position: 'relative', maxWidth: '500px', marginBottom: '20px' }}>
            <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input 
              type="text"
              placeholder="Search by order ID, customer name, seller name, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              style={{ paddingLeft: '38px', width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button onClick={() => setTab('deliveries')} style={{ padding: '8px 20px', borderRadius: '4px', fontSize: '14px', fontWeight: 500, background: tab === 'deliveries' ? 'var(--primary)' : '#fff', color: tab === 'deliveries' ? '#fff' : 'var(--text-secondary)', border: `1px solid ${tab === 'deliveries' ? 'var(--primary)' : 'var(--border)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><FiTruck size={14} /> Deliveries ({filteredDeliveries.length})</button>
            <button onClick={() => setTab('pickups')} style={{ padding: '8px 20px', borderRadius: '4px', fontSize: '14px', fontWeight: 500, background: tab === 'pickups' ? 'var(--primary)' : '#fff', color: tab === 'pickups' ? '#fff' : 'var(--text-secondary)', border: `1px solid ${tab === 'pickups' ? 'var(--primary)' : 'var(--border)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><FiPackage size={14} /> Pickups ({filteredPickups.length})</button>
          </div>

          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div> : (
            <div className="card">
              {tab === 'deliveries' ? (
                filteredDeliveries.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>{searchQuery ? 'No deliveries match your search' : 'No deliveries'}</div> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>{['Order', 'Customer', 'Address', 'Status', 'Updated'].map((h) => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {filteredDeliveries.map((d, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>#{d.orderId?.slice(-8).toUpperCase() || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{d.customerName || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{d.address ? `${d.address.city}, ${d.address.state}` : '-'}</td>
                          <td style={{ padding: '12px 16px' }}><span className="badge" style={{ background: STATUS_COLORS[d.status] || 'var(--text-light)', color: '#fff', textTransform: 'capitalize' }}>{d.status}</span></td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-light)' }}>{d.updatedAt ? new Date(d.updatedAt).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                filteredPickups.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>{searchQuery ? 'No pickups match your search' : 'No pickups scheduled'}</div> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>{['Order', 'Seller', 'Pickup Date', 'Status', 'Address'].map((h) => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {filteredPickups.map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>#{p.orderId?.slice(-8).toUpperCase() || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{p.seller?.businessName || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{p.pickupDate ? new Date(p.pickupDate).toLocaleDateString() : '-'}</td>
                          <td style={{ padding: '12px 16px' }}><span className="badge" style={{ background: STATUS_COLORS[p.status] || 'var(--text-light)', color: '#fff', textTransform: 'capitalize' }}>{p.status}</span></td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{p.address?.city || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DeliveryManagement;
