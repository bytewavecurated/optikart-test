import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiUsers, FiShoppingBag, FiPackage, FiDollarSign, FiTrendingUp, FiTruck, FiTag, FiFileText, FiSettings, FiActivity, FiImage, FiLogOut, FiMenu, FiX, FiShield } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const menuItems = [
    { label: 'Dashboard', path: '/admin', icon: <FiHome />, exact: true },
    { label: 'Users', path: '/admin/users', icon: <FiUsers /> },
    { label: 'Sellers', path: '/admin/sellers', icon: <FiShoppingBag /> },
    { label: 'Executives', path: '/admin/executives', icon: <FiSettings /> },
    { label: 'Manufacturers', path: '/admin/manufacturers', icon: <FiPackage /> },
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

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? '280px' : '80px',
        background: '#fff',
        borderRight: '1px solid #e8e8e8',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        zIndex: 100,
        overflow: 'hidden',
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)'
      }}>
        {/* Logo Section */}
        <div style={{
          padding: sidebarOpen ? '24px' : '24px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          minHeight: '80px'
        }}>
          {sidebarOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '20px'
              }}>
                <FiShield />
              </div>
              <div>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#212121', display: 'block', letterSpacing: '-0.5px' }}>OptiKart</span>
                <span style={{ fontSize: '11px', color: '#757575', fontWeight: 500 }}>Admin Panel</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: '#f8f9fa',
              border: 'none',
              cursor: 'pointer',
              padding: '10px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#757575',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f0f0f0';
              e.currentTarget.style.color = '#212121';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f8f9fa';
              e.currentTarget.style.color = '#757575';
            }}
          >
            {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto', overflowX: 'hidden' }}>
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: sidebarOpen ? '14px 18px' : '14px',
                borderRadius: '12px',
                marginBottom: '6px',
                textDecoration: 'none',
                color: isActive(item) ? '#667eea' : '#757575',
                background: isActive(item) ? 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)' : 'transparent',
                fontWeight: isActive(item) ? 600 : 500,
                fontSize: '14px',
                transition: 'all 0.2s ease',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                position: 'relative'
              }}
              title={!sidebarOpen ? item.label : ''}
              onMouseEnter={(e) => {
                if (!isActive(item)) {
                  e.currentTarget.style.background = '#f8f9fa';
                  e.currentTarget.style.color = '#212121';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item)) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#757575';
                }
              }}
            >
              {isActive(item) && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '4px',
                  height: '24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '0 4px 4px 0'
                }} />
              )}
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid #f0f0f0' }}>
          {sidebarOpen && admin && (
            <div style={{ 
              padding: '16px',
              marginBottom: '12px',
              background: '#f8f9fa',
              borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 700
                }}>
                  {(admin.name || 'A')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#212121' }}>{admin.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#757575' }}>{admin.email}</p>
                </div>
              </div>
              <div style={{
                display: 'inline-block',
                padding: '4px 10px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600
              }}>
                Administrator
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: sidebarOpen ? '14px 18px' : '14px',
              borderRadius: '12px',
              width: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#f44336',
              fontSize: '14px',
              fontWeight: 600,
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              transition: 'all 0.2s ease'
            }}
            title={!sidebarOpen ? 'Logout' : ''}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ffebee';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <FiLogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{
        flex: 1,
        marginLeft: sidebarOpen ? '280px' : '80px',
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Top Bar */}
        <header style={{
          background: '#fff',
          borderBottom: '1px solid #e8e8e8',
          padding: '20px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#212121', margin: 0, letterSpacing: '-0.5px' }}>
              {menuItems.find(item => isActive(item))?.label || 'Admin Panel'}
            </h1>
            <p style={{ fontSize: '13px', color: '#757575', margin: '4px 0 0 0' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#4caf50',
                boxShadow: '0 0 8px #4caf50'
              }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#212121' }}>System Online</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, padding: '32px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
