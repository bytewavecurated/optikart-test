import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { executive as executiveApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';
import { FiPackage, FiTruck, FiMapPin, FiClock, FiCheckCircle, FiAlertCircle, FiUsers } from 'react-icons/fi';

const ExecutiveDashboard = () => {
  const { executive } = useAuth();
  const [stats, setStats] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, deliveriesRes] = await Promise.all([
        executiveApi.getDashboardStats(),
        executiveApi.getAssignedDeliveries()
      ]);
      
      setStats(statsRes.data.data);
      setDeliveries(deliveriesRes.data.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
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
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
            Welcome, {executive?.name}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Executive Dashboard - {executive?.department}
          </p>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '12px', background: 'var(--primary-light)', borderRadius: '8px' }}>
                <FiPackage size={24} color="var(--primary)" />
              </div>
              <div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Orders</p>
                <h3 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)' }}>{stats?.totalOrders || 0}</h3>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '12px', background: 'var(--success-light, #e8f5e9)', borderRadius: '8px' }}>
                <FiCheckCircle size={24} color="var(--success)" />
              </div>
              <div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Completed</p>
                <h3 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)' }}>{stats?.completedOrders || 0}</h3>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '12px', background: 'var(--warning-light, #fff3e0)', borderRadius: '8px' }}>
                <FiClock size={24} color="var(--warning)" />
              </div>
              <div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>In Progress</p>
                <h3 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)' }}>{stats?.inProgressOrders || 0}</h3>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '12px', background: 'var(--danger-light, #ffebee)', borderRadius: '8px' }}>
                <FiAlertCircle size={24} color="var(--danger)" />
              </div>
              <div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Pending</p>
                <h3 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)' }}>{stats?.pendingOrders || 0}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Quick Actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <Link to="/executive/deliveries" className="btn btn-primary">
              <FiTruck /> View All Deliveries
            </Link>
            <Link to="/executive/customers" className="btn btn-outline">
              <FiUsers /> Manage Customers
            </Link>
            <Link to="/executive/reports" className="btn btn-outline">
              <FiPackage /> Generate Reports
            </Link>
          </div>
        </div>

        {/* Recent Deliveries */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Recent Deliveries</h2>
          {deliveries.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
              No deliveries assigned yet
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Order #</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Customer</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Address</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px' }}>
                        <Link to={`/executive/delivery/${delivery._id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                          {delivery.orderNumber}
                        </Link>
                      </td>
                      <td style={{ padding: '12px' }}>{delivery.customer?.name}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FiMapPin size={16} />
                          <span>{delivery.shippingAddress?.city}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className={`badge badge-${delivery.status === 'delivered' ? 'success' : delivery.status === 'in-transit' ? 'warning' : 'default'}`}>
                          {delivery.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Link to={`/executive/delivery/${delivery._id}`} className="btn btn-sm btn-outline">
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ExecutiveDashboard;
