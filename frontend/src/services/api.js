import axios from 'axios';

// Base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 🔐 Attach token automatically
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

// ❌ Global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('API Error:', error.response.data);

      // 🔥 OPTIONAL: Auto logout on 401
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

// ---------------- AUTH ----------------
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
};

// ---------------- CATEGORY ----------------
export const categoryAPI = {
  getAll: () => api.get('/food/categories'),
};

// ---------------- FOOD ----------------
export const foodAPI = {
  getItems: (params) => api.get('/food/items', { params }),
};

// ---------------- ORDERS ----------------
export const orderAPI = {
  placeOrder: (items) => api.post('/orders', { items }),
  getOrders: () => api.get('/orders'),
};

// ---------------- USER ----------------
export const userAPI = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data) => api.put('/user/profile', data),
};

// ---------------- ADMIN ----------------
export const adminAPI = {

  // 🔥 ANALYTICS (UPDATED WITH RANGE)
  getAnalytics: (range = "7days") =>
    api.get(`/admin/analytics?range=${range}`),

  // Orders
  getOrders: () => api.get('/admin/orders'),

  updateOrderStatus: (id, status) =>
    api.patch(`/admin/orders/${id}/status`, { status }),

  // Menu
  getMenu: () => api.get('/admin/menu'),

  createMenu: (data) => api.post('/admin/menu', data),

  updateMenu: (id, data) =>
    api.put(`/admin/menu/${id}`, data),

  deleteMenu: (id) =>
    api.delete(`/admin/menu/${id}`),
};

// ---------------- 🔥 UPLOAD ----------------
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

export default api;