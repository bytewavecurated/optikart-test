import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiShoppingBag, FiPackage, FiTruck, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ExecutiveDashboard = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const { executive, executiveLogout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/executive/dashboard');
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    executiveLogout();
    navigate('/executive/login');
  };

  const getDepartmentIcon = (department) => {
    switch (department) {
      case 'users': return <FiUsers />;
      case 'sellers': return <FiShoppingBag />;
      case 'orders': return <FiPackage />;
      case 'delivery': return <FiTruck />;
      default: return <FiUsers />;
    }
  };

  const getDepartmentColor = (department) => {
    switch (department) {
      case 'users': return '#2196f3';
      case 'sellers': return '#4caf50';
      case 'orders': return '#ff9800';
      case 'delivery': return '#9c27b0';
      default: return '#2196f3';
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', border: '4px solid #f3f3f3', borderTop: '4px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: '#212121' }}>Executive Dashboard</h1>
          <p style={{ margin: '4px 0 0', color: '#757575', fontSize: '14px' }}>
            Department: <span style={{ fontWeight: '600', color: getDepartmentColor(executive?.department), textTransform: 'capitalize' }}>{executive?.department}</span>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontWeight: '600', color: '#212121' }}>{executive?.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#757575' }}>{executive?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            style={{ padding: '8px 16px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          {executive?.department === 'users' && (
            <>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', background: '#e3f2fd', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2196f3' }}>
                    <FiUsers size={24} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>Total Users</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#212121' }}>{stats.totalUsers || 0}</h3>
                  </div>
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', background: '#e8f5e9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4caf50' }}>
                    <FiUsers size={24} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>Active Users</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#212121' }}>{stats.activeUsers || 0}</h3>
                  </div>
                </div>
              </div>
            </>
          )}

          {executive?.department === 'sellers' && (
            <>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', background: '#e8f5e9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4caf50' }}>
                    <FiShoppingBag size={24} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>Total Sellers</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#212121' }}>{stats.totalSellers || 0}</h3>
                  </div>
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', background: '#fff3e0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9800' }}>
                    <FiShoppingBag size={24} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>Pending Verification</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#212121' }}>{stats.pendingSellers || 0}</h3>
                  </div>
                </div>
              </div>
            </>
          )}

          {executive?.department === 'orders' && (
            <>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', background: '#fff3e0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9800' }}>
                    <FiPackage size={24} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>Total Orders</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#212121' }}>{stats.totalOrders || 0}</h3>
                  </div>
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', background: '#fce4ec', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f44336' }}>
                    <FiPackage size={24} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>Pending Orders</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#212121' }}>{stats.pendingOrders || 0}</h3>
                  </div>
                </div>
              </div>
            </>
          )}

          {executive?.department === 'delivery' && (
            <>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', background: '#f3e5f5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9c27b0' }}>
                    <FiTruck size={24} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>Total Deliveries</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#212121' }}>{stats.totalDeliveries || 0}</h3>
                  </div>
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', background: '#e8f5e9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4caf50' }}>
                    <FiTruck size={24} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>Delivered</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#212121' }}>{stats.deliveredOrders || 0}</h3>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Department Info */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#212121' }}>
            Your Department: <span style={{ color: getDepartmentColor(executive?.department), textTransform: 'capitalize' }}>{executive?.department}</span>
          </h2>
          <p style={{ color: '#757575', lineHeight: '1.6' }}>
            As a {executive?.department} executive, you have access to manage and oversee all {executive?.department}-related operations. 
            Your permissions include: {executive?.permissions?.map(p => p.module).join(', ') || 'View and manage'} operations within your department.
          </p>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default ExecutiveDashboard;
