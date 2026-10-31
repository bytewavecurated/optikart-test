import React, { useState, useEffect } from 'react';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';
import { FiDollarSign, FiTrendingUp, FiCheckCircle, FiClock } from 'react-icons/fi';
import { toastError } from '../../services/errors.js';

const CommissionDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summaryRes, pendingRes] = await Promise.all([
        adminApi.getCommissionSummary(dateRange),
        adminApi.getPendingCommissions()
      ]);

      if (summaryRes.data.success) {
        setSummary(summaryRes.data.summary);
      }
      if (pendingRes.data.success) {
        setPendingOrders(pendingRes.data.orders);
      }
    } catch (error) {
      console.error('Error fetching commission data:', error);
      toastError(error, "Failed to load commission data");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordCommission = async (orderId) => {
    try {
      const res = await adminApi.recordCommission(orderId);
      if (res.data.success) {
        toast.success('Commission recorded successfully');
        fetchData();
      } else {
        toast.error(res.data.error || 'Failed to record commission');
      }
    } catch (error) {
      toastError(error, "Failed to record commission");
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
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Commission Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Track and manage platform commissions</p>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <FiDollarSign size={24} color="var(--primary)" />
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Commission</span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>₹{summary.totalCommission?.toLocaleString()}</div>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <FiTrendingUp size={24} color="var(--success)" />
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Order Amount</span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>₹{summary.totalOrderAmount?.toLocaleString()}</div>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <FiCheckCircle size={24} color="var(--success)" />
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Orders</span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>{summary.totalOrders}</div>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <FiClock size={24} color="var(--warning)" />
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Avg Commission %</span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>{summary.averageCommissionPercentage}%</div>
            </div>
          </div>
        )}

        {/* Pending Commissions */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Pending Commissions ({pendingOrders.length})</h3>
          {pendingOrders.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No pending commissions</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Order #</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Seller</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Customer</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map((order) => (
                    <tr key={order._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{order.orderNumber}</td>
                      <td style={{ padding: '12px' }}>{order.seller?.storeName || 'N/A'}</td>
                      <td style={{ padding: '12px' }}>{order.customer?.name || 'N/A'}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>₹{order.totalAmount?.toLocaleString()}</td>
                      <td style={{ padding: '12px' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleRecordCommission(order._id)}
                          className="btn btn-primary btn-sm"
                        >
                          Record
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Sellers by Commission */}
        {summary && summary.bySeller && summary.bySeller.length > 0 && (
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Top Sellers by Commission</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Seller</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Orders</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Total Amount</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Commission</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Net to Seller</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.bySeller.slice(0, 10).map((seller, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{seller.seller?.storeName || 'N/A'}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{seller.totalOrders}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>₹{seller.totalAmount?.toLocaleString()}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>₹{seller.totalCommission?.toLocaleString()}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>₹{seller.totalNet?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default CommissionDashboard;
