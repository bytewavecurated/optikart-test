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
  staff: 24 * 60 * 60 * 1000,
  executive: 24 * 60 * 60 * 1000,
  manufacturer: 24 * 60 * 60 * 1000,
  manufacturerSeller: 24 * 60 * 60 * 1000,
  deliveryPartner: 24 * 60 * 60 * 1000,
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [seller, setSeller] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [staff, setStaff] = useState(null);
  const [executive, setExecutive] = useState(null);
  const [manufacturer, setManufacturer] = useState(null);
  const [manufacturerSeller, setManufacturerSeller] = useState(null);
  const [deliveryPartner, setDeliveryPartner] = useState(null);
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
    setDeliveryPartner(null);
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
    const userData = localStorage.getItem(USER_KEY);

    if (!token || !role) {
      setLoading(false);
      return;
    }

    if (!checkSessionExpiry()) {
      setLoading(false);
      return;
    }

    try {
      /*
       * The stored profile and the stored role are separate localStorage keys, and
       * signing in to another role without signing out overwrote one but not the
       * other. Restoring whatever blob was lying there under the new role is how a
       * manufacturer's account ended up rendered inside the staff panel. Trust the
       * cache only when the account in it is the kind the role claims - positive
       * evidence only, because "has no storeName" is also true of a manufacturer.
       */
      const matches = (obj) => {
        const r = obj?.role || obj?.accountType || '';
        switch (role) {
          case 'user': return r === '' || r === 'customer' || r === 'user';
          case 'staff': return r === 'staff' || r === 'admin';
          case 'admin': return r === 'admin';
          case 'seller': return r === 'seller' || (!!obj?.storeName && r !== 'manufacturer');
          case 'manufacturer': return r === 'manufacturer' || (!!obj?.companyName && !obj?.storeName);
          case 'manufacturerSeller': return r === 'retailer' || r === 'manufacturerSeller';
          case 'deliveryPartner': return r === 'deliveryPartner' || (!!obj?.vehicleType && !obj?.storeName);
          case 'executive': return r === 'executive' || (!!obj?.department && !obj?.storeName);
          default: return false;
        }
      };

      let userDataCache = userData;
      if (userDataCache) {
        let parsed = null;
        try { parsed = JSON.parse(userDataCache); } catch { parsed = null; }
        if (parsed && !matches(parsed)) {
          localStorage.removeItem(USER_KEY);
          userDataCache = null;
        }
      }

      // First, try to load user data from localStorage
      if (userDataCache) {
        const parsedData = JSON.parse(userDataCache);
        if (role === 'staff') {
          setStaff(parsedData);
        } else if (role === 'seller') {
          setSeller(parsedData);
        } else if (role === 'admin') {
          setAdmin(parsedData);
        } else if (role === 'executive') {
          setExecutive(parsedData);
        } else if (role === 'manufacturer') {
          setManufacturer(parsedData);
        } else if (role === 'manufacturerSeller') {
          setManufacturerSeller(parsedData);
        } else if (role === 'deliveryPartner') {
          setDeliveryPartner(parsedData);
        } else {
          setUser(parsedData);
        }
        setIsAuthenticated(true);
        connectSocket(token);
        setLoading(false);
        return;
      }

      // If no data in localStorage, fetch from API
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
      } else if (role === 'deliveryPartner') {
        response = await api.get('/delivery-partner/me');
        setDeliveryPartner(response.data.partner || response.data.deliveryPartner);
      } else if (role === 'staff') {
        response = await api.get('/auth/me');
        setStaff(response.data.user);
      } else {
        response = await api.get('/auth/me');
        setUser(response.data.user);
      }
      setIsAuthenticated(true);
      connectSocket(token);
    } catch (error) {
      console.error('Initialize auth error:', error);
      // Don't clear state if we have data in localStorage
      if (!userData) {
        clearAllState();
      }
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
      const payload = response.data.data || response.data;
      const { token, user: newUser } = payload;
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

  // Staff members are Users whose role is 'staff' with a matching StaffRole.
  // They authenticate through the normal auth endpoints; the difference is the
  // stored role and the landing area.
  const staffLogin = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const data = response.data;

      if (data.requiresOTP) {
        return { success: true, requiresOTP: true, email: data.email };
      }

      if (data.token) {
        const { token, user: userData } = data;
        if (userData && userData.role && userData.role !== 'staff' && userData.role !== 'admin') {
          return { success: false, message: 'This account is not a staff account.' };
        }
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(ROLE_KEY, 'staff');
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        setSessionExpiry('staff');
        setStaff(userData);
        setIsAuthenticated(true);
        connectSocket(token);
        toast.success('Staff login successful!');
        // Enrich with the StaffRole record so the workspace can show the
        // correct queues for this person's actual role.
        try {
          const overview = await api.get('/staff/overview');
          const enriched = { ...userData, staffRole: overview.data.role, permissions: overview.data.permissions || [] };
          localStorage.setItem(USER_KEY, JSON.stringify(enriched));
          setStaff(enriched);
          return { success: true, token, staff: enriched };
        } catch (e) {
          return { success: true, token, staff: userData };
        }
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
      const response = await api.post('/auth/verify-login-otp', { email, otp });
      const { token, user: userData } = response.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, 'staff');
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setSessionExpiry('staff');
      setStaff(userData);
      setIsAuthenticated(true);
      connectSocket(token);
      try {
        const overview = await api.get('/staff/overview');
        const enriched = { ...userData, staffRole: overview.data.role, permissions: overview.data.permissions || [] };
        localStorage.setItem(USER_KEY, JSON.stringify(enriched));
        setStaff(enriched);
        return { success: true, token, staff: enriched };
      } catch (e) {
        return { success: true, token, staff: userData };
      }
    } catch (error) {
      const message = error.response?.data?.message || 'OTP verification failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  /*
   * The partner console signed in by writing localStorage from its own page
   * component - no other role did that, and no React state was ever set. Any
   * guard that asked "who is this session?" instead of "what string is in
   * storage?" bounced a freshly signed-in partner straight back to the login
   * page.
   */
  const partnerSession = useCallback((data) => {
    const profile = data.partner || data.deliveryPartner || data.data || {};
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(ROLE_KEY, 'deliveryPartner');
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    setSessionExpiry('deliveryPartner');
    setDeliveryPartner(profile);
    setIsAuthenticated(true);
    connectSocket(data.token);
    return profile;
  }, [setSessionExpiry]);

  const partnerLogin = useCallback(async (email, password) => {
    try {
      const response = await api.post('/delivery-partner/login', { email, password });
      const data = response.data;
      if (data.requiresOTP) {
        return { success: true, requiresOTP: true, partnerId: data.partnerId || data.id };
      }
      if (!data.token) return { success: false, message: 'Unexpected response from the server.' };
      return { success: true, partner: partnerSession(data) };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
  }, [partnerSession]);

  const partnerVerifyOTP = useCallback(async (partnerId, otp) => {
    try {
      const response = await api.post('/delivery-partner/verify-login-otp', { partnerId, otp });
      const data = response.data;
      if (!data.token) return { success: false, message: data.message || 'OTP verification failed' };
      partnerSession(data);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'OTP verification failed' };
    }
  }, [partnerSession]);

  const partnerLogout = useCallback(() => {
    clearAllState();
    toast.success('Logged out successfully');
  }, [clearAllState]);

  const staffLogout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    clearAllState();
    toast.success('Logged out successfully');
  }, [clearAllState]);

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    clearAllState();
    toast.success('Logged out successfully');
  }, [clearAllState]);

  /**
   * Public seller sign-up. This was previously unwired: the registration screen
   * called a function that did not exist, so a new seller could never join.
   */
  const sellerRegister = async (data) => {
    try {
      const response = await api.post('/seller/register', {
        name: data.ownerName,
        storeName: data.businessName,
        storeDescription: data.storeDescription || '',
        email: data.email,
        phone: data.phone,
        password: data.password,
        gstNumber: data.gstNumber || '',
        panNumber: data.panNumber || '',
        aadharNumber: data.aadharNumber || '',
                // The store's position decides which orders can be routed here; the
        // PIN code is resolved to coordinates server side, and browser
        // coordinates are preferred when the applicant allows the map prompt.
        storeAddress: {
          street: data.street || '',
          city: data.city || '',
          state: data.state || '',
          pincode: data.pincode || '',
          country: 'India',
          lat: data.lat,
          lng: data.lng
        },
        bankAccount: data.bankAccount
      });

      const payload = response.data;
      // Registration returns an OTP challenge; the seller verifies before the
      // account is usable, so we hand the phone step back to the caller.
      return {
        success: true,
        sellerId: payload.sellerId,
        message: payload.message,
        needsPhoneVerify: true
      };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const verifySellerPhoneOTP = async (sellerId, otp) => {
    try {
      const { data } = await api.post('/seller/verify-phone', { sellerId, otp });
      toast.success('Phone verified. You can now sign in.');
      return { success: true, ...data };
    } catch (error) {
      const message = error.response?.data?.message || 'Verification failed';
      toast.error(message);
      return { success: false, message };
    }
  };

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

  /*
   * Every role login shares one `isAuthenticated` flag, so signing in as a
   * seller or a delivery partner made the storefront header claim a customer was
   * logged in - offering My Profile / Orders / Wishlist against an account that
   * does not exist. The roles are exclusive by construction, so a session
   * belongs to exactly one of them.
   */
  const activeRole = seller ? 'seller'
    : admin ? 'admin'
    : staff ? 'staff'
    : executive ? 'executive'
    : manufacturer ? 'manufacturer'
    : manufacturerSeller ? 'manufacturerSeller'
    : deliveryPartner ? 'deliveryPartner'
    : user ? 'customer'
    : null;

  const isCustomerAuthenticated = isAuthenticated && activeRole === 'customer';

  const roleConsole = {
    seller: { label: 'Seller Console', path: '/seller/dashboard' },
    admin: { label: 'Admin Panel', path: '/admin' },
    staff: { label: 'Staff Workspace', path: '/staff' },
    executive: { label: 'Executive Desk', path: '/executive/dashboard' },
    manufacturer: { label: 'Manufacturer Portal', path: '/manufacturer/dashboard' },
    manufacturerSeller: { label: 'Manufacturer-Seller Portal', path: '/manufacturer-seller/dashboard' },
    deliveryPartner: { label: 'Partner Dashboard', path: '/delivery-partner/dashboard' }
  }[activeRole] || null;

  const value = {
    user,
    activeRole,
    isCustomerAuthenticated,
    roleConsole,
    seller,
    admin,
    staff,
    executive,
    manufacturer,
    manufacturerSeller,
    deliveryPartner,
    isAuthenticated,
    loading,
    login,
    verifyLoginOTP,
    register,
    logout,
    sellerLogin,
    verifySellerLoginOTP,
    sellerRegister,
    verifySellerPhoneOTP,
    partnerLogin,
    partnerVerifyOTP,
    partnerLogout,
    sellerLogout,
    staffLogin,
    verifyStaffLoginOTP,
    staffLogout,
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
