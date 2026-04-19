import api from './api';

export const menuService = {
  getMenu: () => api.get('/admin/menu').then(res => res.data),
  addMenuItem: (data) => api.post('/admin/menu', data).then(res => res.data),
  updateMenuItem: (id, data) => api.put(`/admin/menu/${id}`, data).then(res => res.data),
  deleteMenuItem: (id) => api.delete(`/admin/menu/${id}`).then(res => res.data),
};