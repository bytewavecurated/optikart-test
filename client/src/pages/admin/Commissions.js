import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiSearch, FiCalendar, FiFilter, FiDownload, FiTrendingUp, FiPackage } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const Commissions = () => {
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [stats, setStats] = useState({
    totalCommission: 0,
    totalOrders: 0,
    averageCommission: 0,
    pendingPayout: 0
  });

  useEffect(() => {
    fetchCommissions();
  }, []);

  const fetchCommissions = async () => {
    try {
      const res = await adminApi.getCommissions();
      setCommissions(res.data.data || []);
      
      // Calculate stats
      const totalCommission = res.data.data?.reduce((sum, c) => sum + (c.commissionAmount || 0), 0) || 0;
      const totalOrders = res.data.data?.length || 0;
      const averageCommission = totalOrders > 0 ? totalCommission / totalOrders : 0;
      const pendingPayout = res.data.data?.filter(c => !c.commissionPaid).reduce((sum, c) => sum + (c.sellerPayoutAmount || 0), 0) || 0;
      
      setStats({
        totalCommission,
        totalOrders,
        averageCommission,
        pendingPayout
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCommissions = commissions.filter(comm => {
    const matchesSearch = searchQuery === '' || 
      comm.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comm.seller?.storeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comm.product?.title?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDate = (!dateRange.from || new Date(comm.createdAt) >= new Date(dateRange.from)) &&
                        (!dateRange.to || new Date(comm.createdAt) <= new Date(dateRange.to));
    
    return matchesSearch && matchesDate;
  });

  const exportToCSV = () => {
    const headers = ['Order ID', 'Seller', 'Product', 'Sale Price', 'Commission %', 'Commission Amount', 'Seller Payout', 'Status', 'Date'];
    const rows = filteredCommissions.map(c => [
      c.orderNumber || c._id,
      c.seller?.storeName || 'N/A',
      c.product?.title || 'N/A',
      c.subtotal || 0,
      `${c.commissionPercentage || 3}%`,
      c.commissionAmount || 0,
      c.sellerPayoutAmount || 0,
      c.commissionPaid ? 'Paid' : 'Pending',
      new Date(c.createdAt).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Commission Tracking</h1>
            <button
              onClick={exportToCSV}
              style={{
                padding: '10px 20px',
                background: '#4caf50',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600
              }}
            >
              <FiDownload /> Export CSV
            </button>
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #2874f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}>Total Commission</p>
                  <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#212121', margin: 0 }}>
                    ₹{stats.totalCommission.toLocaleString('en-IN')}
                  </h3>
                </div>
                <FiDollarSign size={32} style={{ color: '#2874f0', opacity: 0.3 }} />
              </div>
            </div>
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #ff9f00' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}>Total Orders</p>
                  <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#212121', margin: 0 }}>
                    {stats.totalOrders}
                  </h3>
                </div>
                <FiPackage size={32} style={{ color: '#ff9f00', opacity: 0.3 }} />
              </div>
            </div>
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #26a541' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}>Average Commission</p>
                  <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#212121', margin: 0 }}>
                    ₹{Math.round(stats.averageCommission).toLocaleString('en-IN')}
                  </h3>
                </div>
                <FiTrendingUp size={32} style={{ color: '#26a541', opacity: 0.3 }} />
              </div>
            </div>
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #ff6161' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}>Pending Payout</p>
                  <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#212121', margin: 0 }}>
                    ₹{stats.pendingPayout.toLocaleString('en-IN')}
                  </h3>
                </div>
                <FiDollarSign size={32} style={{ color: '#ff6161', opacity: 0.3 }} />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
              <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input
                type="text"
                placeholder="Search by order ID, seller, or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <FiCalendar style={{ color: 'var(--text-light)' }} />
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                style={{
                  padding: '10px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                placeholder="From"
              />
              <span style={{ color: 'var(--text-light)' }}>to</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                style={{
                  padding: '10px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                placeholder="To"
              />
            </div>
          </div>

          {/* Commissions Table */}
          <div className="card">
            {filteredCommissions.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>
                No commissions found
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                      {['Order ID', 'Seller', 'Product', 'Sale Price', 'Commission', 'Payout', 'Status', 'Date'].map((h) => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCommissions.map((comm) => (
                      <tr key={comm._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>
                          #{comm.orderNumber || comm._id.slice(-8).toUpperCase()}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                          {comm.seller?.storeName || 'N/A'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                          {comm.product?.title || 'N/A'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>
                          ₹{(comm.subtotal || 0).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#2874f0' }}>
                              ₹{(comm.commissionAmount || 0).toLocaleString('en-IN')}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                              {comm.commissionPercentage || 3}%
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#26a541' }}>
                          ₹{(comm.sellerPayoutAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: comm.commissionPaid ? '#e8f5e9' : '#fff3e0',
                            color: comm.commissionPaid ? '#2e7d32' : '#e65100'
                          }}>
                            {comm.commissionPaid ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-light)' }}>
                          {new Date(comm.createdAt).toLocaleDateString()}
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

export default Commissions;
