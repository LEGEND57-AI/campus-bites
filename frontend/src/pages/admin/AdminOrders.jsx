import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { adminAPI } from "../../services/api";

// ---------------- Constants ----------------
const STATUS_STYLES = {
  Pending: "bg-yellow-100 text-yellow-700",
  Accepted: "bg-blue-100 text-blue-700",
  Preparing: "bg-purple-100 text-purple-700",
  Ready: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

const PAYMENT_STYLES = {
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
};

const REFRESH_INTERVAL = 30000;

// ---------------- Formatting Helpers ----------------
const getStatusColor = (status) =>
  STATUS_STYLES[status] || "bg-gray-100 text-gray-700";
const getPaymentColor = (status) =>
  PAYMENT_STYLES[status] || "bg-gray-100 text-gray-700";
const formatAmount = (amount) => `₹${Number(amount || 0).toFixed(2)}`;
const formatDate = (date) => {
  if (!date) return "Date unavailable";
  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatToken = (order) =>
  order.token_number
    ? `#${String(order.token_number).padStart(2, "0")}`
    : `#${order.id}`;

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const rateLimitedRef = useRef(false);

  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await adminAPI.getOrders();
      if (!Array.isArray(data)) {
        setOrders([]);
        toast.error(data?.error || "Invalid orders data");
        return;
      }
      setOrders(data);
      rateLimitedRef.current = false;
    } catch (err) {
      console.error("Failed to fetch orders:", err);

      if (err?.response?.status === 429) {
        rateLimitedRef.current = true;
        const retryAfter = err?.response?.data?.retryAfter;
        toast.error(
          retryAfter
            ? `Too many requests. Retrying in ${retryAfter}s.`
            : "Too many requests. Please wait a moment."
        );
      } else {
        toast.error("Failed to fetch orders");
        setOrders([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    const interval = setInterval(() => {
      if (!rateLimitedRef.current) {
        fetchOrders();
      }
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchOrders]);

  const updateStatus = async (orderId, status) => {
    const result = await Swal.fire({
      title: "Update order status?",
      text: `Change this token status to ${status}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#ef4444",
      confirmButtonText: "Yes, update",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      await adminAPI.updateOrderStatus(orderId, status);
      toast.success(`Order marked as ${status}`);
      fetchOrders();
    } catch (err) {
      console.error("Failed to update order status:", err);
      toast.error("Failed to update order status");
    }
  };

  const receivePayment = async (orderId) => {
    const result = await Swal.fire({
      title: "Confirm cash payment?",
      html: "<b>Confirm cash payment received?</b>",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#ef4444",
      confirmButtonText: "Yes, payment received",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      await adminAPI.markPaymentReceived(orderId);
      toast.success("Cash payment received successfully");
      fetchOrders();
    } catch (err) {
      console.error("Failed to update payment:", err);
      toast.error("Failed to update payment");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-32 rounded-xl bg-gray-200 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!orders.length) return <p className="text-gray-500">No orders yet.</p>;

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold mb-6">Manage Orders</h2>

      <div className="space-y-4">
        {orders.map((order) => {
          const isCashPaymentPending =
            order.payment_method === "CASH" &&
            order.payment_status === "PENDING";
          const isPaid = order.payment_status === "PAID";

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-white shadow-md p-4 sm:p-5"
            >
              <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[150px_1fr_240px]">
                {/* ================= TOKEN + CUSTOMER (mobile: side by side) ================= */}

                <div className="flex sm:block gap-4 sm:gap-0">

                  {/* TOKEN CARD */}
                  <div className="shrink-0 w-[110px] sm:w-auto rounded-2xl border border-blue-100 bg-blue-50 p-3 sm:p-4 text-center">
                    <div className="mb-1 sm:mb-2 text-2xl sm:text-4xl">🍔</div>

                    <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-500">
                      Token
                    </p>

                    <h2 className="mt-1 text-xl sm:text-3xl font-bold text-blue-600">
                      {formatToken(order)}
                    </h2>

                    <span
                      className={`mt-2 sm:mt-3 inline-block rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-sm font-semibold ${getStatusColor(order.status)}`}
                    >
                      {order.status || "Unknown"}
                    </span>

                    <p className="mt-2 sm:mt-3 text-[10px] sm:text-xs text-gray-500">
                      {formatDate(order.created_at)}
                    </p>
                  </div>

                  {/* CUSTOMER INFO — visible next to token on mobile only */}
                  <div className="flex flex-col justify-center gap-2 sm:hidden min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0">👤</span>
                      <h3 className="text-base font-bold text-gray-900 truncate">
                        {order.user?.name || "Unknown"}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">📞</span>
                      <p className="text-sm text-gray-700 truncate">
                        +91 {order.user?.phone || "Not Available"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ================= CENTER COLUMN ================= */}

                <div className="space-y-4 min-w-0">
                  {/* Customer Info — desktop only (mobile shown above) */}

                  <div className="hidden sm:flex items-center justify-between gap-4">
                    <div className="flex items-center gap-8">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">👤</span>
                        <h3 className="text-2xl font-bold text-gray-900">
                          {order.user?.name || "Unknown"}
                        </h3>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-lg">📞</span>
                        <p className="whitespace-nowrap text-base text-gray-700">
                          +91 {order.user?.phone || "Not Available"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ITEMS BOX */}

                  <div className="overflow-hidden rounded-2xl border border-gray-200">
                    <div className="border-b bg-gray-50 px-3 sm:px-4 py-2 sm:py-3">
                      <h4 className="text-sm sm:text-base font-semibold text-gray-800">
                        🛍 Items Ordered
                      </h4>
                    </div>

                    <div className="divide-y">
                      {order.order_items?.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 gap-2"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <span className="shrink-0 rounded-lg bg-blue-100 px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-semibold text-blue-700">
                              {item.quantity}x
                            </span>

                            <span className="truncate text-sm sm:text-base font-semibold text-gray-900">
                              {item.food_items?.name || "Unknown Item"}
                            </span>
                          </div>

                          <span className="shrink-0 text-sm sm:text-base font-bold text-gray-800">
                            {formatAmount(item.price_at_time * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PAYMENT BADGES */}

                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    <span className="rounded-full bg-blue-100 px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold text-blue-700">
                      {order.payment_method === "CASH"
                        ? "💵 CASH"
                        : "💳 ONLINE"}
                    </span>

                    <span
                      className={`rounded-full px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold ${getPaymentColor(order.payment_status)}`}
                    >
                      {order.payment_status || "UNKNOWN"}
                    </span>
                  </div>
                </div>

                {/* ================= RIGHT COLUMN ================= */}

                <div className="flex flex-col gap-3 sm:gap-4">
                  {/* ACTION BUTTONS */}

                  {(isCashPaymentPending ||
                    (isPaid &&
                      ["Pending", "Accepted", "Preparing"].includes(
                        order.status,
                      ))) && (
                    <div className="w-full">
                      {isCashPaymentPending && (
                        <button
                          type="button"
                          onClick={() => receivePayment(order.id)}
                          className="w-full rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white shadow-md transition hover:scale-105"
                        >
                          🪙 Receive Payment
                        </button>
                      )}

                      {isPaid && order.status === "Pending" && (
                        <button
                          type="button"
                          onClick={() => updateStatus(order.id, "Accepted")}
                          className="w-full rounded-xl bg-green-600 px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white hover:bg-green-700"
                        >
                          Accept Order
                        </button>
                      )}

                      {isPaid && order.status === "Accepted" && (
                        <button
                          type="button"
                          onClick={() => updateStatus(order.id, "Preparing")}
                          className="w-full rounded-xl bg-indigo-600 px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white hover:bg-indigo-700"
                        >
                          Start Preparing
                        </button>
                      )}

                      {isPaid && order.status === "Preparing" && (
                        <button
                          type="button"
                          onClick={() => updateStatus(order.id, "Ready")}
                          className="w-full rounded-xl bg-green-600 px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white hover:bg-green-700"
                        >
                          Mark Ready
                        </button>
                      )}
                    </div>
                  )}

                  {/* TOTAL CARD */}

                  <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 text-center shadow-sm">
                    <p className="text-xs sm:text-sm text-gray-500">Total Amount</p>

                    <h2 className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold text-blue-600">
                      {formatAmount(order.total_amount)}
                    </h2>

                    <div className="mt-3 sm:mt-5 border-t pt-3 sm:pt-4">
                      <p className="text-xs sm:text-sm text-gray-500">Payment Method</p>

                      <p className="mt-1 text-sm sm:text-base font-semibold text-gray-900">
                        {order.payment_method === "CASH"
                          ? "Cash on Delivery"
                          : "Online Payment"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminOrders;