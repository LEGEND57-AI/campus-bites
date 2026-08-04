export const SocketEvents = {
  // Connection
  CONNECT: "connect",
  DISCONNECT: "disconnect",

  // Authentication
  AUTHENTICATE: "authenticate",
  AUTH_SUCCESS: "auth-success",
  AUTH_ERROR: "auth-error",

  // Menu
  MENU_UPDATED: "menu_updated",

  // Orders
  ORDER_CREATED: "order-created",
  ORDER_ACCEPTED: "order-accepted",
  ORDER_PREPARING: "order-preparing",
  ORDER_READY: "order-ready",
  ORDER_COMPLETED: "order-completed",
  ORDER_CANCELLED: "order-cancelled",
  ORDER_REJECTED: "order-rejected",
  ORDER_REFUNDED: "order-refunded",
  ORDER_UPDATED: "order-updated",

  // Notifications
  NOTIFICATION_NEW: "notification-new",
  NOTIFICATION_READ: "notification-read",

  // Analytics
  ANALYTICS_UPDATED: "analytics-updated",

  // Rooms
  JOIN_ROOM: "join-room",
  LEAVE_ROOM: "leave-room",

  // Errors
  ERROR: "error",
};