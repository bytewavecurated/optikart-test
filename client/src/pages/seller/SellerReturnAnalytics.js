import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { seller as sellerApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';
import { FiPackage, FiTrendingUp, FiAlertTriangle, FiCheckCircle, FiXCircle, FiDollarSign } from 'react-icons/fi';

const SellerReturnAnalytics = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await sellerApi.getReturnAnalytics(dateRange);

      if (res.data.success) {
        setAnalytics(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
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

  const { summary, statusDistribution, topReasons, categoryReturnRates, topReturnProducts, returnTrend } = analytics;

  return (
    <>
      <Header />
      <div className="container page-wrapper">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Return Analytics</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Track return reasons, rates by product/category</p>
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
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Return Rate</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{summary.returnRate}%</div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <FiDollarSign size={24} color="var(--success)" />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Refunded</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>₹{summary.totalRefundAmount.toLocaleString()}</div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <FiAlertTriangle size={24} color="var(--danger)" />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Pending Refunds</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>₹{summary.pendingRefundAmount.toLocaleString()}</div>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
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

        {/* Top Return Reasons */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Top Return Reasons</h3>
          {topReasons.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No return data available</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {topReasons.slice(0, 5).map((item, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.reason}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{item.count} returns</div>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>{item.percentage}%</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category-wise Return Rates */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Category-wise Return Rates</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Category</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Ordered</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Returned</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Return Rate</th>
                </tr>
              </thead>
              <tbody>
                {categoryReturnRates.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', textTransform: 'capitalize' }}>{item.category}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{item.ordered}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{item.returned}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: parseFloat(item.returnRate) > 10 ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {item.returnRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Return Products */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Top Return Products</h3>
          {topReturnProducts.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No return data available</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Product</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Ordered</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Returned</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Return Rate</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Top Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {topReturnProducts.map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{item.product.title}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{item.quantityOrdered}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{item.quantityReturned}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: parseFloat(item.returnRate) > 20 ? 'var(--danger)' : 'var(--text-primary)' }}>
                        {item.returnRate}%
                      </td>
                      <td style={{ padding: '12px' }}>{item.topReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Return Trend */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Return Trend (Last 30 Days)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Returns</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Refund Amount</th>
                </tr>
              </thead>
              <tbody>
                {returnTrend.slice(-10).map((day, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>{day.date}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>{day.returns}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>₹{day.refundAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default SellerReturnAnalytics;
