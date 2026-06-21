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

};


// ================= ORDERS =================

export const orderAPI = {

  placeOrder: (data) =>
    api.post('/orders', data),

  getOrders: () =>
    api.get('/orders'),

};


// ================= PAYMENT (RAZORPAY) =================

export const paymentAPI = {

  // Create Razorpay Order
  createOrder: (amount) =>
    api.post('/payment/create-order', {
      amount,
    }),
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


// ================= ADMIN =================

export const adminAPI = {

  // Analytics
  getAnalytics: (range = 'today') =>
    api.get(`/admin/analytics?range=${range}`),


  // Orders
  getOrders: () =>
    api.get('/admin/orders'),


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