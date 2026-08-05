import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { UserBehaviorProvider } from './contexts/UserBehaviorContext';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UserBehaviorProvider>
          <CartProvider>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: '#fff',
                  color: '#212121',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  borderRadius: '4px',
                  fontSize: '14px',
                },
                success: {
                  iconTheme: {
                    primary: '#26a541',
                    secondary: '#fff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ff6161',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </CartProvider>
        </UserBehaviorProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
