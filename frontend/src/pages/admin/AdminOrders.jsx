import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { REFUND_STATE_STYLES } from "../../utils/refundInfo";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
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
  XCircle,
} from "lucide-react";

import { useSocket } from "../../socket/SocketProvider";
import { SocketEvents } from "../../socket/constants";
import { useResyncOnReconnect } from "../../socket/useResyncOnReconnect";
import { useSingleFlightRefetch } from "../../hooks/useSingleFlightRefetch";
import { REALTIME_REFETCH_COALESCE_MS } from "../../utils/refetchScheduler";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useLatestRequest, isAbortError } from "../../hooks/useLatestRequest";

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

// Server-side paging for the live queue. A realtime refresh re-reads the rows
// already on screen in one request, up to the API's maximum page size.
const QUEUE_PAGE_SIZE = 50;
const QUEUE_MAX_LIMIT = 100;

// Filter values -> API parameters. "Pending" includes legacy "Accepted" rows,
// which the queue has always shown as Pending.
const STATUS_PARAM = {
  Pending: "Pending,Accepted",
  Preparing: "Preparing",
  Ready: "Ready",
};

const PAYMENT_PARAM = {
  cash: "CASH",
  online: "RAZORPAY",
};

const ACTIVE_STATUSES = ["Pending", "Accepted", "Preparing", "Ready"];

// Realtime order events refresh the queue (rows + stat cards) at most once per
// REALTIME_REFETCH_COALESCE_MS, however many events arrive. During a lunch rush
// every order emits several events (placed, paid, ready, completed);
// refetching per event made ~1.5 requests per event and ran the admin into the
// rate limit. An order already on screen still changes instantly (merged in
// place below), so the window only delays brand-new rows and the stat cards.

// Merge a realtime order row into the list, or drop it when it no longer
// belongs to the current view (it finished, or its status/payment no longer
// matches the filters). Search cannot be affected: a status update never
// changes the token or the customer. The payload is a flat orders row with no
// nested user/order_items, so a spread is used rather than a replace -- it
// keeps the joined data the cards render.
const applyRealtimeOrder = (rows, updatedOrder, params) => {
  const current = rows.find((order) => order.id === updatedOrder.id);
  if (!current) return rows;

  const merged = { ...current, ...updatedOrder };
  const stillMatches =
    ACTIVE_STATUSES.includes(merged.status) &&
    (!params.status || params.status.split(",").includes(merged.status)) &&
    (!params.payment_method || merged.payment_method === params.payment_method);

  return stillMatches
    ? rows.map((order) => (order.id === updatedOrder.id ? merged : order))
    : rows.filter((order) => order.id !== updatedOrder.id);
};

const EMPTY_QUEUE_SUMMARY = { pending: 0, preparing: 0, ready: 0 };

const STAT_DEFS = [

  { key: "Pending", label: "Pending", subtitle: "Awaiting preparation", icon: Clock, bg: "bg-orange-50", color: "text-orange-600" },
  { key: "Preparing", label: "Preparing", subtitle: "Being prepared", icon: ChefHat, bg: "bg-purple-50", color: "text-purple-600" },
  { key: "Ready", label: "Ready", subtitle: "Ready for pickup", icon: CheckCircle2, bg: "bg-green-50", color: "text-green-600" },
];

const STATUS_FILTER_OPTIONS = [
  "All Orders",
  "Pending",
  "Preparing",
  "Ready",
];

const STATUS_FLOW = [
  "Pending",
  "Preparing",
  "Ready",
  "Completed",
];

// "Accepted" is no longer its own admin step. Receiving cash now moves an
// order straight to Preparing, but Accepted may still exist on older rows;
// such an order is handled exactly like a paid Pending order: it waits for
// "Accept & Prepare".
const toWorkflowStatus = (status) =>
  status === "Accepted" ? "Pending" : status;

// ---------------- Refund Amount Helpers ----------------
// Refund amounts are handled in integer paise so rupee values are never added
// or compared as floats. Mirrors backend/utils/money.js.
const RUPEE_AMOUNT_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;
const MIN_REFUND_PAISE = 100;

