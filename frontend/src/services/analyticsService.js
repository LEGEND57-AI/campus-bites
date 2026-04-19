import api from './api';

export const analyticsService = {
  getAnalytics: () => api.get('/admin/analytics').then(res => res.data),
};