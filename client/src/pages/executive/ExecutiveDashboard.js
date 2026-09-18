import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiShoppingBag, FiPackage, FiTruck, FiLogOut, FiSearch, FiPlus, FiEdit, FiTrash2, FiEye, FiFilter } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ExecutiveDashboard = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [staff, setStaff] = useState([]);
  const [departmentData, setDepartmentData] = useState([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: '' });
  const { executive, executiveLogout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardStats();
    fetchStaff();
    fetchDepartmentData();
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

  const fetchStaff = async () => {
    try {
      const response = await api.get(`/executive/staff?department=${executive?.department}`);
      setStaff(response.data.data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchDepartmentData = async () => {
    try {
      const response = await api.get(`/executive/department-data?department=${executive?.department}`);
      setDepartmentData(response.data.data || []);
    } catch (error) {
      console.error('Error fetching department data:', error);
    }
  };

  const handleAddStaff = async () => {
    try {
      await api.post('/executive/staff', { ...newStaff, department: executive?.department });
      toast.success('Staff added successfully');
      setShowAddStaff(false);
      setNewStaff({ name: '', email: '', password: '', role: '' });
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add staff');
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;
    try {
      await api.delete(`/executive/staff/${staffId}`);
      toast.success('Staff deleted successfully');
      fetchStaff();
    } catch (error) {
      toast.error('Failed to delete staff');
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
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
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

        {/* Tabs */}
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0' }}>
            {['overview', 'staff', 'data'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '16px 24px',
                  background: activeTab === tab ? '#f5f5f5' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '3px solid #667eea' : '3px solid transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: activeTab === tab ? '600' : '400',
                  color: activeTab === tab ? '#667eea' : '#757575',
                  textTransform: 'capitalize'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ padding: '24px' }}>
            {activeTab === 'overview' && (
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#212121' }}>
                  Department Overview: <span style={{ color: getDepartmentColor(executive?.department), textTransform: 'capitalize' }}>{executive?.department}</span>
                </h2>
                <p style={{ color: '#757575', lineHeight: '1.6', marginBottom: '24px' }}>
                  As a {executive?.department} executive, you have access to manage and oversee all {executive?.department}-related operations. 
                  Your permissions include: {executive?.permissions?.map(p => p.module).join(', ') || 'View and manage'} operations within your department.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#757575' }}>Staff Members</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: '700' }}>{staff.length}</h3>
                  </div>
                  <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#757575' }}>Total Records</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: '700' }}>{departmentData.length}</h3>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'staff' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: '#212121' }}>Staff Management</h2>
                  <button
                    onClick={() => setShowAddStaff(true)}
                    style={{ padding: '10px 20px', background: '#667eea', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <FiPlus /> Add Staff
                  </button>
                </div>

                <div style={{ position: 'relative', marginBottom: '20px' }}>
                  <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9e9e9e' }} />
                  <input
                    type="text"
                    placeholder="Search staff by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '10px 10px 10px 40px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  />
                </div>

                {staff.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#757575', padding: '40px' }}>No staff members yet. Add your first staff member!</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Name</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Email</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Role</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staff.filter(s => 
                          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.email.toLowerCase().includes(searchQuery.toLowerCase())
                        ).map((staffMember) => (
                          <tr key={staffMember._id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                            <td style={{ padding: '12px', fontWeight: '500' }}>{staffMember.name}</td>
                            <td style={{ padding: '12px' }}>{staffMember.email}</td>
                            <td style={{ padding: '12px' }}>{staffMember.role}</td>
                            <td style={{ padding: '12px' }}>
                              <button
                                onClick={() => handleDeleteStaff(staffMember._id)}
                                style={{ padding: '6px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'data' && (
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#212121' }}>Department Data</h2>
                
                <div style={{ position: 'relative', marginBottom: '20px' }}>
                  <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9e9e9e' }} />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '10px 10px 10px 40px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  />
                </div>

                {departmentData.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#757575', padding: '40px' }}>No data available for your department.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>ID</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Details</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Status</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departmentData.map((item, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #e0e0e0' }}>
                            <td style={{ padding: '12px', fontWeight: '500' }}>{item._id?.slice(-8) || '-'}</td>
                            <td style={{ padding: '12px' }}>{item.name || item.title || item.email || '-'}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '600',
                                background: item.isActive ? '#e8f5e9' : '#ffebee',
                                color: item.isActive ? '#4caf50' : '#f44336'
                              }}>
                                {item.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <button style={{ padding: '6px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}>
                                <FiEye size={16} />
                              </button>
                              <button style={{ padding: '6px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                <FiEdit size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', maxWidth: '500px', width: '90%' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>Add New Staff</h2>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Name</label>
                <input
                  type="text"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  placeholder="Staff name"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Email</label>
                <input
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  placeholder="staff@email.com"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Password</label>
                <input
                  type="password"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  placeholder="Password"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Role</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({...newStaff, role: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                >
                  <option value="">Select role</option>
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="assistant">Assistant</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={handleAddStaff}
                style={{ flex: 1, padding: '12px', background: '#667eea', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Add Staff
              </button>
              <button
                onClick={() => setShowAddStaff(false)}
                style={{ flex: 1, padding: '12px', background: '#e0e0e0', color: '#212121', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
