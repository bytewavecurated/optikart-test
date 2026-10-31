import React, { useState, useEffect } from 'react';
import { seller as sellerApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { FiDollarSign, FiTrendingUp, FiCheckCircle } from 'react-icons/fi';
import { toastError } from '../../services/errors.js';

const SellerCommission = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await sellerApi.getMyCommission(dateRange);
      if (res.data.success) {
        setSummary(res.data.summary);
      }
    } catch (error) {
      console.error('Error fetching commission data:', error);
      toastError(error, "Failed to load commission data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container page-wrapper">
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Loading commission data...</p>
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
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>My Commission</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Track your earnings and commission details</p>
        </div>

        {/* Date Range Filter */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Start Date</label>
              <input
                type="date"
                className="input"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>End Date</label>
              <input
                type="date"
                className="input"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              />
            </div>
            <button onClick={fetchData} className="btn btn-primary">Apply Filter</button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <FiCheckCircle size={24} color="var(--primary)" />
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Orders</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700 }}>{summary.totalOrders}</div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <FiTrendingUp size={24} color="var(--success)" />
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Sales</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700 }}>₹{summary.totalOrderAmount?.toLocaleString()}</div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <FiDollarSign size={24} color="var(--warning)" />
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Commission Paid</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700 }}>₹{summary.totalCommission?.toLocaleString()}</div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <FiDollarSign size={24} color="var(--success)" />
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Net Earnings</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--success)' }}>₹{summary.totalNet?.toLocaleString()}</div>
              </div>
            </div>

            {/* Recent Orders */}
            {summary.recentOrders && summary.recentOrders.length > 0 && (
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Recent Orders</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Order #</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Order Amount</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Commission</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Net Amount</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.recentOrders.map((order, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{order.orderNumber}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>₹{order.orderAmount?.toLocaleString()}</td>
                          <td style={{ padding: '12px', textAlign: 'right', color: 'var(--warning)' }}>₹{order.commission?.toLocaleString()}</td>
                          <td style={{ padding: '12px', textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>₹{order.netAmount?.toLocaleString()}</td>
                          <td style={{ padding: '12px' }}>{new Date(order.date).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </>
  );
};

export default SellerCommission;
