import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { FiUsers, FiShoppingBag, FiDollarSign, FiPackage, FiTrendingUp, FiTruck, FiTag, FiFileText, FiSettings, FiHome, FiLogOut, FiMenu, FiX, FiShield, FiActivity, FiCalendar, FiImage } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await adminApi.dashboard();
        setDashboard(res.data.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      }
    };
    fetchDashboard();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/admin', icon: <FiHome />, exact: true },
    { label: 'Users', path: '/admin/users', icon: <FiUsers /> },
    { label: 'Sellers', path: '/admin/sellers', icon: <FiShoppingBag /> },
    { label: 'Orders', path: '/admin/orders', icon: <FiPackage /> },
    { label: 'Revenue', path: '/admin/revenue', icon: <FiDollarSign /> },
    { label: 'Subscriptions', path: '/admin/subscriptions', icon: <FiTrendingUp /> },
    { label: 'Sale Events', path: '/admin/sale-events', icon: <FiActivity /> },
    { label: 'Banners', path: '/admin/banners', icon: <FiImage /> },
    { label: 'Coupons', path: '/admin/coupons', icon: <FiTag /> },
    { label: 'Blogs', path: '/admin/blogs', icon: <FiFileText /> },
    { label: 'Staff', path: '/admin/staff', icon: <FiSettings /> },
    { label: 'Delivery', path: '/admin/delivery', icon: <FiTruck /> },
  ];

  const stats = dashboard?.stats || {};

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f3f6' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? '240px' : '64px',
        background: '#fff',
        borderRight: '1px solid #e0e0e0',
        transition: 'width 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        zIndex: 100,
        overflow: 'hidden'
      }}>
        {/* Logo */}
        <div style={{
          padding: sidebarOpen ? '20px' : '20px 12px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          minHeight: '64px'
        }}>
          {sidebarOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiShield size={24} color="#2874f0" />
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#2874f0' }}>OptiKart</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#555'
            }}
          >
            {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: sidebarOpen ? '12px 16px' : '12px',
                borderRadius: '8px',
                marginBottom: '4px',
                textDecoration: 'none',
                color: isActive(item) ? '#2874f0' : '#555',
                background: isActive(item) ? '#e8f0fe' : 'transparent',
                fontWeight: isActive(item) ? 600 : 400,
                fontSize: '14px',
                transition: 'all 0.2s',
                justifyContent: sidebarOpen ? 'flex-start' : 'center'
              }}
              title={!sidebarOpen ? item.label : ''}
            >
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid #e0e0e0' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: sidebarOpen ? '12px 16px' : '12px',
              borderRadius: '8px',
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#ff6161',
              fontSize: '14px',
              fontWeight: 500,
              justifyContent: sidebarOpen ? 'flex-start' : 'center'
            }}
            title={!sidebarOpen ? 'Logout' : ''}
          >
            <FiLogOut size={18} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{
        flex: 1,
        marginLeft: sidebarOpen ? '240px' : '64px',
        transition: 'margin-left 0.3s ease',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Top Bar */}
        <header style={{
          background: '#fff',
          borderBottom: '1px solid #e0e0e0',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#212121', margin: 0 }}>
            {navItems.find(item => isActive(item))?.label || 'Admin Panel'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '13px', color: '#666' }}>Admin</span>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, padding: '24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
