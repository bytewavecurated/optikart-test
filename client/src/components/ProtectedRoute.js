import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const AuthContext = React.createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    fontFamily: "'Roboto', sans-serif",
    padding: '40px 20px',
    textAlign: 'center',
  },
  icon: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#212121',
    marginBottom: '8px',
  },
  message: {
    fontSize: '15px',
    color: '#666',
    marginBottom: '24px',
    maxWidth: '400px',
    lineHeight: '1.5',
  },
  loginBtn: {
    background: '#2874f0',
    color: '#fff',
    border: 'none',
    padding: '12px 32px',
    borderRadius: '4px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  },
};

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const auth = useAuth();
  const location = useLocation();

  if (!auth || !auth.isAuthenticated) {
    return (
      <div style={styles.container}>
        <div style={styles.icon}>🔒</div>
        <h2 style={styles.title}>Login Required</h2>
        <p style={styles.message}>
          Please log in to access this page. You'll be redirected to the login page.
        </p>
        <Navigate to="/login" state={{ from: location }} replace />
      </div>
    );
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(auth.role)) {
    return (
      <div style={styles.container}>
        <div style={styles.icon}>⚠️</div>
        <h2 style={styles.title}>Access Denied</h2>
        <p style={styles.message}>
          You don't have permission to access this page. This section is restricted to {allowedRoles.join(' or ')} accounts.
        </p>
        <a href="/" style={styles.loginBtn}>Go to Home</a>
      </div>
    );
  }

  return children;
}
