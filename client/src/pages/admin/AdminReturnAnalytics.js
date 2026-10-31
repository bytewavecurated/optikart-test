import React, { useState, useEffect } from 'react';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { FiPackage, FiTrendingUp, FiDollarSign, FiAlertTriangle } from 'react-icons/fi';
import { oneOf } from '../../services/apiResponse.js';
import { toastError } from '../../services/errors.js';

const AdminReturnAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getReturnAnalytics(dateRange);

      if (res.data.success) {
        setAnalytics(oneOf(res.data));
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toastError(error, "Failed to load analytics");
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
            <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Loading analytics...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!analytics) {
    return (
      <>
        <Header />
        <div className="container page-wrapper">
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p>No analytics data available</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const { summary, sellerAnalytics, stateAnalytics, reasonDistribution, statusDistribution } = analytics;

  return (
    <>
      <Header />
      <div className="container page-wrapper">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Return Analytics (Admin)</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Platform-wide return tracking by seller and state</p>
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
            <button onClick={fetchAnalytics} className="btn btn-primary">Apply Filter</button>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <FiPackage size={24} color="var(--primary)" />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Returns</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{summary.totalReturns}</div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <FiTrendingUp size={24} color="var(--warning)" />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Overall Return Rate</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{summary.overallReturnRate}%</div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <FiDollarSign size={24} color="var(--success)" />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Refunded</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>₹{summary.totalRefundAmount.toLocaleString()}</div>
          </div>
        </div>

        {/* Seller-wise Analytics */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Seller-wise Return Analytics</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Seller</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Total Orders</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Total Returns</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Return Rate</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Refund Amount</th>
                </tr>
              </thead>
              <tbody>
                {sellerAnalytics.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{item.seller.storeName}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{item.totalOrders}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{item.totalReturns}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: parseFloat(item.returnRate) > 15 ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {item.returnRate}%
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>₹{item.totalRefundAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* State-wise Analytics */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>State-wise Return Analytics</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>State</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Total Orders</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Total Returns</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Return Rate</th>
                </tr>
              </thead>
              <tbody>
                {stateAnalytics.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{item.state}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{item.totalOrders}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{item.totalReturns}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: parseFloat(item.returnRate) > 10 ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {item.returnRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reason Distribution */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Return Reason Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reasonDistribution.slice(0, 8).map((item, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.reason}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{item.count} returns</div>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>{item.percentage}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Return Status Distribution</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            {Object.entries(statusDistribution).map(([status, count]) => (
              <div key={status} style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>{count}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default AdminReturnAnalytics;
