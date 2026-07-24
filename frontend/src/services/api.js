import axios from 'axios';

// Base API URL
const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

// Axios Instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});


// ================= REQUEST INTERCEPTOR =================

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);


// ================= RESPONSE INTERCEPTOR =================

api.interceptors.response.use(
  (response) => response,
  (error) => {

    if (error.response) {

      console.error('API Error:', error.response.data);

      if (error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }

    } else {

      console.error('Network Error:', error.message);

    }

    return Promise.reject(error);

  }
);


// ================= AUTH =================

export const authAPI = {

  register: (data) =>
    api.post('/auth/register', data),

  login: (data) =>
    api.post('/auth/login', data),

};


// ================= CATEGORY =================

export const categoryAPI = {

  // Student Menu Categories
  getAll: () =>
    api.get('/food/categories'),


  // Admin Category Management
  getAdminCategories: () =>
    api.get('/categories'),


  // Add Category with image
  createCategory: (name, image_url) =>
    api.post('/categories', {
      name,
      image_url,
    }),


  // Edit Category with image
  updateCategory: (id, name, image_url) =>
    api.put(`/categories/${id}`, {
      name,
      image_url,
    }),


  // Delete Category
  deleteCategory: (id) =>
    api.delete(`/categories/${id}`),

};


// ================= FOOD =================

export const foodAPI = {

  getItems: (params) =>
    api.get('/food/items', { params }),

  getPopular: () =>
    api.get('/food/popular'),

};


// ================= ORDERS =================

export const orderAPI = {

  placeOrder: (data) =>
    api.post('/orders', data),

  getOrders: () =>
    api.get('/orders'),

  getOrder: (id) =>
    api.get(`/orders/${id}`),

  cancelOrder: (id) =>
    api.patch(`/orders/${id}/cancel`),

};


// ================= PAYMENT (RAZORPAY) =================

export const paymentAPI = {

  // Create Razorpay Order
  createOrder: (data) =>
    api.post("/payment/create-order", data),
  verifyPayment: (data) =>
    api.post('/payment/verify', data),
};


// ================= USER =================

export const userAPI = {

  getProfile: () =>
    api.get('/user/profile'),

  updateProfile: (data) =>
    api.put('/user/profile', data),

};


// ================= FAVORITES =================

export const favoriteAPI = {

  getAll: () =>
    api.get("/favorites"),

  add: (food_item_id) =>
    api.post("/favorites", {
      food_item_id,
    }),

  remove: (food_item_id) =>
    api.delete(`/favorites/${food_item_id}`),

};


// ================= ADMIN =================

export const adminAPI = {

  // Orders
  getOrders: () =>
    api.get('/admin/orders'),

  getHistory: (params) =>
    api.get("/admin/history", {
      params,
    }),

  updateOrderStatus: (id, status) =>
    api.patch(`/admin/orders/${id}/status`, {
      status,
    }),


  // Cash Payment Receive
  markPaymentReceived: (id) =>
    api.patch(`/admin/orders/${id}/payment`),


  // Menu Management
  getMenu: () =>
    api.get('/admin/menu'),


  createMenu: (data) =>
    api.post('/admin/menu', data),


  updateMenu: (id, data) =>
    api.put(`/admin/menu/${id}`, data),


  deleteMenu: (id) =>
    api.delete(`/admin/menu/${id}`),


  // Stock Toggle
  updateAvailability: (id, available) =>
    api.patch(`/admin/menu/${id}/availability`, {
      available,
    }),

  // Refund Order
  refundOrder: (id, data) =>
    api.post(`/admin/orders/${id}/refund`, data),

};

// ================= ANALYTICS =================

export const analyticsAPI = {

  getDashboard: (params) =>
    api.get("/analytics/dashboard", {
      params,
    }),

  getDashboardSummary: () =>
    api.get("/analytics/dashboard-summary"),

  getRevenue: (params) =>
    api.get("/analytics/revenue", {
      params,
    }),

  getOrders: () =>
    api.get("/analytics/orders"),

};


// ================= NOTIFICATIONS =================

export const notificationAPI = {

  // Get all notifications
  getNotifications: (page = 1, limit = 10) =>
    api.get("/notifications", {
      params: {
        page,
        limit,
      },
    }),

  // Get unread count
  getUnreadCount: () =>
    api.get("/notifications/unread-count"),

  // Mark single notification as read
  markAsRead: (id) =>
    api.put(`/notifications/${id}/read`),

  // Mark all notifications as read
  markAllAsRead: () =>
    api.put("/notifications/read-all"),

  // Delete notification
  deleteNotification: (id) =>
    api.delete(`/notifications/${id}`),

};


// ================= UPLOAD =================

export const uploadAPI = {

  uploadImage: (file) => {

    const formData = new FormData();

    formData.append('file', file);


    return api.post('/upload', formData, {

      headers: {
        'Content-Type': 'multipart/form-data',
      },

    });

  },

};


// Export Axios Instance

export default api;