import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { adminAPI } from "../../services/api";
import {
  Search,
  Download,
  Plus,
  Calendar,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Package,
  Clock,
  ChefHat,
  CheckCircle2,
  BadgeCheck,
  XCircle,
} from "lucide-react";

// ---------------- Constants ----------------
const STATUS_STYLES = {
  Pending: "bg-yellow-100 text-yellow-700",
  Accepted: "bg-blue-100 text-blue-700",
  Preparing: "bg-purple-100 text-purple-700",
  Ready: "bg-green-100 text-green-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
  Refunded: "bg-cyan-100 text-cyan-700",
};

const PAYMENT_STYLES = {
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
};

const REFRESH_INTERVAL = 30000;
const INITIAL_VISIBLE = 10;

const STAT_DEFS = [

  { key: "Pending", label: "Pending", subtitle: "Awaiting preparation", icon: Clock, bg: "bg-orange-50", color: "text-orange-600" },
  { key: "Accepted", label: "Accepted", subtitle: "Order confirmed", icon: BadgeCheck, bg: "bg-blue-50", color: "text-blue-600" },
  { key: "Preparing", label: "Preparing", subtitle: "Being prepared", icon: ChefHat, bg: "bg-purple-50", color: "text-purple-600" },
  { key: "Ready", label: "Ready", subtitle: "Ready for pickup", icon: CheckCircle2, bg: "bg-green-50", color: "text-green-600" },
];

const STATUS_FILTER_OPTIONS = [
  "All Orders",
  "Pending",
  "Accepted",
  "Preparing",
  "Ready",
];

const STATUS_FLOW = [
  "Pending",
  "Accepted",
  "Preparing",
  "Ready",
  "Completed",
];

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

const getOrderAge = (date) => {
  if (!date) return "";

  const diff = Math.floor((Date.now() - new Date(date)) / 1000);

  if (diff < 60) return "Just now";

  if (diff < 3600)
    return `${Math.floor(diff / 60)} min ago`;

  if (diff < 86400)
    return `${Math.floor(diff / 3600)} hr ago`;

  return `${Math.floor(diff / 86400)} day ago`;
};

const formatToken = (order) =>
  order.token_number
    ? `#${String(order.token_number).padStart(2, "0")}`
    : `#${order.id}`;

