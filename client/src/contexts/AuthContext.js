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
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [seller, setSeller] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [staff, setStaff] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const clearAllState = useCallback(() => {
    setUser(null);
    setSeller(null);
    setAdmin(null);
    setStaff(null);
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
        setSeller(response.data.data);
        setStaff(response.data.data);
      } else if (role === 'admin') {
        response = await api.get('/admin/me');
        setAdmin(response.data.data);
        setStaff(response.data.data);
      } else {
        response = await api.get('/auth/me');
        setUser(response.data.data);
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
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, checkSessionExpiry]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const data = response.data;
      
      // Check if OTP is required
      if (data.requiresOTP) {
        return { success: true, requiresOTP: true, email: data.email };
      }
      
      // If no OTP required (shouldn't happen with new flow, but keeping for backwards compatibility)
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
      
      // Check if OTP is required (new flow)
      if (data.requiresOTP) {
        return { success: true, requiresOTP: true, email: data.email, sellerId: data.sellerId };
      }
      
      // Old flow - direct token
      if (data.token) {
        const { token, seller: sellerData } = data;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(ROLE_KEY, 'seller');
        localStorage.setItem(USER_KEY, JSON.stringify(sellerData));
        setSessionExpiry('seller');
        setSeller(sellerData);
        setStaff(sellerData);
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
      setStaff(sellerData);
      setIsAuthenticated(true);
      connectSocket(token);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'OTP verification failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const sellerRegister = async (sellerData) => {
    try {
      const response = await api.post('/seller/register', sellerData);
      const { token, seller: newSeller } = response.data.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, 'seller');
      localStorage.setItem(USER_KEY, JSON.stringify(newSeller));
      setSessionExpiry('seller');
      setSeller(newSeller);
      setStaff(newSeller);
      setIsAuthenticated(true);
      connectSocket(token);
      toast.success('Seller registration successful!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Seller registration failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const sellerLogout = useCallback(() => {
    api.post('/seller/logout').catch(() => {});
    clearAllState();
    toast.success('Seller logged out successfully');
  }, [clearAllState]);

  const adminLogin = async (email, password) => {
    try {
      const response = await api.post('/admin/auth/login', { email, password });
      const data = response.data;
      
      // Check if OTP is required (new flow)
      if (data.requiresOTP) {
        return { success: true, requiresOTP: true, email: data.email };
      }
      
      // Direct login with token
      if (data.token) {
        const { token, admin: adminData } = data;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(ROLE_KEY, 'admin');
        localStorage.setItem(USER_KEY, JSON.stringify(adminData));
        setSessionExpiry('admin');
        setAdmin(adminData);
        setStaff(adminData);
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
      setStaff(adminData);
      setIsAuthenticated(true);
      connectSocket(token);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'OTP verification failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const sendOTP = async (phone) => {
    try {
      await api.post('/auth/send-otp', { phone });
      toast.success('OTP sent successfully!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to send OTP';
      toast.error(message);
      return { success: false, message };
    }
  };

  const verifyOTP = async (phone, otp) => {
    try {
      const response = await api.post('/auth/verify-otp', { phone, otp });
      toast.success('Phone verified successfully!');
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Invalid OTP';
      toast.error(message);
      return { success: false, message };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const role = localStorage.getItem(ROLE_KEY);
      let endpoint = '/auth/profile';
      if (role === 'seller') endpoint = '/seller/profile';
      if (role === 'admin') endpoint = '/admin/profile';

      const response = await api.put(endpoint, profileData);
      const updatedUser = response.data.data;

      if (role === 'seller') {
        setSeller(updatedUser);
      } else if (role === 'admin') {
        setAdmin(updatedUser);
      } else {
        setUser(updatedUser);
      }

      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      toast.success('Profile updated successfully!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update profile';
      toast.error(message);
      return { success: false, message };
    }
  };

  const staffLogin = async (email, password) => {
    try {
      const response = await api.post('/staff/auth/login', { email, password });
      const data = response.data;
      
      // Check if OTP is required
      if (data.requiresOTP) {
        return { success: true, requiresOTP: true, email: data.email };
      }
      
      // Direct login with token
      if (data.token) {
        const { token, staff: staffData } = data;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(ROLE_KEY, 'staff');
        localStorage.setItem(USER_KEY, JSON.stringify(staffData));
        setSessionExpiry('staff');
        setStaff(staffData);
        setIsAuthenticated(true);
        connectSocket(token);
        toast.success('Staff login successful!');
        return { success: true, token, staff: staffData };
      }
      
      return { success: false, message: 'Unexpected response from server' };
    } catch (error) {
      const message = error.response?.data?.message || 'Staff login failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const verifyStaffLoginOTP = async (email, otp) => {
    try {
      const response = await api.post('/staff/auth/verify-otp', { email, otp });
      const { token, staff: staffData } = response.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, 'staff');
      localStorage.setItem(USER_KEY, JSON.stringify(staffData));
      setSessionExpiry('staff');
      setStaff(staffData);
      setIsAuthenticated(true);
      connectSocket(token);
      return { success: true, staff: staffData };
    } catch (error) {
      const message = error.response?.data?.message || 'OTP verification failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const staffLogout = useCallback(() => {
    api.post('/staff/auth/logout').catch(() => {});
    clearAllState();
    toast.success('Logged out successfully');
  }, [clearAllState]);

  const value = {
    user,
    seller,
    admin,
    staff,
    isAuthenticated,
    loading,
    login,
    verifyLoginOTP,
    register,
    logout,
    sellerLogin,
    verifySellerLoginOTP,
    sellerRegister,
    sellerLogout,
    adminLogin,
    verifyAdminLoginOTP,
    staffLogin,
    verifyStaffLoginOTP,
    staffLogout,
    sendOTP,
    verifyOTP,
    updateProfile,
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
