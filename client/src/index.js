import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { UserBehaviorProvider } from './contexts/UserBehaviorContext';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
      <AuthProvider>
        <UserBehaviorProvider>
          <CartProvider>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: 'var(--bg-white)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-lg)',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '14px',
                },
                success: {
                  iconTheme: {
                    primary: 'var(--success)',
                    secondary: 'var(--bg-white)',
                  },
                },
                error: {
                  iconTheme: {
                    primary: 'var(--danger)',
                    secondary: 'var(--bg-white)',
                  },
                },
              }}
            />
          </CartProvider>
        </UserBehaviorProvider>
      </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
