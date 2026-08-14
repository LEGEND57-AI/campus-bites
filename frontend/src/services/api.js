import axios from 'axios';

// Base API URL
const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

// ================= ACCESS TOKEN STORE =================
// The access token lives in memory only, never in localStorage. It's a
// live bearer credential -- anything with JS execution on the page
// (e.g. a future XSS bug) can read localStorage, but it can't read a
// plain module-level variable from outside this module's own code.
// The refresh token stays exactly where it always was: an httpOnly
// cookie, invisible to JS either way.
//
// The tradeoff: a page reload wipes this variable, so on every fresh
// load the app has to silently re-authenticate using the httpOnly
// refresh cookie before it has a usable access token again. See
// bootstrapSession() below.

let accessToken = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;

  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }

  // AuthContext (and anything else that needs to react to the token
  // changing, like SocketProvider) listens for this.
  window.dispatchEvent(
    new CustomEvent("auth:token-refreshed", {
      detail: token,
    })
  );
}

// ================= TOKEN REFRESH =================

let isRefreshing = false;

let failedQueue = [];

const processQueue = (token = null, error = null) => {

  failedQueue.forEach((promise) => {

    if (error) {

      promise.reject(error);

    } else {

      promise.resolve(token);

    }

  });

  failedQueue = [];

};

// Axios Instance
const api = axios.create({
  baseURL: API_URL,

  withCredentials: true,

  headers: {
    "Content-Type": "application/json",
  },
});

// ================= REFRESH CLIENT =================

const refreshClient = axios.create({
  baseURL: API_URL,

  withCredentials: true,

  headers: {
    "Content-Type": "application/json",
  },
});

// ================= SILENT SESSION BOOTSTRAP =================
// Called once when the app first loads. Memory holds no access token
// yet at this point (a reload always wipes it), so this uses the
// httpOnly refresh cookie -- which the browser sends automatically --
// to fetch a fresh one. If there's no valid session, this simply
// fails and the caller treats it as "not logged in".
//
// React 18 StrictMode (and any other accidental double-mount) can invoke
// the caller of this function twice in the same tick. Without guarding
// against that, both calls would POST the SAME refresh-token cookie to the
// backend; the backend's compare-and-swap rotation (by design) lets only
// one of them succeed and 401s the other, which looked from here like a
// spurious logout even though a valid session existed the whole time.
//
// bootstrapInFlight holds the one outstanding request so concurrent callers
// share it instead of issuing a second one. It is intentionally a plain
// module-level variable, not React state -- this file has no React
// dependency, and the guard must be visible to every caller regardless of
// which component tree they're in.
let bootstrapInFlight = null;

export function bootstrapSession() {
  if (bootstrapInFlight) {
    return bootstrapInFlight;
  }

  bootstrapInFlight = (async () => {
    try {
      const { data } = await refreshClient.post("/session/refresh");
      setAccessToken(data.accessToken);
      return data.accessToken;
    } finally {
      // Cleared on both success and failure so a later, genuinely
      // independent bootstrap attempt (e.g. after logging back in) is
      // never permanently stuck reusing a stale settled promise.
      bootstrapInFlight = null;
    }
  })();

  return bootstrapInFlight;
}


// ================= REQUEST INTERCEPTOR =================

api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);


// ================= RESPONSE INTERCEPTOR =================

api.interceptors.response.use(

  (response) => response,

  async (error) => {

    const originalRequest = error.config || {};

    if (

      error.response?.status !== 401 ||

      originalRequest._retry

    ) {

      return Promise.reject(error);

    }

    originalRequest._retry = true;

    // ================= ALREADY REFRESHING =================

    if (isRefreshing) {

      return new Promise((resolve, reject) => {

        failedQueue.push({
          resolve,
          reject,
        });

      }).then((token) => {

        originalRequest.headers.Authorization =
          `Bearer ${token}`;

        return api(originalRequest);

      });

    }

    isRefreshing = true;

    try {

      // ================= REFRESH ACCESS TOKEN =================

      const { data } =
        await refreshClient.post("/session/refresh");

      const newAccessToken =
        data.accessToken;

      setAccessToken(newAccessToken);

      originalRequest.headers.Authorization =
        `Bearer ${newAccessToken}`;

      processQueue(newAccessToken);

      return api(originalRequest);

    } catch (refreshError) {

      processQueue(null, refreshError);

      setAccessToken(null);
      localStorage.removeItem("user");

      window.location.href = "/login";

      return Promise.reject(refreshError);

    } finally {

      isRefreshing = false;

    }

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

  getOrders: (
    page = 1,
    limit = 20
  ) =>
    api.get("/orders", {
      params: {
        page,
        limit,
      },
    }),

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


// ================= PUSH =================

export const pushAPI = {

  subscribe: (subscription) =>
    api.post(
      "/push/subscribe",
      subscription
    ),

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