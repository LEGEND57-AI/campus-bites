// Student-facing names for internal order statuses. "Accepted" is an
// internal step (cash payment received, kitchen not started yet), so it is
// shown to the student as the same stage as "Pending".
const ORDER_STATUS_LABELS = {
  pending: "Order Placed",
  accepted: "Order Placed",
  preparing: "Preparing",
  ready: "Ready for Pickup",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Cancelled",
  refunded: "Refund Initiated",
};

export const getOrderStatusLabel = (status) =>
  ORDER_STATUS_LABELS[String(status || "").toLowerCase()] || status;