const rupeesToPaise = (value) => {
  const text = typeof value === "number"
    ? (Number.isFinite(value) ? value.toFixed(2) : "")
    : String(value ?? "").trim();
  if (!RUPEE_AMOUNT_PATTERN.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
};

const formatPaise = (paise) =>
  `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;

const lineTotalPaise = (item) =>
  (rupeesToPaise(item.price_at_time) ?? 0) * (Number(item.quantity) || 0);

// Turns a failed refund request into a short, safe message for the modal.
// The refund route answers with fixed, human-readable `error` strings; those
// are shown as-is. Anything else (no response, a generic 5xx, or something
// that looks like internal detail) gets a plain fallback instead.
const getRefundErrorMessage = (err) => {
  const response = err?.response;

  if (!response) {
    return "Could not reach the server. Check your connection and try again.";
  }

  if (response.status === 401 || response.status === 403) {
    return "You are not authorized to issue refunds.";
  }

  if (response.status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }

  const serverMessage = response.data?.error;
  const looksInternal = (text) =>
    /\bat\s+\S+\s*\(|Error:|stack|sql|supabase|postgres|PGRST|undefined|null/i.test(text);

  if (
    typeof serverMessage === "string" &&
    serverMessage.trim() &&
    serverMessage.length <= 300 &&
    !looksInternal(serverMessage) &&
    !/^(Failed to process refund|Internal server error)$/i.test(serverMessage.trim())
  ) {
    return serverMessage.trim();
  }

  return "Refund could not be processed. Please try again.";
};

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

const getISTDate = (date) => {
  return new Date(date).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
};

const AdminOrders = () => {
  // Reactive socket: getSocket() returned null on a fresh load because child
  // effects run before SocketProvider's, leaving the listener unattached.
  const socket = useSocket();

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
  const [refundAmountInput, setRefundAmountInput] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  // Synchronous guard: two clicks in the same frame both see refundLoading as
  // false (state has not re-rendered yet), so the state alone cannot stop a
  // double submission.
  const refundInFlightRef = useRef(false);
  // Refund modal state machine: idle (form) -> processing (refundLoading) ->
  // success (refundSuccess holds what the API returned) or error (refundError).
  // All refund feedback is shown inside the modal, never as a toast.
  const [refundSuccess, setRefundSuccess] = useState(null);
  // Failure result (API error or blocked validation): { message }.
  const [refundError, setRefundError] = useState(null);
  const refundSuccessHeadingRef = useRef(null);
  const refundErrorHeadingRef = useRef(null);
  const refundSubmitRef = useRef(null);
  const focusSubmitAfterRetryRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const [selectedItems, setSelectedItems] = useState([]);
  const [activeStat, setActiveStat] = useState("");
  const today = getISTDate(new Date());
  const [dateFilter, setDateFilter] = useState(today);
  const [currentDate, setCurrentDate] = useState(today);
  const [page, setPage] = useState(1);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  // Server-side search/paging state.
  const [summary, setSummary] = useState(EMPTY_QUEUE_SUMMARY);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [listEnd, setListEnd] = useState(null);
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

  // ---------------- Server-side search ----------------
  // Search, status, payment and paging are resolved by the API in PostgreSQL
  // (GET /admin/orders?view=active); the browser never downloads the whole
  // day and filters it. The search box is debounced so typing sends one
  // request per pause, not one per keystroke.
  const debouncedSearch = useDebouncedValue(search);

  const queryParams = useMemo(() => {
    const params = {};

    const status = STATUS_PARAM[statusFilter];
    if (status) params.status = status;

    const payment = PAYMENT_PARAM[paymentFilter];
    if (payment) params.payment_method = payment;

    const query = debouncedSearch.trim();
    if (query) params.search = query;

    return params;
  }, [statusFilter, paymentFilter, debouncedSearch]);

  const queryKey = JSON.stringify(queryParams);

  const queryParamsRef = useRef(queryParams);
  queryParamsRef.current = queryParams;

  // Stale-response protection: a new request aborts the previous one, and a
  // response that is no longer the latest is ignored.
  const { begin: beginListRequest, cancel: cancelListRequest } = useLatestRequest();
  const { begin: beginMoreRequest, cancel: cancelMoreRequest } = useLatestRequest();

  // Pages currently on screen for the current filters, so a refresh re-reads
  // the same rows instead of collapsing the list to page 1.
  const pagesLoadedRef = useRef(1);
  const loadedQueryKeyRef = useRef(null);

  // The stat cards count today's queue by payment method; they do not depend
  // on search or the status filter. They are re-read only when the payment
  // filter changes or the data itself changed (realtime event, action,
  // Refresh), not on every search keystroke.
  const summaryKeyRef = useRef(null);
  const summaryDirtyRef = useRef(true);

  // Realtime changes already merged into the list, by order id, with the
  // sequence number of the event. A list response requested BEFORE an event
  // predates it; re-applying the event on top keeps that response from briefly
  // putting the old status back on screen. Entries are dropped once a response
  // requested after them lands.
  const realtimeSeqRef = useRef(0);
  const realtimePatchesRef = useRef(new Map());

  // Only one list request runs at a time. A request made while one is in
  // flight queues a single follow-up after it, so the newest data always lands
  // last; realtime-triggered ones are coalesced (see useSingleFlightRefetch).
  const loadOrders = useCallback(async () => {
    const params = queryParamsRef.current;
    const seqAtRequest = realtimeSeqRef.current;
    const key = JSON.stringify(params);
    const sameQuery = loadedQueryKeyRef.current === key;
    const pages = sameQuery ? pagesLoadedRef.current : 1;
    const limit = Math.min(QUEUE_PAGE_SIZE * pages, QUEUE_MAX_LIMIT);

    const summaryKey = params.payment_method || "all";
    const needSummary = summaryDirtyRef.current || summaryKeyRef.current !== summaryKey;

    const request = beginListRequest();

    try {
      setRefreshing(true);

      const { data } = await adminAPI.searchActiveOrders(
        {
          ...params,
          page: 1,
          limit,
          ...(needSummary ? {} : { include_summary: 0 }),
        },
        { signal: request.signal }
      );

      if (!request.isLatest()) return;

      if (!data || !Array.isArray(data.orders)) {
        setOrders([]);
        toast.error(data?.error || "Invalid orders data");
        return;
      }

      // A load-more for the previous rows must not append to these.
      cancelMoreRequest();
      setLoadingMore(false);
      setLoadMoreFailed(false);

      let rows = data.orders;

      for (const [id, patch] of realtimePatchesRef.current) {
        if (patch.seq > seqAtRequest) {
          rows = applyRealtimeOrder(rows, patch.order, params);
        } else {
          realtimePatchesRef.current.delete(id);
        }
      }

      setOrders(rows);
      setHasMore(Boolean(data.pagination?.hasMore));
      pagesLoadedRef.current = Math.max(Math.ceil(data.orders.length / QUEUE_PAGE_SIZE), 1);
      loadedQueryKeyRef.current = key;

      if (data.summary) {
        setSummary({
          pending: Number(data.summary.pending) || 0,
          preparing: Number(data.summary.preparing) || 0,
          ready: Number(data.summary.ready) || 0,
        });
        summaryKeyRef.current = summaryKey;
        summaryDirtyRef.current = false;
      }

      rateLimitedRef.current = false;
    } catch (err) {
      if (isAbortError(err) || !request.isLatest()) return;

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
        setHasMore(false);
      }
    } finally {
      if (request.isLatest()) {
        setLoading(false);
        setRefreshing(false);
        setLastUpdated(new Date());
      }
    }
  }, [beginListRequest, cancelMoreRequest]);

  const { refetch: refetchOrders } = useSingleFlightRefetch(loadOrders, {
    coalesceMs: REALTIME_REFETCH_COALESCE_MS,
  });

  // The data changed: re-read the rows on screen AND the stat-card counts.
  // Called with no options from realtime events (coalesced); user actions,
  // Refresh, reconnect and the new-day reset pass { immediate: true }.
  const fetchOrders = useCallback(
    (options) => {
      summaryDirtyRef.current = true;
      return refetchOrders(options);
    },
    [refetchOrders]
  );

  // Initial load and every search / filter change. The request for the
  // previous filters is aborted; the cards on screen stay until the new page
  // arrives (no skeleton after the first load).
  useEffect(() => {
    cancelListRequest();
    cancelMoreRequest();
    refetchOrders({ immediate: true });
  }, [queryKey, cancelListRequest, cancelMoreRequest, refetchOrders]);

  // Next page, appended (infinite scroll, same pattern as Order History).
  const loadMoreOrders = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    const params = queryParamsRef.current;
    const key = JSON.stringify(params);
    const nextPage = pagesLoadedRef.current + 1;
    const request = beginMoreRequest();

    setLoadingMore(true);
    setLoadMoreFailed(false);

    try {
      const { data } = await adminAPI.searchActiveOrders(
        { ...params, page: nextPage, limit: QUEUE_PAGE_SIZE, include_summary: 0 },
        { signal: request.signal }
      );

      if (!request.isLatest() || loadedQueryKeyRef.current !== key) return;
      if (!data || !Array.isArray(data.orders)) throw new Error("Invalid orders data");

      setOrders((prev) => {
        const seen = new Set(prev.map((order) => order.id));
        return [...prev, ...data.orders.filter((order) => !seen.has(order.id))];
      });
      setHasMore(Boolean(data.pagination?.hasMore));
      pagesLoadedRef.current = nextPage;
    } catch (err) {
      if (isAbortError(err) || !request.isLatest()) return;
      console.error("Failed to load more orders:", err);
      setLoadMoreFailed(true);
    } finally {
      if (request.isLatest()) setLoadingMore(false);
    }
  }, [beginMoreRequest, hasMore, loadingMore]);

  useEffect(() => {
    if (!listEnd || !hasMore || loading || refreshing || loadingMore || loadMoreFailed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreOrders();
      },
      { threshold: 0.2, rootMargin: "200px" }
    );

    observer.observe(listEnd);
    return () => observer.disconnect();
  }, [listEnd, hasMore, loading, refreshing, loadingMore, loadMoreFailed, loadMoreOrders]);

  // Split from the fetch above so it can depend on `socket` without
  // re-fetching when the socket connects.
  //
  // The handler is now a stored reference and the cleanup passes it to off().
  // Previously this registered an anonymous handler and cleaned up with
  // socket.off(ORDER_UPDATED), which removes EVERY listener for that event on
  // the shared socket -- unmounting this page also silently killed the
  // ORDER_UPDATED listeners owned by AdminDashboard, TrackOrder and Orders.
  // Mirrors the latest orders so the socket handler can test membership
  // synchronously. Reading `orders` from the handler's closure would go stale,
  // and reading it inside a state updater is not safe either -- an updater runs
  // during React's render phase, which has not necessarily happened yet.
  const ordersRef = useRef(orders);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {

    if (!socket) return;

    // ORDER_UPDATED carries the updated order row itself, so an order already
    // on screen can be merged in place instead of refetching the whole list.
    // The payload is a flat orders row with no nested user/order_items, so a
    // spread is used rather than a replace -- it keeps the joined data the
    // cards render.
    //
    // A refetch still happens when the order is not currently held, because
    // this same event is what announces a brand-new order (orders.js) and an
    // auto-cancellation (autoCancelOrders.js). Inserting those blindly would
    // bypass the server-side date scope of the current fetch.
    const handleOrderUpdate = (updatedOrder) => {

      if (!updatedOrder?.id) {
        fetchOrders();
        return;
      }

      const alreadyListed = ordersRef.current.some(
        (order) => order.id === updatedOrder.id
      );

      if (!alreadyListed) {
        fetchOrders();
        return;
      }

      // Shown at once: merged in place, or removed when it no longer belongs
      // to the current view. Remembered so a list response requested before
      // this event cannot put the old status back (see loadOrders).
      realtimeSeqRef.current += 1;
      realtimePatchesRef.current.set(updatedOrder.id, {
        order: updatedOrder,
        seq: realtimeSeqRef.current,
      });

      const params = queryParamsRef.current;
      setOrders((prev) => applyRealtimeOrder(prev, updatedOrder, params));

      // The stat-card counts are server-side; refresh them (and the rows) in
      // the background, coalesced with any other events arriving now. The
      // cards on screen stay visible.
      fetchOrders();
    };

    socket.on(SocketEvents.ORDER_UPDATED, handleOrderUpdate);

    return () => {
      socket.off(SocketEvents.ORDER_UPDATED, handleOrderUpdate);
    };

  }, [socket, fetchOrders]);

  // Updates emitted while the socket was down are never replayed, so refetch
  // the list once per reconnect. The initial connect is skipped: the mount
  // effect above already loaded it.
  const resyncOrders = useCallback(
    () => fetchOrders({ immediate: true }),
    [fetchOrders]
  );

  useResyncOnReconnect(socket, resyncOrders);

  useEffect(() => {
    let timeoutId;

    const scheduleMidnightReset = () => {
      const now = new Date();

      // Next midnight
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);

      const delay = nextMidnight.getTime() - now.getTime();

      timeoutId = setTimeout(() => {

        const today = getISTDate(new Date());

        setCurrentDate(today);
        setDateFilter(today);

        // Reset filters
        setSearch("");
        setStatusFilter("All Orders");
        setPaymentFilter("all");
        setActiveStat("");
        setPage(1);

        fetchOrders({ immediate: true });

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
      fetchOrders({ immediate: true });
    } catch (err) {
      console.error("Failed to update order status:", err);
      toast.error("Failed to update order status");
    }
  };

  const receivePayment = async (orderId) => {
    const result = await Swal.fire({
      title: "Confirm cash payment?",
      html: "<b>Confirm cash payment received?</b><br/>The order will move to Preparing.",
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
      toast.success("Cash payment received — order is now Preparing");
      fetchOrders({ immediate: true });
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
      fetchOrders({ immediate: true });
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel order");
    }
  };

  const openRefundModal = (order) => {
    setSelectedOrder(order);
    setRefundType("full");
    setRefundReason("");
    setRefundAmountInput("");
    setRefundSuccess(null);
    setRefundError(null);

    // Default me full refund ke liye sab items select
    setSelectedItems(order.order_items || []);

    setShowRefundModal(true);
  };

  const closeRefundModal = () => {
    // Closing mid-request would hide the outcome of a refund that may
    // already have been issued.
    if (refundInFlightRef.current) return;

    setShowRefundModal(false);
    setSelectedOrder(null);
    setSelectedItems([]);
    setRefundType("full");
    setRefundReason("");
    setRefundAmountInput("");
    setRefundSuccess(null);
    setRefundError(null);
  };

  // Move focus to the confirmation heading so keyboard and screen reader users
  // land on the result (the Continue button they pressed no longer exists).
  useEffect(() => {
    if (refundSuccess) {
      refundSuccessHeadingRef.current?.focus();
    } else if (refundError) {
      refundErrorHeadingRef.current?.focus();
    } else if (focusSubmitAfterRetryRef.current) {
      focusSubmitAfterRetryRef.current = false;
      refundSubmitRef.current?.focus();
    }
  }, [refundSuccess, refundError]);

  // Back to the form with everything the admin entered still in place.
  const retryRefund = () => {
    focusSubmitAfterRetryRef.current = true;
    setRefundError(null);
  };

  const handleRefund = async () => {
    if (refundInFlightRef.current || refundSuccess || refundError) return;

    if (!refundReason) {
      setRefundError({ message: "Please select a refund reason." });
      return;
    }

    if (refundAmountError || refundAmountPaise === null) {
      setRefundError({
        message: refundAmountError
          ? `${refundAmountError}.`
          : "The refund amount is invalid.",
      });
      return;
    }

    try {
      refundInFlightRef.current = true;
      setRefundLoading(true);

      const { data } = await adminAPI.refundOrder(selectedOrder.id, {
        refundType,
        refundReason,
        ...(refundType === "partial"
          ? { amount: formatPaise(refundAmountPaise) }
          : {}),
      });

      // Show what the server actually refunded. The normal response carries
      // refundAmount/refundType; the rare "processed but not fully recorded"
      // response only carries the Razorpay refund entity (amount in paise).
      const refundedPaise =
        rupeesToPaise(data?.refundAmount) ??
        (Number.isInteger(data?.refund?.amount) ? data.refund.amount : refundAmountPaise);

      setRefundSuccess({
        amount: formatPaise(refundedPaise),
        type:
          data?.refundType === "full" || data?.refundType === "partial"
            ? data.refundType
            : refundedPaise >= orderTotalPaise ? "full" : "partial",
        refundId: typeof data?.refund?.id === "string" ? data.refund.id : null,
        note: data?.refundType ? "" : data?.message || "",
      });

      fetchOrders({ immediate: true });

    } catch (err) {
      console.error(err);
      setRefundError({ message: getRefundErrorMessage(err) });
    } finally {
      refundInFlightRef.current = false;
      setRefundLoading(false);
    }
  };

  // Amount the order was paid, in paise.
  const orderTotalPaise = useMemo(
    () => (selectedOrder ? rupeesToPaise(selectedOrder.total_amount) ?? 0 : 0),
    [selectedOrder]
  );

  // Full refund: always the amount paid. Partial refund: whatever the admin
  // entered (prefilled from the ticked items); null when the input is invalid.
  const refundAmountPaise = useMemo(() => {
    if (refundType === "full") return orderTotalPaise;
    return rupeesToPaise(refundAmountInput);
  }, [refundType, orderTotalPaise, refundAmountInput]);

  const refundAmountError = useMemo(() => {
    if (!selectedOrder || refundType === "full") return "";
    if (refundAmountInput.trim() === "") return "Enter the amount to refund";
    if (refundAmountPaise === null) return "Enter a valid amount with at most 2 decimal places";
    if (refundAmountPaise < MIN_REFUND_PAISE) return "Refund amount must be at least ₹1.00";
    if (refundAmountPaise > orderTotalPaise) {
      return `Refund amount cannot exceed ₹${formatPaise(orderTotalPaise)}`;
    }
    if (refundAmountPaise === orderTotalPaise) {
      return "That is the full amount — choose Full Refund instead";
    }
    return "";
  }, [selectedOrder, refundType, refundAmountInput, refundAmountPaise, orderTotalPaise]);

  // Ticking items prefills the amount with their total; the admin can still
  // edit it afterwards.
  const applyItemSelection = (items) => {
    setSelectedItems(items);
    const itemsPaise = items.reduce((sum, item) => sum + lineTotalPaise(item), 0);
    setRefundAmountInput(itemsPaise > 0 ? formatPaise(itemsPaise) : "");
  };

  // ---------------- Orders + stats come from the server ----------------
  // `orders` is already searched, filtered and sorted by the API; nothing is
  // re-filtered here. The stat cards use the server's counts for today's
  // queue (independent of search and the status filter, as before).
  const filteredOrders = orders;

  const statCounts = useMemo(() => ({
    Pending: summary.pending,
    Preparing: summary.preparing,
    Ready: summary.ready,
  }), [summary]);

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
            onClick={() => fetchOrders({ immediate: true })}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
        !refreshing && (
          <div className="text-center py-16 text-gray-400 text-sm">
            No orders match your filters.
          </div>
        )
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
                          const currentIndex = STATUS_FLOW.indexOf(
                            toWorkflowStatus(order.status)
                          );

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

                          {isPaid && ["Pending", "Accepted"].includes(order.status) && (
                            <button
                              type="button"
                              onClick={() => updateStatus(order.id, "Preparing")}
                              className="w-full rounded-xl bg-indigo-600 px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white hover:bg-indigo-700"
                            >
                              Accept &amp; Prepare
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
                              ✅ Complete
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

      {/* Infinite scroll foot (server pages) */}
      {filteredOrders.length > 0 && (
        <div>
          {loadingMore && (
            <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading more orders">
              {[1, 2].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-gray-200 animate-pulse" />
              ))}
            </div>
          )}

          {loadMoreFailed && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-slate-500">Could not load more orders.</p>
              <button
                onClick={() => {
                  setLoadMoreFailed(false);
                  loadMoreOrders();
                }}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Try again
              </button>
            </div>
          )}

          {hasMore && !loadingMore && !loadMoreFailed && (
            <div ref={setListEnd} className="h-1" aria-hidden="true" />
          )}
        </div>
      )}

      {showRefundModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={
                refundSuccess
                  ? "refund-success-title"
                  : refundError
                    ? "refund-error-title"
                    : "refund-modal-title"
              }
              className={`w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)] ${refundSuccess || refundError ? "flex flex-col" : ""}`}
            >

              {/* Header */}
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-8 sm:py-6">

                <div className="flex items-center min-w-0 gap-3 sm:gap-4">

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xl text-white shadow-lg sm:h-14 sm:w-14 sm:text-2xl">
                    💸
                  </div>

                  <div>
                    <h2 id="refund-modal-title" className="text-xl font-bold text-slate-900 sm:text-3xl">
                      Refund Order
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedOrder?.user?.name}
                    </p>
                  </div>

                </div>

                <button
                  type="button"
                  aria-label="Close refund dialog"
                  onClick={closeRefundModal}
                  disabled={refundLoading}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ✕
                </button>

              </div>

              {refundSuccess ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">

                  <div className="px-5 py-8 sm:px-8 sm:py-10">
                    <div className="mx-auto flex max-w-md flex-col items-center text-center">

                      {/* Animated confirmation icon (decorative: the heading carries the meaning) */}
                      <motion.div
                        aria-hidden="true"
                        initial={prefersReducedMotion ? false : { scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-blue-200 sm:h-24 sm:w-24"
                      >
                        {!prefersReducedMotion && (
                          <motion.span
                            className="absolute inset-0 rounded-full bg-blue-500/30"
                            initial={{ scale: 1, opacity: 0.6 }}
                            animate={{ scale: 1.45, opacity: 0 }}
                            transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
                          />
                        )}

                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="relative h-10 w-10 text-white sm:h-12 sm:w-12"
                        >
                          <motion.path
                            d="M5 12.5l4.5 4.5L19 7.5"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={prefersReducedMotion ? false : { pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.45, ease: "easeOut", delay: 0.25 }}
                          />
                        </svg>
                      </motion.div>

                      <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: prefersReducedMotion ? 0 : 0.35 }}
                        className="w-full"
                      >
                        <h3
                          id="refund-success-title"
                          ref={refundSuccessHeadingRef}
                          tabIndex={-1}
                          className="mt-6 break-words text-2xl font-bold text-slate-900 outline-none sm:text-3xl"
                        >
                          Refund Successful
                        </h3>

                        <p className="mt-2 text-sm text-slate-500 sm:text-base">
                          Razorpay has processed the refund to the customer's original payment method.
                        </p>

                        <div className="mt-6 w-full rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-5 sm:p-6">
                          <p className="text-sm font-medium text-slate-500">
                            Amount refunded
                          </p>

                          <p className="mt-1 break-words text-4xl font-extrabold text-blue-600 sm:text-5xl">
                            ₹{refundSuccess.amount}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                            <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                              {refundSuccess.type === "full" ? "Full Refund" : "Partial Refund"}
                            </span>

                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${REFUND_STATE_STYLES.processed.badge}`}
                            >
                              {refundSuccess.type === "full" ? "Refunded" : "Partial Refund"}
                            </span>
                          </div>

                          {refundSuccess.refundId && (
                            <p className="mt-4 text-xs text-slate-500 sm:text-sm">
                              Refund ID{" "}
                              <span className="break-all font-mono text-slate-700">
                                {refundSuccess.refundId}
                              </span>
                            </p>
                          )}
                        </div>

                        {refundSuccess.note && (
                          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
                            {refundSuccess.note}
                          </p>
                        )}
                      </motion.div>

                    </div>
                  </div>

                  <div className="sticky bottom-0 mt-auto flex flex-col-reverse gap-3 border-t bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-8 sm:py-5">
                    <button
                      type="button"
                      onClick={closeRefundModal}
                      className="min-h-[44px] rounded-xl border px-5 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Back to Orders
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closeRefundModal();
                        navigate("/admin");
                      }}
                      className="min-h-[44px] rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 font-semibold text-white transition-all duration-300 hover:shadow-xl active:scale-95"
                    >
                      Go to Home
                    </button>
                  </div>

                </div>
              ) : refundError ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">

                  <div className="px-5 py-8 sm:px-8 sm:py-10">
                    <div className="mx-auto flex max-w-md flex-col items-center text-center">

                      {/* Animated failure icon (decorative: the heading carries the meaning) */}
                      <motion.div
                        aria-hidden="true"
                        initial={prefersReducedMotion ? false : { scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 shadow-lg shadow-red-200 sm:h-24 sm:w-24"
                      >
                        {!prefersReducedMotion && (
                          <motion.span
                            className="absolute inset-0 rounded-full bg-red-500/30"
                            initial={{ scale: 1, opacity: 0.6 }}
                            animate={{ scale: 1.45, opacity: 0 }}
                            transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
                          />
                        )}

                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="relative h-10 w-10 text-white sm:h-12 sm:w-12"
                        >
                          <motion.path
                            d="M7.5 7.5l9 9"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            initial={prefersReducedMotion ? false : { pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.3, ease: "easeOut", delay: 0.25 }}
                          />
                          <motion.path
                            d="M16.5 7.5l-9 9"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            initial={prefersReducedMotion ? false : { pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.3, ease: "easeOut", delay: prefersReducedMotion ? 0 : 0.45 }}
                          />
                        </svg>
                      </motion.div>

                      <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: prefersReducedMotion ? 0 : 0.35 }}
                        className="w-full"
                      >
                        <h3
                          id="refund-error-title"
                          ref={refundErrorHeadingRef}
                          tabIndex={-1}
                          className="mt-6 break-words text-2xl font-bold text-slate-900 outline-none sm:text-3xl"
                        >
                          Refund Failed
                        </h3>

                        <p className="mt-2 text-sm text-slate-500 sm:text-base">
                          Review the reason below before trying again.
                        </p>

                        <div
                          role="alert"
                          className="mt-6 w-full rounded-3xl border border-red-100 bg-gradient-to-br from-red-50 via-white to-rose-50 p-5 sm:p-6"
                        >
                          <p className="text-sm font-medium text-slate-500">
                            Reason
                          </p>

                          <p className="mt-1 break-words text-base font-semibold text-red-700 sm:text-lg">
                            {refundError.message}
                          </p>
                        </div>
                      </motion.div>

                    </div>
                  </div>

                  <div className="sticky bottom-0 mt-auto flex flex-col-reverse gap-3 border-t bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-8 sm:py-5">
                    <button
                      type="button"
                      onClick={closeRefundModal}
                      className="min-h-[44px] rounded-xl border px-5 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={retryRefund}
                      className="min-h-[44px] rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-5 py-2.5 font-semibold text-white transition-all duration-300 hover:shadow-xl active:scale-95"
                    >
                      Try Again
                    </button>
                  </div>

                </div>
              ) : (
              <>
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
                        setRefundAmountInput("");
                      } else {
                        applyItemSelection([]);
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
                      {refundAmountPaise === null ? "—" : `₹${formatPaise(refundAmountPaise)}`}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {refundType === "full"
                        ? "Full amount paid"
                        : `Partial refund · order paid ₹${formatPaise(orderTotalPaise)}`}
                    </p>

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
                                applyItemSelection(
                                  e.target.checked
                                    ? [...selectedItems, item]
                                    : selectedItems.filter((i) => i !== item)
                                );
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
                            ₹{formatPaise(lineTotalPaise(item))}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="mt-5">
                      <label
                        htmlFor="partial-refund-amount"
                        className="text-base font-semibold text-slate-700"
                      >
                        Amount to refund (₹)
                      </label>
                      <input
                        id="partial-refund-amount"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="e.g. 10.50"
                        value={refundAmountInput}
                        onChange={(e) => setRefundAmountInput(e.target.value)}
                        disabled={refundLoading}
                        className={`mt-2 w-full rounded-2xl border bg-white px-5 py-4 text-base outline-none transition focus:ring-4 ${refundAmountError
                          ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                          : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
                          }`}
                      />
                      <p className={`mt-2 text-sm ${refundAmountError ? "text-red-600" : "text-slate-500"}`}>
                        {refundAmountError ||
                          `Ticked items prefill this amount. Maximum ₹${formatPaise(orderTotalPaise)}.`}
                      </p>
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white px-8 py-5">

                <button
                  type="button"
                  onClick={closeRefundModal}
                  disabled={refundLoading}
                  className="rounded-xl border px-5 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  ref={refundSubmitRef}
                  type="button"
                  onClick={handleRefund}
                  disabled={refundLoading}
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
              </>
              )}

            </div>
          </div>,

          document.body
        )}

    </div>
  );
};

export default AdminOrders;