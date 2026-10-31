import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { seller as sellerApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { FiPackage, FiTrendingUp, FiAlertTriangle, FiCheckCircle, FiXCircle, FiBarChart2 } from 'react-icons/fi';
import { oneOf } from '../../services/apiResponse.js';
import { toastError } from '../../services/errors.js';

const SellerInventoryAnalytics = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [healthScore, setHealthScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [analyticsRes, healthRes] = await Promise.all([
        sellerApi.getInventoryAnalytics(dateRange),
        sellerApi.getInventoryHealth()
      ]);

      if (analyticsRes.data.success) {
        setAnalytics(oneOf(analyticsRes.data));
      }
      if (healthRes.data.success) {
        setHealthScore(healthRes.data);
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

  const { summary, stockDistribution, categoryDistribution, fastMoving, slowMoving, deadStock, stockTrend } = analytics;

  return (
    <>
      <Header />
      <div className="container page-wrapper">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Inventory Analytics</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Monitor stock trends, fast/slow-moving items, and inventory health</p>
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
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Products</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{summary.totalProducts}</div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <FiBarChart2 size={24} color="var(--primary)" />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Stock</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{summary.totalStock}</div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <FiTrendingUp size={24} color="var(--success)" />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Stock Value</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>₹{summary.totalStockValue.toLocaleString()}</div>
          </div>

          {healthScore && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <FiCheckCircle size={24} color={healthScore.score >= 70 ? 'var(--success)' : healthScore.score >= 50 ? 'var(--warning)' : 'var(--danger)'} />
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Health Score</span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>{healthScore.score}% ({healthScore.grade})</div>
            </div>
          )}
        </div>

        {/* Stock Distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Stock Distribution</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiCheckCircle color="var(--success)" /> Healthy Stock
                </span>
                <span style={{ fontWeight: 600 }}>{stockDistribution.healthyStock}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiAlertTriangle color="var(--warning)" /> Low Stock
                </span>
                <span style={{ fontWeight: 600 }}>{stockDistribution.lowStock}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiXCircle color="var(--danger)" /> Out of Stock
                </span>
                <span style={{ fontWeight: 600 }}>{stockDistribution.outOfStock}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Category Distribution</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(categoryDistribution).slice(0, 5).map(([category, data]) => (
                <div key={category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ textTransform: 'capitalize' }}>{category}</span>
                  <span style={{ fontWeight: 600 }}>{data.count} products</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fast/Slow Moving Items */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--success)' }}>
              <FiTrendingUp style={{ marginRight: '8px' }} />
              Fast Moving Items
            </h3>
            {fastMoving.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No fast-moving items</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {fastMoving.slice(0, 5).map((item, index) => (
                  <div key={index} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.product.title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {item.avgDailySales.toFixed(1)} units/day · {item.quantitySold} sold
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--warning)' }}>
              <FiAlertTriangle style={{ marginRight: '8px' }} />
              Slow Moving Items
            </h3>
            {slowMoving.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No slow-moving items</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {slowMoving.slice(0, 5).map((item, index) => (
                  <div key={index} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.product.title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {item.avgDailySales.toFixed(2)} units/day · Last sold {item.daysSinceLastSale}d ago
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dead Stock */}
        {deadStock.length > 0 && (
          <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--danger)' }}>
              <FiXCircle style={{ marginRight: '8px' }} />
              Dead Stock (No Sales)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
              {deadStock.slice(0, 6).map((item, index) => (
                <div key={index} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.product.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    No sales in {item.daysSinceLastSale} days
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stock Trend */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Stock Trend (Last 30 Days)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Units Sold</th>
                </tr>
              </thead>
              <tbody>
                {stockTrend.slice(-10).map((day, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>{day.date}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>{day.unitsSold}</td>
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

export default SellerInventoryAnalytics;