const AdminOrders = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedOrderId = location.state?.orderId || null;
  const [highlightId, setHighlightId] = useState(selectedOrderId);
  const selectedCardRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Orders");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [showPaymentFilter, setShowPaymentFilter] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refundType, setRefundType] = useState("full");
  const [refundReason, setRefundReason] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [activeStat, setActiveStat] = useState("");
  const now = new Date();
  const today =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [dateFilter, setDateFilter] = useState(today);
  const [currentDate, setCurrentDate] = useState(today);
  const [page, setPage] = useState(1);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const dateDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);
  const paymentDropdownRef = useRef(null);


  const rateLimitedRef = useRef(false);

  useEffect(() => {
    if (showRefundModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [showRefundModal]);

  const fetchOrders = useCallback(async () => {
    try {
      setRefreshing(true);
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
      setRefreshing(false);
      setLastUpdated(new Date());
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

  useEffect(() => {
    let timeoutId;

    const scheduleMidnightReset = () => {
      const now = new Date();

      // Next midnight
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);

      const delay = nextMidnight.getTime() - now.getTime();

      timeoutId = setTimeout(() => {
        const now = new Date();

        const today =
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        setCurrentDate(today);
        setDateFilter(today);

        // Reset filters
        setSearch("");
        setStatusFilter("All Orders");
        setPaymentFilter("all");
        setActiveStat("");
        setPage(1);

        fetchOrders();

        toast.success("🌅 New day started. Orders refreshed.");

        // Schedule next midnight automatically
        scheduleMidnightReset();
      }, delay);
    };

    scheduleMidnightReset();

    return () => clearTimeout(timeoutId);
  }, [fetchOrders]);

  useEffect(() => {
    if (!selectedOrderId) return;

    if (selectedCardRef.current) {
      selectedCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }

    setHighlightId(selectedOrderId);

    const timer = setTimeout(() => {
      setHighlightId(null);
      navigate(".", {
        replace: true,
        state: null,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [orders, selectedOrderId]);

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

  const cancelOrder = async (orderId) => {
    const result = await Swal.fire({
      title: "Cancel this order?",
      text: "This order will be rejected.",
      icon: "warning",
      input: "select",
      inputOptions: {
        "Customer Cancelled": "Customer Cancelled",
        "Out of Stock": "Out of Stock",
        "Kitchen Closed": "Kitchen Closed",
        "Payment Issue": "Payment Issue",
        "Other": "Other",
      },
      inputPlaceholder: "Select a reason",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Cancel Order",
      cancelButtonText: "Close",
      inputValidator: (value) => {
        if (!value) {
          return "Please select a reason";
        }
      },
    });

    if (!result.isConfirmed) return;

    try {
      await adminAPI.updateOrderStatus(orderId, "Rejected", {
        cancel_reason: result.value,
      });

      toast.success("Order cancelled successfully");
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel order");
    }
  };

  const openRefundModal = (order) => {
    setSelectedOrder(order);
    setRefundType("full");

    // Default me full refund ke liye sab items select
    setSelectedItems(order.order_items || []);

    setShowRefundModal(true);
  };

  const handleRefund = async () => {
    if (!refundReason) {
      toast.error("Please select refund reason");
      return;
    }

    try {
      setRefundLoading(true);

      await adminAPI.refundOrder(selectedOrder.id, {
        refundType,
        refundReason,
        refundedItems:
          refundType === "partial"
            ? selectedItems.map((item) => ({
              food_item_id: item.food_item_id,
            }))
            : [],
      });

      toast.success("Refund processed successfully");

      setShowRefundModal(false);
      setSelectedOrder(null);
      setSelectedItems([]);
      setRefundReason("");
      setRefundType("full");

      fetchOrders();

    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.error || "Refund failed"
      );
    } finally {
      setRefundLoading(false);
    }
  };

  const refundAmount = useMemo(() => {
    if (!selectedOrder) return 0;

    // Full Refund
    if (refundType === "full") {
      return Number(selectedOrder.total_amount || 0);
    }

    // Partial Refund
    return selectedItems.reduce(
      (total, item) => total + item.price_at_time * item.quantity,
      0
    );
  }, [refundType, selectedItems, selectedOrder]);

  // ---------------- Filtering for Today ----------------
  const todayOrders = useMemo(() => {
    return orders.filter((order) => {
      const orderDate = order.created_at?.split("T")[0];
      return orderDate === today;
    });
  }, [orders, today]);

  // ---------------- Filtering ----------------
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {

      if (
        order.status === "Completed" ||
        order.status === "Rejected" ||
        order.status === "Cancelled" ||
        order.status === "Refunded"
      ) {
        return false;
      }

      if (statusFilter !== "All Orders" && order.status !== statusFilter) {
        return false;
      }

      if (dateFilter) {
        const orderDate = order.created_at?.split("T")[0];
        if (orderDate !== dateFilter) return false;
      }

      // Payment Filter
      if (paymentFilter === "cash" && order.payment_method !== "CASH") {
        return false;
      }

      if (
        paymentFilter === "online" &&
        order.payment_method !== "RAZORPAY"
      ) {
        return false;
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesId = String(order.id).toLowerCase().includes(q);
        const matchesToken = formatToken(order).toLowerCase().includes(q);
        const matchesName = order.user?.name?.toLowerCase().includes(q);
        const matchesPhone = order.user?.phone?.toLowerCase().includes(q);

        if (!matchesId && !matchesToken && !matchesName && !matchesPhone) return false;
      }

      return true;
    })
      .sort(
        (a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
      );
  }, [orders, statusFilter, dateFilter, paymentFilter, search]);

  // ---------------- Stats (always computed from the FULL unfiltered list) ----------------
  const statCounts = useMemo(() => {

    const counts = {
      Pending: 0,
      Accepted: 0,
      Preparing: 0,
      Ready: 0,
    };

    todayOrders.forEach((order) => {

      if (
        paymentFilter === "cash" &&
        order.payment_method !== "CASH"
      ) {
        return;
      }

      if (
        paymentFilter === "online" &&
        order.payment_method !== "RAZORPAY"
      ) {
        return;
      }

      if (counts[order.status] !== undefined) {
        counts[order.status]++;
      }
    });

    return counts;
  }, [todayOrders, paymentFilter]);

  // reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateFilter]);

  useEffect(() => {
    const handleClickOutside = (event) => {

      if (
        paymentDropdownRef.current &&
        !paymentDropdownRef.current.contains(event.target)
      ) {
        setShowPaymentFilter(false);
      }

      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target)
      ) {
        setShowStatusDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const paginatedOrders = filteredOrders;

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("All Orders");
    setActiveStat("");
    setPaymentFilter("all");
    setPage(1);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-gray-200 animate-pulse rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-200 animate-pulse" />
          ))}
        </div>
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-32 rounded-xl bg-gray-200 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ================= HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Orders</h2>
          <p className="text-gray-500 text-sm mt-1">Manage and track all canteen orders</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">

          <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-2 border border-green-100">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></span>

            <span className="text-sm font-semibold text-green-700">
              Live
            </span>
          </div>

          <button
            onClick={fetchOrders}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw
              size={16}
              className={`transition-transform duration-500 ${refreshing ? "animate-spin" : ""
                }`}
            />

            <span>
              {refreshing ? "Refreshing..." : "Refresh"}
            </span>
          </button>

          <button
            onClick={() => navigate("/admin/history")}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition"
          >
            <Clock size={16} />
            Order History
          </button>


        </div>
      </div>

      {/* ================= SEARCH + FILTERS ================= */}
      <div className="flex flex-col sm:flex-row gap-3">

        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Token, Student or Phone"
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
          />
        </div>

        {/* TODO: Replace with Custom Status Dropdown */}
        <div className="relative" ref={statusDropdownRef}>
          <button
            type="button"
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="flex items-center justify-between w-[170px] px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-blue-300 hover:shadow-sm transition"
          >
            <span>{statusFilter}</span>

            <svg
              className={`w-4 h-4 transition-transform ${showStatusDropdown ? "rotate-180" : ""
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showStatusDropdown && (
            <div className="absolute right-0 mt-2 w-[170px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl z-50">
              {STATUS_FILTER_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setStatusFilter(status);

                    if (status === "All Orders") {
                      setActiveStat("");
                    } else {
                      setActiveStat(status);
                    }

                    setShowStatusDropdown(false);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition
          ${statusFilter === status
                      ? "bg-blue-50 text-blue-600 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  <span>{status}</span>

                  {statusFilter === status && (
                    <span className="text-blue-600 font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TODO: Replace with Custom Date Filter */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 whitespace-nowrap">
          <Calendar size={18} className="text-blue-600" />

          <span className="text-sm font-semibold text-slate-700">
            {new Date().toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>


        <div
          className="relative"
          ref={paymentDropdownRef}
        >
          <button
            onClick={() => setShowPaymentFilter((prev) => !prev)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <SlidersHorizontal size={16} />

            <span>
              {paymentFilter === "all"
                ? "Filters"
                : paymentFilter === "cash"
                  ? "💵 Cash"
                  : "💳 Online"}
            </span>

            <ChevronDown
              size={15}
              className={`transition-transform ${showPaymentFilter ? "rotate-180" : ""
                }`}
            />
          </button>

          {showPaymentFilter && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">

              <button
                onClick={() => {
                  setPaymentFilter("all");
                  setShowPaymentFilter(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-3 transition
${paymentFilter === "all"
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "hover:bg-slate-50"
                  }`}
              >
                All Payments
                {paymentFilter === "all" && <span>✓</span>}
              </button>

              <button
                onClick={() => {
                  setPaymentFilter("cash");
                  setShowPaymentFilter(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-3 transition
    ${paymentFilter === "cash"
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "hover:bg-slate-50"
                  }`}
              >
                <span>💵 Cash</span>

                {paymentFilter === "cash" && (
                  <span className="font-bold">✓</span>
                )}
              </button>

              <button
                onClick={() => {
                  setPaymentFilter("online");
                  setShowPaymentFilter(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-3 transition
${paymentFilter === "online"
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "hover:bg-slate-50"
                  }`}
              >
                💳 Online
                {paymentFilter === "online" && <span>✓</span>}
              </button>

              <div className="border-t border-slate-200" />

              <button
                onClick={() => {
                  setPaymentFilter("all");
                  handleClearFilters();
                  setShowPaymentFilter(false);
                }}
                className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50"
              >
                🧹 Clear Filters
              </button>

            </div>
          )}
        </div>

      </div>

      {/* ================= STAT CARDS ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_DEFS.map((stat, i) => {
          const Icon = stat.icon;
          const count = stat.key === "all" ? statCounts.all : statCounts[stat.key];

          return (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                if (activeStat === stat.key) {
                  setActiveStat("");
                  setStatusFilter("All Orders");
                } else {
                  setActiveStat(stat.key);
                  setStatusFilter(stat.key);
                }
              }}
              className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${activeStat === stat.key
                ? "border-blue-500 bg-white shadow-lg ring-2 ring-blue-100"
                : "border-slate-100 bg-white shadow-sm hover:shadow-md"
                }`}
            >
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <Icon size={18} className={stat.color} />
              </div>
              <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${stat.color}`}>{count}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{stat.subtitle}</p>
            </motion.div>
          );
        })}
      </div>


      {/* ================= ORDER LIST ================= */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No orders match your filters.
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedOrders.map((order) => {
            const isSelected = highlightId === order.id;
            const isCashPaymentPending =
              order.status === "Pending" &&
              order.payment_method === "CASH" &&
              order.payment_status === "PENDING";
            const isPaid = order.payment_status === "PAID";

            return (
              <motion.div
                key={order.id}
                ref={isSelected ? selectedCardRef : null}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl p-4 sm:p-5 transition-all duration-300 border ${isSelected
                  ? "bg-blue-50 border-blue-200 shadow-2xl scale-[1.01]"
                  : "bg-white border-blue-100 shadow-sm hover:border-blue-200 hover:shadow-md scale-100"
                  }`}
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

                      <div className="mt-2 text-center">
                        <p className="text-[10px] sm:text-xs text-gray-500">
                          {formatDate(order.created_at)}
                        </p>

                        <p className="mt-1 text-[10px] sm:text-xs font-medium text-blue-600">
                          🕒 {getOrderAge(order.created_at)}
                        </p>
                      </div>
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

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        {STATUS_FLOW.map((step, index) => {
                          const currentIndex = STATUS_FLOW.indexOf(order.status);

                          return (
                            <div key={step} className="flex flex-1 items-center">
                              <div className="flex flex-col items-center">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${index < currentIndex
                                    ? "bg-green-500 text-white"
                                    : index === currentIndex
                                      ? order.status === "Completed"
                                        ? "bg-green-500 text-white"
                                        : "bg-blue-600 text-white"
                                      : "bg-gray-300 text-gray-600"
                                    }`}
                                >
                                  {index <= currentIndex ? "✓" : index + 1}
                                </div>

                                <span className="mt-1 text-[11px] font-medium text-gray-600">
                                  {step}
                                </span>
                              </div>

                              {index !== STATUS_FLOW.length - 1 && (
                                <div
                                  className={`flex-1 h-1 mx-2 rounded ${index < currentIndex
                                    ? "bg-green-500"
                                    : "bg-gray-300"
                                    }`}
                                />
                              )}
                            </div>
                          );
                        })}
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
                        ["Pending", "Accepted", "Preparing", "Ready"].includes(order.status)
                      )) && (
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

                          {isCashPaymentPending && (
                            <button
                              type="button"
                              onClick={() => cancelOrder(order.id)}
                              className="mt-3 w-full rounded-xl bg-red-600 px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white shadow-md transition hover:bg-red-700"
                            >
                              ❌ Cancel Order
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

                          {isPaid && order.status === "Ready" && (
                            <button
                              type="button"
                              onClick={() => updateStatus(order.id, "Completed")}
                              className="w-full rounded-xl bg-emerald-600 px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white hover:bg-emerald-700"
                            >
                              ✅ Complete Order
                            </button>
                          )}

                          {order.payment_method === "RAZORPAY" &&
                            isPaid &&
                            ["Pending", "Accepted", "Preparing", "Ready"].includes(order.status) && (
                              <button
                                type="button"
                                onClick={() => openRefundModal(order)}
                                className="mt-3 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-white font-semibold shadow-md hover:opacity-90 transition"
                              >
                                💸 Refund
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
      )}

      {showRefundModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]">

              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 px-8 py-6">

                <div className="flex items-center gap-4">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-2xl text-white shadow-lg">
                    💸
                  </div>

                  <div>
                    <h2 className="text-3xl font-bold text-slate-900">
                      Refund Order
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedOrder?.user?.name}
                    </p>
                  </div>

                </div>

                <button
                  onClick={() => {
                    setShowRefundModal(false);
                    setSelectedOrder(null);
                    setSelectedItems([]);
                    setRefundType("full");
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>

              </div>

              {/* Body */}
              <div className="
max-h-[calc(90vh-170px)]
overflow-y-auto
space-y-6
px-8
py-7
scrollbar-thin
scrollbar-thumb-blue-300
scrollbar-track-transparent
">

                {/* Refund Type */}
                <div className="grid gap-3 lg:grid-cols-[170px_1fr] lg:items-center">

                  <label className="text-base font-semibold text-slate-700">
                    Refund Type
                  </label>

                  <select
                    value={refundType}
                    onChange={(e) => {
                      const type = e.target.value;
                      setRefundType(type);

                      if (type === "full") {
                        setSelectedItems(selectedOrder?.order_items || []);
                      } else {
                        setSelectedItems([]);
                      }
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-medium outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="full">Full Refund</option>
                    <option value="partial">Partial Refund</option>
                  </select>

                </div>

                {/* Amount */}
                <div className="flex items-center justify-between rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6">

                  <div>

                    <p className="text-sm font-medium text-slate-500">
                      Refund Amount
                    </p>

                    <h2 className="mt-2 text-3xl sm:text-5xl font-extrabold text-blue-600">
                      ₹{refundAmount.toFixed(2)}
                    </h2>

                  </div>

                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-100 text-4xl">
                    💳
                  </div>

                </div>

                <div className="grid gap-3 lg:grid-cols-[170px_1fr] lg:items-center">

                  <label className="text-base font-semibold text-slate-700">
                    Refund Reason
                  </label>

                  <select
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Select a reason</option>
                    <option>Out of Stock</option>
                    <option>Kitchen Closed</option>
                    <option>Item Unavailable</option>
                    <option>Technical Issue</option>
                    <option>Customer Request</option>
                    <option>Other</option>
                  </select>

                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                    <h3 className="text-xl font-bold text-slate-900">
                      Order Summary
                    </h3>

                    <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600">
                      {selectedOrder?.order_items?.length} Item
                    </span>

                  </div>

                  <div className="space-y-4">

                    {selectedOrder?.order_items?.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4"
                      >

                        <div className="flex items-center gap-4">

                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-xl">
                            🍽️
                          </div>

                          <div>

                            <p className="font-semibold text-slate-800">
                              {item.food_items?.name}
                            </p>

                            <p className="text-sm text-slate-500">
                              Qty : {item.quantity}
                            </p>

                          </div>

                        </div>

                        <span className="text-lg font-bold text-slate-800">
                          ₹{item.price_at_time * item.quantity}
                        </span>

                      </div>
                    ))}

                  </div>

                </div>

                {refundType === "partial" && (
                  <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                      <h3 className="text-xl font-bold text-blue-700">
                        Select Items to Refund
                      </h3>

                      <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-blue-600 shadow-sm">
                        {selectedItems.length} Selected
                      </span>

                    </div>

                    <div className="space-y-3">
                      {selectedOrder?.order_items?.map((item, index) => (
                        <label
                          key={index}
                          className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              className="h-5 w-5 accent-blue-600"
                              type="checkbox"
                              checked={selectedItems.includes(item)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItems((prev) => [...prev, item]);
                                } else {
                                  setSelectedItems((prev) =>
                                    prev.filter((i) => i !== item)
                                  );
                                }
                              }}
                            />

                            <div>
                              <p className="text-lg font-semibold text-slate-800">
                                {item.food_items?.name}
                              </p>

                              <p className="mt-1 text-sm text-slate-500">
                                Qty : {item.quantity}
                              </p>
                            </div>
                          </div>

                          <span className="text-xl font-bold text-slate-800">
                            ₹{item.price_at_time * item.quantity}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white px-8 py-5">

                <button
                  onClick={() => {
                    setShowRefundModal(false);
                    setSelectedOrder(null);
                    setSelectedItems([]);
                    setRefundType("full");
                  }}
                  className="rounded-xl border px-5 py-2"
                >
                  Cancel
                </button>

                <button
                  onClick={handleRefund}
                  disabled={
                    refundLoading ||
                    !refundReason ||
                    (refundType === "partial" &&
                      selectedItems.length === 0)
                  }
                  className={`
    relative overflow-hidden
    rounded-xl
    px-5 py-2.5
    font-semibold
    text-white
    transition-all duration-300
    ${refundLoading
                      ? "bg-cyan-700 cursor-not-allowed"
                      : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-[1.03] hover:shadow-xl active:scale-95"
                    }
  `}
                >
                  {refundLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    "Continue"
                  )}
                </button>

              </div>

            </div>
          </div>,

          document.body
        )}

    </div>
  );
};

export default AdminOrders;