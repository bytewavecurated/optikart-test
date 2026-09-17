import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

const TOKEN_KEY = 'optikart_token';
const ROLE_KEY = 'optikart_role';
const USER_KEY = 'optikart_user';
const SESSION_EXPIRY_KEY = 'optikart_session_expiry';

const SESSION_DURATION = {
  user: 30 * 24 * 60 * 60 * 1000,
  seller: 24 * 60 * 60 * 1000,
  admin: 24 * 60 * 60 * 1000,
  executive: 24 * 60 * 60 * 1000,
  manufacturer: 24 * 60 * 60 * 1000,
  manufacturerSeller: 24 * 60 * 60 * 1000,
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [seller, setSeller] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [staff, setStaff] = useState(null);
  const [executive, setExecutive] = useState(null);
  const [manufacturer, setManufacturer] = useState(null);
  const [manufacturerSeller, setManufacturerSeller] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const clearAllState = useCallback(() => {
    setUser(null);
    setSeller(null);
    setAdmin(null);
    setStaff(null);
    setExecutive(null);
    setManufacturer(null);
    setManufacturerSeller(null);
    setIsAuthenticated(false);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    disconnectSocket();
  }, []);

  const checkSessionExpiry = useCallback(() => {
    const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);
    if (expiry && Date.now() > parseInt(expiry, 10)) {
      clearAllState();
      toast.error('Session expired. Please login again.');
      return false;
    }
    return true;
  }, [clearAllState]);

  const setSessionExpiry = useCallback((role) => {
    const duration = SESSION_DURATION[role] || SESSION_DURATION.user;
    const expiry = Date.now() + duration;
    localStorage.setItem(SESSION_EXPIRY_KEY, expiry.toString());
  }, []);

  const initializeAuth = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const role = localStorage.getItem(ROLE_KEY);

    if (!token || !role) {
      setLoading(false);
      return;
    }

    if (!checkSessionExpiry()) {
      setLoading(false);
      return;
    }

    try {
      let response;
      if (role === 'seller') {
        response = await api.get('/seller/me');
        setSeller(response.data.seller);
      } else if (role === 'admin') {
        response = await api.get('/admin/me');
        setAdmin(response.data.admin || response.data.user);
      } else if (role === 'executive') {
        response = await api.get('/executive/me');
        setExecutive(response.data.executive);
      } else if (role === 'manufacturer') {
        response = await api.get('/manufacturer/me');
        setManufacturer(response.data.manufacturer);
      } else if (role === 'manufacturerSeller') {
        response = await api.get('/manufacturer-seller/me');
        setManufacturerSeller(response.data.seller);
      } else {
        response = await api.get('/auth/me');
        setUser(response.data.user);
      }
      setIsAuthenticated(true);
      connectSocket(token);
    } catch (error) {
      clearAllState();
    } finally {
      setLoading(false);
    }
  }, [checkSessionExpiry, clearAllState]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isAuthenticated) {
        checkSessionExpiry();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [isAuthenticated, checkSessionExpiry]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const data = response.data;
      
      if (data.requiresOTP) {
        return { success: true, requiresOTP: true, email: data.email };
      }
      
      if (data.token) {
        const { token, user: userData } = data;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(ROLE_KEY, 'user');
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        setSessionExpiry('user');
        setUser(userData);
        setIsAuthenticated(true);
        connectSocket(token);
        toast.success('Login successful!');
        return { success: true, token };
      }
      
      return { success: false, message: 'Unexpected response from server' };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const verifyLoginOTP = async (email, otp) => {
    try {
      const response = await api.post('/auth/verify-login-otp', { email, otp });
      const { token, user: userData } = response.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, 'user');
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setSessionExpiry('user');
      setUser(userData);
      setIsAuthenticated(true);
      connectSocket(token);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'OTP verification failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const { token, user: newUser } = response.data.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, 'user');
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      setSessionExpiry('user');
      setUser(newUser);
      setIsAuthenticated(true);
      connectSocket(token);
      toast.success('Registration successful!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    clearAllState();
    toast.success('Logged out successfully');
  }, [clearAllState]);

  const sellerLogin = async (email, password) => {
    try {
      const response = await api.post('/seller/login', { email, password });
      const data = response.data;
      
      if (data.requiresOTP) {
        return { success: true, requiresOTP: true, email: data.email, sellerId: data.sellerId };
      }
      
      if (data.token) {
        const { token, seller: sellerData } = data;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(ROLE_KEY, 'seller');
        localStorage.setItem(USER_KEY, JSON.stringify(sellerData));
        setSessionExpiry('seller');
        setSeller(sellerData);
        setIsAuthenticated(true);
        connectSocket(token);
        toast.success('Seller login successful!');
        return { success: true, token };
      }
      
      return { success: false, message: 'Unexpected response from server' };
    } catch (error) {
      const message = error.response?.data?.message || 'Seller login failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const verifySellerLoginOTP = async (sellerId, otp) => {
    try {
      const response = await api.post('/seller/verify-login-otp', { sellerId, otp });
      const { token, seller: sellerData } = response.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, 'seller');
      localStorage.setItem(USER_KEY, JSON.stringify(sellerData));
      setSessionExpiry('seller');
      setSeller(sellerData);
      setIsAuthenticated(true);
      connectSocket(token);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'OTP verification failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const sellerLogout = useCallback(() => {
    api.post('/seller/logout').catch(() => {});
    clearAllState();
    toast.success('Logged out successfully');
  }, [clearAllState]);

  const adminLogin = async (email, password) => {
    try {
      const response = await api.post('/admin/auth/login', { email, password });
      const data = response.data;
      
      if (data.requiresOTP) {
        return { success: true, requiresOTP: true, email: data.email };
      }
      
      if (data.token) {
        const { token, admin: adminData } = data;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(ROLE_KEY, 'admin');
        localStorage.setItem(USER_KEY, JSON.stringify(adminData));
        setSessionExpiry('admin');
        setAdmin(adminData);
        setIsAuthenticated(true);
        connectSocket(token);
        toast.success('Admin login successful!');
        return { success: true, token };
      }
      
      return { success: false, message: 'Unexpected response from server' };
    } catch (error) {
      const message = error.response?.data?.message || 'Admin login failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const verifyAdminLoginOTP = async (email, otp) => {
    try {
      const response = await api.post('/admin/auth/verify-otp', { email, otp });
      const { token, admin: adminData } = response.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, 'admin');
      localStorage.setItem(USER_KEY, JSON.stringify(adminData));
      setSessionExpiry('admin');
      setAdmin(adminData);
      setIsAuthenticated(true);
      connectSocket(token);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'OTP verification failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const adminLogout = useCallback(() => {
    api.post('/admin/auth/logout').catch(() => {});
    clearAllState();
    toast.success('Logged out successfully');
  }, [clearAllState]);

  const executiveLogin = async (email, password) => {
    try {
      const response = await api.post('/executive/login', { email, password });
      const data = response.data;
      
      if (data.requiresOTP) {
        return { success: true, requiresOTP: true, email: data.email, executiveId: data.executiveId };
      }
      
      if (data.token) {
        const { token, executive: executiveData } = data;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(ROLE_KEY, 'executive');
        localStorage.setItem(USER_KEY, JSON.stringify(executiveData));
        setSessionExpiry('executive');
        setExecutive(executiveData);
        setIsAuthenticated(true);
        connectSocket(token);
        toast.success('Executive login successful!');
        return { success: true, token, executive: executiveData };
      }
      
      return { success: false, message: 'Unexpected response from server' };
    } catch (error) {
      const message = error.response?.data?.message || 'Executive login failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const verifyExecutiveLoginOTP = async (executiveId, otp) => {
    try {
      const response = await api.post('/executive/verify-login-otp', { executiveId, otp });
      const { token, executive: executiveData } = response.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, 'executive');
      localStorage.setItem(USER_KEY, JSON.stringify(executiveData));
      setSessionExpiry('executive');
      setExecutive(executiveData);
      setIsAuthenticated(true);
      connectSocket(token);
      return { success: true, executive: executiveData };
    } catch (error) {
      const message = error.response?.data?.message || 'OTP verification failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const executiveLogout = useCallback(() => {
    api.post('/executive/logout').catch(() => {});
    clearAllState();
    toast.success('Logged out successfully');
  }, [clearAllState]);

  const manufacturerLogin = async (email, password) => {
    try {
      const response = await api.post('/manufacturer/login', { email, password });
      const data = response.data;
      
      if (data.requiresOTP) {
        return { success: true, requiresOTP: true, email: data.email, manufacturerId: data.manufacturerId };
      }
      
      if (data.token) {
        const { token, manufacturer: manufacturerData } = data;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(ROLE_KEY, 'manufacturer');
        localStorage.setItem(USER_KEY, JSON.stringify(manufacturerData));
        setSessionExpiry('manufacturer');
        setManufacturer(manufacturerData);
        setIsAuthenticated(true);
        connectSocket(token);
        toast.success('Manufacturer login successful!');
        return { success: true, token, manufacturer: manufacturerData };
      }
      
      return { success: false, message: 'Unexpected response from server' };
    } catch (error) {
      const message = error.response?.data?.message || 'Manufacturer login failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const verifyManufacturerLoginOTP = async (manufacturerId, otp) => {
    try {
      const response = await api.post('/manufacturer/verify-login-otp', { manufacturerId, otp });
      const { token, manufacturer: manufacturerData } = response.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, 'manufacturer');
      localStorage.setItem(USER_KEY, JSON.stringify(manufacturerData));
      setSessionExpiry('manufacturer');
      setManufacturer(manufacturerData);
      setIsAuthenticated(true);
      connectSocket(token);
      return { success: true, manufacturer: manufacturerData };
    } catch (error) {
      const message = error.response?.data?.message || 'OTP verification failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const manufacturerLogout = useCallback(() => {
    api.post('/manufacturer/logout').catch(() => {});
    clearAllState();
    toast.success('Logged out successfully');
  }, [clearAllState]);

  const manufacturerSellerLogin = async (email, password) => {
    try {
      const response = await api.post('/manufacturer-seller/login', { email, password });
      const data = response.data;
      
      if (data.requiresOTP) {
        return { success: true, requiresOTP: true, email: data.email, sellerId: data.sellerId };
      }
      
      if (data.token) {
        const { token, seller: sellerData } = data;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(ROLE_KEY, 'manufacturerSeller');
        localStorage.setItem(USER_KEY, JSON.stringify(sellerData));
        setSessionExpiry('manufacturerSeller');
        setManufacturerSeller(sellerData);
        setIsAuthenticated(true);
        connectSocket(token);
        toast.success('Manufacturer seller login successful!');
        return { success: true, token, seller: sellerData };
      }
      
      return { success: false, message: 'Unexpected response from server' };
    } catch (error) {
      const message = error.response?.data?.message || 'Manufacturer seller login failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const verifyManufacturerSellerLoginOTP = async (sellerId, otp) => {
    try {
      const response = await api.post('/manufacturer-seller/verify-login-otp', { sellerId, otp });
      const { token, seller: sellerData } = response.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, 'manufacturerSeller');
      localStorage.setItem(USER_KEY, JSON.stringify(sellerData));
      setSessionExpiry('manufacturerSeller');
      setManufacturerSeller(sellerData);
      setIsAuthenticated(true);
      connectSocket(token);
      return { success: true, seller: sellerData };
    } catch (error) {
      const message = error.response?.data?.message || 'OTP verification failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const manufacturerSellerLogout = useCallback(() => {
    api.post('/manufacturer-seller/logout').catch(() => {});
    clearAllState();
    toast.success('Logged out successfully');
  }, [clearAllState]);

  const value = {
    user,
    seller,
    admin,
    staff,
    executive,
    manufacturer,
    manufacturerSeller,
    isAuthenticated,
    loading,
    login,
    verifyLoginOTP,
    register,
    logout,
    sellerLogin,
    verifySellerLoginOTP,
    sellerLogout,
    adminLogin,
    verifyAdminLoginOTP,
    adminLogout,
    executiveLogin,
    verifyExecutiveLoginOTP,
    executiveLogout,
    manufacturerLogin,
    verifyManufacturerLoginOTP,
    manufacturerLogout,
    manufacturerSellerLogin,
    verifyManufacturerSellerLoginOTP,
    manufacturerSellerLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
