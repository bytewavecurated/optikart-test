import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('optikart_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const role = localStorage.getItem('optikart_role');
      localStorage.removeItem('optikart_token');
      localStorage.removeItem('optikart_role');
      localStorage.removeItem('optikart_user');
      localStorage.removeItem('optikart_session_expiry');

      if (role === 'seller') {
        window.location.href = '/seller/login';
      } else if (role === 'admin') {
        window.location.href = '/admin/login';
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  sendOTP: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOTP: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/update-profile', data),
  logout: () => api.post('/auth/logout'),
  // Prescriptions
  getPrescriptions: () => api.get('/auth/prescriptions'),
  addPrescription: (data) => api.post('/auth/prescriptions', data),
  updatePrescription: (id, data) => api.put(`/auth/prescriptions/${id}`, data),
  deletePrescription: (id) => api.delete(`/auth/prescriptions/${id}`),
  // Addresses
  getAddresses: () => api.get('/auth/addresses'),
  addAddress: (data) => api.post('/auth/addresses', data),
  updateAddress: (id, data) => api.put(`/auth/addresses/${id}`, data),
  deleteAddress: (id) => api.delete(`/auth/addresses/${id}`),
};

export const seller = {
  register: (data) => api.post('/seller/register', data),
  login: (email, password) => api.post('/seller/login', { email, password }),
  verifyOTP: (sellerId, otp) => api.post('/seller/verify-otp', { sellerId, otp }),
  getMe: () => api.get('/seller/me'),
  getOrders: (params) => api.get('/seller/orders', { params }),
  updateOrderStatus: (orderId, status) => api.put(`/seller/orders/${orderId}/status`, { status }),
  getAnalytics: (period) => api.get('/seller/analytics', { params: { period } }),
  getPickups: (params) => api.get('/seller/pickups', { params }),
  subscribe: (plan) => api.post('/seller/subscribe', { plan }),
  setOffer: (productId, data) => api.put(`/seller/products/${productId}/offer`, data),
  removeOffer: (productId) => api.delete(`/seller/products/${productId}/offer`),
  // Inventory management
  getInventory: (params) => api.get('/seller/inventory', { params }),
  addVariant: (productId, data) => api.post(`/seller/inventory/${productId}/variants`, data),
  updateVariant: (productId, variantId, data) => api.put(`/seller/inventory/${productId}/variants/${variantId}`, data),
  deleteVariant: (productId, variantId) => api.delete(`/seller/inventory/${productId}/variants/${variantId}`),
  bulkUpdateVariants: (updates) => api.post('/seller/inventory/bulk-variants', { updates }),
  // Returns management
  getReturns: (params) => api.get('/seller/returns', { params }),
  approveReturn: (returnId, data) => api.post(`/seller/returns/${returnId}/approve`, data),
  rejectReturn: (returnId, data) => api.post(`/seller/returns/${returnId}/reject`, data),
  // Analytics
  getInventoryAnalytics: (params) => api.get('/inventory-analytics/seller', { params }),
  getInventoryHealth: () => api.get('/inventory-analytics/seller/health'),
  getReturnAnalytics: (params) => api.get('/return-analytics/seller', { params }),
};

export const products = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  uploadImages: (id, formData) =>
    api.post(`/products/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getBrands: () => api.get('/products/brands'),
  getByCategory: (category, params) => api.get(`/products/category/${category}`, { params }),
  getOffers: (params) => api.get('/products/offers', { params }),
  getRandom: (params) => api.get('/products/random', { params }),
  getFilters: () => api.get('/products/filters'),
  getRelated: (id) => api.get(`/products/${id}/related`),
};

export const orders = {
  create: (data) => api.post('/orders', data),
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  cancel: (id, reason) => api.put(`/orders/${id}/cancel`, { reason }),
  return: (id, data) => api.put(`/orders/${id}/return`, data),
  review: (id, data) => api.post(`/orders/${id}/review`, data),
};

export const cart = {
  get: () => api.get('/cart'),
  add: (data) => api.post('/cart', data),
  update: (itemId, data) => api.put(`/cart/${itemId}`, data),
  remove: (itemId) => api.delete(`/cart/${itemId}`),
  clear: () => api.delete('/cart'),
};

export const payment = {
  createOrder: (data) => api.post('/payment/create-order', data),
  verify: (data) => api.post('/payment/verify', data),
};

export const wishlist = {
  get: () => api.get('/wishlist'),
  add: (productId) => api.post('/wishlist', { productId }),
  remove: (productId) => api.delete(`/wishlist/${productId}`),
};

export const coupons = {
  getAll: () => api.get('/coupons'),
  validate: (code) => api.post('/coupons/validate', { code }),
};

export const blog = {
  getAll: (params) => api.get('/blog', { params }),
  getBySlug: (slug) => api.get(`/blog/${slug}`),
  create: (data) => api.post('/blog', data),
  update: (id, data) => api.put(`/blog/${id}`, data),
  delete: (id) => api.delete(`/blog/${id}`),
  comment: (id, data) => api.post(`/blog/${id}/comment`, data),
  like: (id) => api.post(`/blog/${id}/like`),
};

export const help = {
  getAll: () => api.get('/help'),
  getByCategory: (category) => api.get(`/help/${category}`),
  getById: (id) => api.get(`/help/article/${id}`),
  contact: (data) => api.post('/help/contact', data),
};

export const admin = {
  dashboard: () => api.get('/admin/dashboard'),
  getUsers: (params) => api.get('/admin/users', { params }),
  getUserById: (id) => api.get(`/admin/users/${id}`),
  getUserOrders: (id) => api.get(`/admin/users/${id}/orders`),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  banUser: (id, data) => api.put(`/admin/users/${id}/ban`, data),
  getSellers: (params) => api.get('/admin/sellers', { params }),
  getSellerById: (id) => api.get(`/admin/sellers/${id}`),
  getSellerProducts: (id) => api.get(`/admin/sellers/${id}/products`),
  getSellerOrders: (id) => api.get(`/admin/sellers/${id}/orders`),
  verifySeller: (id, status) => api.put(`/admin/sellers/${id}/verify`, { status }),
  deleteSeller: (id) => api.delete(`/admin/sellers/${id}`),
  banSeller: (id, data) => api.put(`/admin/sellers/${id}/ban`, data),
  getOrders: (params) => api.get('/admin/orders', { params }),
  getRevenue: (params) => api.get('/admin/revenue', { params }),
  createStaff: (data) => api.post('/admin/staff', data),
  getStaff: () => api.get('/admin/staff'),
  deleteStaff: (id) => api.delete(`/admin/staff/${id}`),
  updateStaffPermissions: (id, permissions) => api.put(`/admin/staff/${id}/permissions`, { permissions }),
  getCoupons: () => api.get('/admin/coupons'),
  createCoupon: (data) => api.post('/admin/coupons', data),
  updateCoupon: (id, data) => api.put(`/admin/coupons/${id}`, data),
  deleteCoupon: (id) => api.delete(`/admin/coupons/${id}`),
  getSellerPayouts: (params) => api.get('/admin/seller-payouts', { params }),
  getDelivery: (params) => api.get('/admin/delivery', { params }),
  getPickups: (params) => api.get('/admin/pickups', { params }),
  // Executives
  getExecutives: () => api.get('/admin/executives'),
  createExecutive: (data) => api.post('/admin/executives', data),
  updateExecutive: (id, data) => api.put(`/admin/executives/${id}`, data),
  deleteExecutive: (id) => api.delete(`/admin/executives/${id}`),
  banExecutive: (id, data) => api.put(`/admin/executives/${id}/ban`, data),
  // Manufacturers
  getManufacturers: () => api.get('/admin/manufacturers'),
  createManufacturer: (data) => api.post('/admin/manufacturers', data),
  updateManufacturer: (id, data) => api.put(`/admin/manufacturers/${id}`, data),
  deleteManufacturer: (id) => api.delete(`/admin/manufacturers/${id}`),
  banManufacturer: (id, data) => api.put(`/admin/manufacturers/${id}/ban`, data),
  getManufacturerProducts: (id) => api.get(`/admin/manufacturers/${id}/products`),
  getManufacturerSellers: (id) => api.get(`/admin/manufacturers/${id}/sellers`),
  // Commissions
  getCommissions: () => api.get('/admin/commissions'),
  // Return Analytics
  getReturnAnalytics: (params) => api.get('/return-analytics/admin', { params }),
};

export const notifications = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const saleEvents = {
  getAll: () => api.get('/sale-events'),
  getById: (id) => api.get(`/sale-events/${id}`),
  create: (data) => api.post('/sale-events', data),
  update: (id, data) => api.put(`/sale-events/${id}`, data),
  delete: (id) => api.delete(`/sale-events/${id}`),
  toggle: (id) => api.post(`/sale-events/${id}/toggle`),
};

export const banners = {
  getActive: () => api.get('/banners/active'),
  getAll: () => api.get('/banners'),
  create: (data) => api.post('/banners', data),
  update: (id, data) => api.put(`/banners/${id}`, data),
  delete: (id) => api.delete(`/banners/${id}`),
};

export const chatbot = {
  sendMessage: (message, context) => api.post('/chatbot/message', { message, context }),
  getKnowledgeBase: () => api.get('/chatbot/knowledge'),
  updateKnowledgeBase: (data) => api.put('/chatbot/knowledge', data),
  getSuggestions: (context) => api.post('/chatbot/suggestions', { context }),
};

export const deliveryPartner = {
  login: (email, password) => api.post('/delivery-partner/login', { email, password }),
  verifyOTP: (partnerId, otp) => api.post('/delivery-partner/verify-login-otp', { partnerId, otp }),
  getMe: () => api.get('/delivery-partner/me'),
  updateLocation: (latitude, longitude) => api.post('/delivery-partner/location', { latitude, longitude }),
  completeDelivery: (orderId) => api.post(`/delivery-partner/complete/${orderId}`),
  withdraw: (amount) => api.post('/delivery-partner/withdraw', { amount }),
  // Route optimization
  optimizeRoute: () => api.get('/delivery-route/optimize'),
  getRouteUpdates: (lat, lon) => api.get('/delivery-route/updates', { params: { lat, lon } }),
};

export const lensConfiguration = {
  create: (data) => api.post('/lens-configuration', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getByProduct: (productId) => api.get(`/lens-configuration/${productId}`),
  update: (id, data) => api.put(`/lens-configuration/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/lens-configuration/${id}`),
  getPricing: () => api.get('/lens-configuration/pricing/info'),
};

export const returns = {
  create: (data) => api.post('/returns', data),
  getUserReturns: () => api.get('/returns/user'),
  getSellerReturns: () => api.get('/returns/seller'),
  getAll: (params) => api.get('/returns', { params }),
  approve: (id, data) => api.post(`/returns/${id}/approve`, data),
  reject: (id, data) => api.post(`/returns/${id}/reject`, data),
  markPickedUp: (id) => api.post(`/returns/${id}/picked-up`),
  markReceived: (id) => api.post(`/returns/${id}/received`),
  processRefund: (id) => api.post(`/returns/${id}/refund`),
  // Customer return portal
  checkEligibility: (orderId) => api.get(`/customer-returns/eligibility/${orderId}`),
  uploadImages: (returnId, formData) => api.post(`/customer-returns/${returnId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getMyReturns: (params) => api.get('/customer-returns/my-returns', { params }),
  cancelReturn: (returnId) => api.post(`/customer-returns/${returnId}/cancel`),
};

export default api;
