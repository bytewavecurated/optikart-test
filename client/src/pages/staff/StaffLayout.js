import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiFileText, FiHeadphones, FiPackage, FiShoppingBag, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import BackButton from '../../components/BackButton';

const StaffLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { staff, staffLogout } = useAuth();

  const handleLogout = () => {
    staffLogout();
    navigate('/staff/login');
  };

  // Get menu items based on staff role
  const getMenuItems = () => {
    const role = staff?.staffRole || staff?.role || 'blog_manager';

    switch(role) {
      case 'blog_manager':
        return [
          { label: 'Dashboard', path: '/staff', icon: <FiHome /> },
          { label: 'Manage Blogs', path: '/staff/blogs/manage', icon: <FiFileText /> },
        ];
      case 'user_manager':
        return [
          { label: 'Dashboard', path: '/staff', icon: <FiHome /> },
          { label: 'Returns and Tickets', path: '/staff/support/tickets', icon: <FiHeadphones /> },
        ];
      // A doc verifier checks prescription uploads; sending them to the product
      // list meant the queue they were hired for had no door into it.
      case 'doc_verifier':
        return [
          { label: 'Dashboard', path: '/staff', icon: <FiHome /> },
          { label: 'Prescription checks', path: '/staff/prescriptions', icon: <FiFileText /> },
        ];
      case 'seller_manager':
        return [
          { label: 'Dashboard', path: '/staff', icon: <FiHome /> },
          { label: 'Manage Products', path: '/staff/products/manage', icon: <FiPackage /> },
        ];
      case 'finance_manager':
      case 'delivery_manager':
      case 'pickup_manager':
        return [
          { label: 'Dashboard', path: '/staff', icon: <FiHome /> },
          { label: 'Manage Orders', path: '/staff/orders/manage', icon: <FiShoppingBag /> },
        ];
      default:
        return [
          { label: 'Dashboard', path: '/staff/dashboard', icon: <FiHome /> },
        ];
    }
  };

  const menuItems = getMenuItems();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-subtle)' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? '240px' : '64px',
        background: 'var(--bg-white)',
        borderRight: '1px solid var(--border)',
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
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          minHeight: '64px'
        }}>
          {sidebarOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--brand)' }}>OptiKart</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px' }}>Staff</span>
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
              color: 'var(--text-secondary)'
            }}
          >
            {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {menuItems.map((item) => (
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
                color: location.pathname === item.path ? '#667eea' : '#555',
                background: location.pathname === item.path ? '#f0f4ff' : 'transparent',
                fontWeight: location.pathname === item.path ? 600 : 400,
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

        {/* User Info & Logout */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          {sidebarOpen && staff && (
            <div style={{ padding: '8px 16px', marginBottom: '8px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>{staff.name}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>{staff.email}</p>
              <p style={{ fontSize: '10px', color: 'var(--text-light)', margin: '4px 0 0 0', textTransform: 'capitalize' }}>{staff.role?.replace('_', ' ')}</p>
            </div>
          )}
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
          background: 'var(--bg-white)',
          borderBottom: '1px solid var(--border)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}>
          <BackButton label="Back to dashboard" />
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {menuItems.find(item => location.pathname === item.path)?.label || 'Staff Panel'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{staff?.name || 'Staff'}</span>
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

export default StaffLayout;
