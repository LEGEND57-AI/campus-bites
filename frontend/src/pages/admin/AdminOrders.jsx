import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import {
  Banknote,
  CreditCard,
  Phone,
  ShoppingBag,
  Store,
  User,
} from "lucide-react";
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

const REFRESH_INTERVAL = 10000; // milliseconds

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
  // ---------------- State ----------------
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---------------- Fetch Orders ----------------
  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await adminAPI.getOrders();
      if (!Array.isArray(data)) {
        setOrders([]);
        toast.error(data?.error || "Invalid orders data");
        return;
      }
      setOrders(data);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      toast.error("Failed to fetch orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------- Auto Refresh ----------------
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // ---------------- Update Order Status ----------------
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

  // ---------------- Receive Cash Payment ----------------
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

  // ---------------- Loading State ----------------
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

  // ---------------- Empty State ----------------
  if (!orders.length) return <p className="text-gray-500">No orders yet.</p>;

  // ---------------- Orders List ----------------
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Manage Orders</h2>

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
              className="glass-card rounded-xl p-5 shadow-md"
            >
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[150px_1fr_240px]">
                {/* ================= LEFT TOKEN CARD ================= */}

                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center">
                  <div className="mb-2 text-4xl">🍔</div>

                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Token
                  </p>

                  <h2 className="mt-1 text-3xl font-bold text-blue-600">
                    {formatToken(order)}
                  </h2>

                  <span
                    className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${getStatusColor(order.status)}`}
                  >
                    {order.status || "Unknown"}
                  </span>

                  <p className="mt-3 text-xs text-gray-500">
                    {formatDate(order.created_at)}
                  </p>
                </div>

                {/* ================= CENTER COLUMN ================= */}

                <div className="space-y-4">
                  {/* Customer Information */}

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-8">
                      {/* Name */}

                      <div className="flex items-center gap-2">
                        <span className="text-xl">👤</span>

                        <h3 className="text-2xl font-bold text-gray-900">
                          {order.user?.name || "Unknown"}
                        </h3>
                      </div>

                      {/* Phone */}

                      <div className="flex items-center gap-3">
                        <span className="text-lg">📞</span>

                        <p className="whitespace-nowrap text-base text-gray-700">
                          +91 {order.user?.phone || "Not Available"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ================= ITEMS BOX START ================= */}

                  {/* ================= ITEMS BOX ================= */}

                  <div className="overflow-hidden rounded-2xl border border-gray-200">
                    <div className="border-b bg-gray-50 px-4 py-3">
                      <h4 className="font-semibold text-gray-800">
                        🛍 Items Ordered
                      </h4>
                    </div>

                    <div className="divide-y">
                      {order.order_items?.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="
                        rounded-lg
                        bg-blue-100
                        px-3 py-1
                        text-sm
                        font-semibold
                        text-blue-700
                        "
                            >
                              {item.quantity}x
                            </span>

                            <span className="font-semibold text-gray-900">
                              {item.food_items?.name || "Unknown Item"}
                            </span>
                          </div>

                          <span className="font-bold text-gray-800">
                            {formatAmount(item.price_at_time * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ================= PAYMENT BADGES ================= */}

                  <div className="flex flex-wrap gap-3">
                    <span
                      className="
        rounded-full
        bg-blue-100
        px-4 py-2
        text-sm
        font-semibold
        text-blue-700
        "
                    >
                      {order.payment_method === "CASH"
                        ? "💵 CASH"
                        : "💳 ONLINE"}
                    </span>

                    <span
                      className={`
        rounded-full
        px-4 py-2
        text-sm
        font-semibold
        ${getPaymentColor(order.payment_status)}
        `}
                    >
                      {order.payment_status || "UNKNOWN"}
                    </span>
                  </div>
                </div>

                {/* ================= RIGHT COLUMN START ================= */}

                <div className="flex flex-col gap-4">
                  {/* ================= ACTION BUTTONS ================= */}

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
                          className="
                    w-full
                    rounded-xl
                    bg-gradient-to-r
                    from-yellow-500
                    to-orange-500
                    px-5
                    py-3
                    font-semibold
                    text-white
                    shadow-md
                    transition
                    hover:scale-105
                    "
                        >
                          🪙 Receive Payment
                        </button>
                      )}

                      {isPaid && order.status === "Pending" && (
                        <button
                          type="button"
                          onClick={() => updateStatus(order.id, "Accepted")}
                          className="
                    w-full
                    rounded-xl
                    bg-green-600
                    px-5
                    py-3
                    font-semibold
                    text-white
                    hover:bg-green-700
                    "
                        >
                          Accept Order
                        </button>
                      )}

                      {isPaid && order.status === "Accepted" && (
                        <button
                          type="button"
                          onClick={() => updateStatus(order.id, "Preparing")}
                          className="
                    w-full
                    rounded-xl
                    bg-indigo-600
                    px-5
                    py-3
                    font-semibold
                    text-white
                    hover:bg-indigo-700
                    "
                        >
                          Start Preparing
                        </button>
                      )}

                      {isPaid && order.status === "Preparing" && (
                        <button
                          type="button"
                          onClick={() => updateStatus(order.id, "Ready")}
                          className="
                    w-full
                    rounded-xl
                    bg-green-600
                    px-5
                    py-3
                    font-semibold
                    text-white
                    hover:bg-green-700
                    "
                        >
                          Mark Ready
                        </button>
                      )}
                    </div>
                  )}

                  {/* ================= TOTAL CARD ================= */}

                  <div
                    className="
        rounded-2xl
        border
        border-gray-200
        bg-white
        p-5
        text-center
        shadow-sm
    "
                  >
                    <p className="text-sm text-gray-500">Total Amount</p>

                    <h2
                      className="
            mt-2
            text-3xl
            font-bold
            text-blue-600
        "
                    >
                      {formatAmount(order.total_amount)}
                    </h2>

                    <div className="mt-5 border-t pt-4">
                      <p className="text-sm text-gray-500">Payment Method</p>

                      <p className="mt-1 font-semibold text-gray-900">
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
