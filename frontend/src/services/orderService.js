import api from './api';

export const orderService = {
  getOrders: () => api.get('/admin/orders').then(res => res.data),
  updateOrderStatus: (orderId, status) => 
    api.patch(`/admin/orders/${orderId}/status`, { status }).then(res => res.data),
};