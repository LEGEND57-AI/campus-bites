import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../../../styles/datepicker.css";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { adminAPI } from "../../../services/api";
import SummaryCard from "./SummaryCard";
import HistoryCard from "./HistoryCard";
import ViewDetailsModal from "./ViewDetailsModal";
import {
    Search,
    Calendar,
    CalendarDays,
    SlidersHorizontal,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ClipboardList,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Wallet,
} from "lucide-react";
import { useSocket } from "../../../socket/SocketProvider";
import { SocketEvents } from "../../../socket/constants";


const getISTDate = (date) =>
    new Date(date).toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
    });

const todayStr = () => getISTDate(new Date());
const formatDisplay = (iso) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const toDate = (value) => (value ? new Date(value) : null);

const toISO = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
    });
};

// The statuses this page fetches. Mirrors the terminal-status list in
// backend/routes/history.js -- an order outside this set can never appear here.
const HISTORY_STATUSES = [
    "Completed",
    "Rejected",
    "Cancelled",
    "Refunded",
];

const PAGE_SIZE = 20;

// The summary cards' status labels map onto real order statuses. "cancelled"
// deliberately covers BOTH Rejected and Cancelled, which is how this page has
// always presented them (see ORDER_STATUS_META in HistoryCard.jsx, where
// Rejected is labelled "Cancelled").
const STATUS_PARAM = {
    completed: "Completed",
    cancelled: "Rejected,Cancelled",
    refunded: "Refunded",
};

const PAYMENT_PARAM = {
    cash: "CASH",
    online: "RAZORPAY",
};

// Day arithmetic on an IST calendar date. The date is anchored at UTC noon
// before shifting so that adding/subtracting days can never cross a boundary
// in the wrong direction because of the host's own offset.
const shiftISODate = (iso, { days = 0, months = 0 }) => {
    const [year, month, day] = iso.split("-").map(Number);
    const anchored = new Date(Date.UTC(year, month - 1, day, 12));

    if (days) anchored.setUTCDate(anchored.getUTCDate() + days);
    if (months) anchored.setUTCMonth(anchored.getUTCMonth() + months);

    return anchored.toISOString().slice(0, 10);
};

// Turns each preset into the explicit from/to pair the API takes. Previously
// these presets were applied in the browser against the full downloaded
// history, using the host's local timezone -- which quietly produced different
// results for an admin outside IST. Resolving them to IST calendar dates here,
// and to IST instants in the RPC, makes the window timezone-independent.
const dateWindowFor = (dateFilter, selectedDate, dateRange) => {
    const today = todayStr();

    switch (dateFilter) {
        case "today":
            return { from: today, to: today };

        case "yesterday": {
            const yesterday = shiftISODate(today, { days: -1 });
            return { from: yesterday, to: yesterday };
        }

        // Last 7 days inclusive of today, matching the previous `today - 6`.
        case "7days":
            return { from: shiftISODate(today, { days: -6 }), to: today };

        case "3months":
            return { from: shiftISODate(today, { months: -3 }), to: today };

        case "thisMonth":
            return { from: `${today.slice(0, 8)}01`, to: today };

        case "specific":
            return selectedDate
                ? { from: selectedDate, to: selectedDate }
                : {};

        case "range":
            return dateRange.from && dateRange.to
                ? { from: dateRange.from, to: dateRange.to }
                : {};

        // "all" -- no window.
        default:
            return {};
    }
};

const EMPTY_SUMMARY = {
    total: 0,
    completed: 0,
    cancelled: 0,
    refunded: 0,
    revenue: 0,
};

const AdminOrderHistory = () => {
    // Reactive socket: getSocket() returned null on a fresh load because child
    // effects run before SocketProvider's, leaving the listener unattached.
    const socket = useSocket();

    const [orders, setOrders] = useState([]);
    const [summary, setSummary] = useState(EMPTY_SUMMARY);
    const [loading, setLoading] = useState(true);

    // Kept separate from `loading` so an in-flight next page never blanks the
    // rows already on screen.
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadMoreFailed, setLoadMoreFailed] = useState(false);
    const [initialLoadFailed, setInitialLoadFailed] = useState(false);

    // Set when a socket update reports an order that has just become terminal
    // and so belongs in this list, but is not in it. Deliberately a prompt
    // rather than an automatic refetch: re-fetching would throw away every
    // page already scrolled, and the socket payload is a flat orders row with
    // no joined user/items, so it cannot be rendered as a card on its own.
    const [staleList, setStaleList] = useState(false);

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [summaryFilter, setSummaryFilter] = useState("all");
    const [paymentFilter, setPaymentFilter] = useState("all");
    const [showPaymentFilter, setShowPaymentFilter] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Ref, not state: the observer callback needs the current page without
    // being re-created every time it changes.
    const pageRef = useRef(1);

    // Bumped on every filter change. A response carrying an older token
    // belongs to a filter set the user has already moved on from and is
    // dropped, so stale rows can never be appended to a newer list.
    const requestTokenRef = useRef(0);
    const inFlightRef = useRef(false);
    const loadedPagesRef = useRef(new Set());

    const [observerTarget, setObserverTarget] = useState(null);

    const [dateFilter, setDateFilter] = useState("today");
    const [selectedDate, setSelectedDate] = useState("");
    const [dateRange, setDateRange] = useState({
        from: "",
        to: "",
    });

    const [tempDateRange, setTempDateRange] = useState({
        from: "",
        to: "",
    });

    const [showDateFilter, setShowDateFilter] = useState(false);
    const [showSpecificPopup, setShowSpecificPopup] = useState(false);
    const [showRangePopup, setShowRangePopup] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const dateButtonRef = useRef(null);
    const [tempSelectedDate, setTempSelectedDate] = useState("");

    const [popupPosition, setPopupPosition] = useState({
        top: 0,
        left: 0,
    });
    const dateFilterRef = useRef(null);
    const paymentDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {

            if (
                paymentDropdownRef.current &&
                !paymentDropdownRef.current.contains(e.target)
            ) {
                setShowPaymentFilter(false);
            }

            if (
                dateFilterRef.current &&
                !dateFilterRef.current.contains(e.target)
            ) {
                setShowDateFilter(false);
                setShowSpecificPopup(false);
                setShowRangePopup(false);
            }
        };

        if (
            showDateFilter ||
            showPaymentFilter ||
            showSpecificPopup ||
            showRangePopup
        ) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showDateFilter, showPaymentFilter, showSpecificPopup, showRangePopup]);

    // One request per pause in typing rather than one per keystroke. Search is
    // now a server round trip, so this matters; 350ms is short enough that it
    // still feels immediate.
    useEffect(() => {

        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 350);

        return () => clearTimeout(timer);

    }, [search]);

    // Every filter the page offers, resolved to the API's parameters. Search,
    // status, payment and the date window are ALL applied server-side now --
    // none of them may be re-applied to the loaded array, because the loaded
    // array is only ever a prefix of the matching set.
    const queryParams = useMemo(() => {

        const params = {};

        const window = dateWindowFor(dateFilter, selectedDate, dateRange);

        if (window.from) params.from = window.from;
        if (window.to) params.to = window.to;

        // "all", "" and "revenue" all mean "every terminal status", which is
        // the API default, so no status parameter is sent for them.
        const status = STATUS_PARAM[summaryFilter];
        if (status) params.status = status;

        const payment = PAYMENT_PARAM[paymentFilter];
        if (payment) params.payment_method = payment;

        const query = debouncedSearch.trim();
        if (query) params.search = query;

        return params;

    }, [
        dateFilter,
        selectedDate,
        dateRange,
        summaryFilter,
        paymentFilter,
        debouncedSearch,
    ]);

    const loadPage = useCallback(async (pageNumber, { append }) => {

        // Two observer callbacks firing during a fast scroll, or a retry
        // racing the observer, both land here. The in-flight guard makes the
        // second a no-op, and the loaded-pages set stops a page that already
        // arrived from being requested a second time.
        if (inFlightRef.current) return;
        if (loadedPagesRef.current.has(pageNumber)) return;

        inFlightRef.current = true;

        const token = requestTokenRef.current;

        if (append) {
            setLoadingMore(true);
            setLoadMoreFailed(false);
        } else {
            setLoading(true);
            setInitialLoadFailed(false);
        }

        try {

            const { data } = await adminAPI.getHistory({
                ...queryParams,
                page: pageNumber,
                limit: PAGE_SIZE,
            });

            // The filters changed while this was in flight; these rows belong
            // to the previous filter set.
            if (token !== requestTokenRef.current) return;

            if (!data || !Array.isArray(data.orders)) {
                throw new Error("Invalid orders data");
            }

            loadedPagesRef.current.add(pageNumber);
            pageRef.current = pageNumber;

            setOrders((prev) => {

                if (!append) return data.orders;

                // Offset pagination can hand back a row already held if the
                // underlying set shifted between requests, so append by id.
                const seen = new Set(prev.map((order) => order.id));

                return [
                    ...prev,
                    ...data.orders.filter((order) => !seen.has(order.id)),
                ];
            });

            setSummary(data.summary || EMPTY_SUMMARY);
            setHasMore(Boolean(data.pagination?.hasMore));

        } catch (err) {

            if (token !== requestTokenRef.current) return;

            console.error("Failed to fetch order history:", err?.message);

            if (append) {
                // Existing rows stay on screen; only this page failed.
                setLoadMoreFailed(true);
            } else {
                setOrders([]);
                setSummary(EMPTY_SUMMARY);
                setHasMore(false);
                setInitialLoadFailed(true);
                toast.error("Failed to fetch order history");
            }

        } finally {

            inFlightRef.current = false;

            if (token === requestTokenRef.current) {
                if (append) setLoadingMore(false);
                else setLoading(false);
            }
        }

    }, [queryParams]);

    // Filter change: invalidate everything in flight, drop the old rows, and
    // start again at page 1. `loadPage` changes identity exactly when
    // `queryParams` does, so this runs once per filter change and not on
    // unrelated re-renders.
    useEffect(() => {

        requestTokenRef.current += 1;
        loadedPagesRef.current = new Set();
        inFlightRef.current = false;
        pageRef.current = 1;

        setOrders([]);
        setHasMore(false);
        setLoadMoreFailed(false);
        setStaleList(false);

        loadPage(1, { append: false });

    }, [loadPage]);

    const loadNextPage = useCallback(() => {
        loadPage(pageRef.current + 1, { append: true });
    }, [loadPage]);

    // A single observer, re-created only when the sentinel or the conditions
    // for loading change, and disconnected on every cleanup so no second
    // observer can ever be watching the same node.
    useEffect(() => {

        if (!observerTarget) return;
        if (!hasMore || loading || loadingMore || loadMoreFailed) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadNextPage();
                }
            },
            {
                threshold: 0.2,
                rootMargin: "200px",
            }
        );

        observer.observe(observerTarget);

        return () => observer.disconnect();

    }, [
        observerTarget,
        hasMore,
        loading,
        loadingMore,
        loadMoreFailed,
        loadNextPage,
    ]);

    const refreshFromStart = useCallback(() => {

        requestTokenRef.current += 1;
        loadedPagesRef.current = new Set();
        inFlightRef.current = false;
        pageRef.current = 1;

        setOrders([]);
        setHasMore(false);
        setLoadMoreFailed(false);
        setStaleList(false);

        loadPage(1, { append: false });

    }, [loadPage]);

    // Split from the fetch above so it can depend on `socket`. The handler is
    // a stored reference and cleanup passes it to off(); the previous
    // socket.off(ORDER_UPDATED) removed every listener for that event on the
    // shared socket, including other components'.
    // Mirrors the latest orders so the socket handler can test membership
    // synchronously without a stale closure.
    const ordersRef = useRef(orders);

    useEffect(() => {
        ordersRef.current = orders;
    }, [orders]);

    // The statuses currently on screen, so an order that no longer matches can
    // be dropped rather than left showing a status the filter excludes.
    const activeStatuses = useMemo(() => {
        const status = STATUS_PARAM[summaryFilter];

        return status ? status.split(",") : HISTORY_STATUSES;
    }, [summaryFilter]);

    const activeStatusesRef = useRef(activeStatuses);

    useEffect(() => {
        activeStatusesRef.current = activeStatuses;
    }, [activeStatuses]);

    useEffect(() => {

        if (!socket) return;

        // This page only ever holds terminal orders. Every Pending -> Accepted
        // -> Preparing -> Ready transition previously triggered a full refetch
        // of the whole history for an order that cannot belong here yet, which
        // was the single most wasteful refetch in the admin UI.
        //
        // Now that the list is paginated there is a second reason not to
        // refetch: doing so would discard every page already scrolled and
        // reset the infinite scroll to the top. So this handler only ever
        // edits rows it already holds, and flags -- rather than fetches -- the
        // one case it cannot render on its own.
        const handleOrderUpdate = (updatedOrder) => {

            if (!updatedOrder?.id) return;

            if (!HISTORY_STATUSES.includes(updatedOrder.status)) {
                return;
            }

            const alreadyListed = ordersRef.current.some(
                (order) => order.id === updatedOrder.id
            );

            if (!alreadyListed) {
                // Just became terminal, so it belongs in this list -- but the
                // payload is a flat orders row with no joined user or items,
                // and inserting it would also shift every offset-paginated
                // page boundary. Surface it instead and let the admin reload.
                setStaleList(true);
                return;
            }

            // No longer matches the status filter the user is looking at.
            if (!activeStatusesRef.current.includes(updatedOrder.status)) {
                setOrders((prev) =>
                    prev.filter((order) => order.id !== updatedOrder.id)
                );

                setStaleList(true);
                return;
            }

            // Flat orders row: spread rather than replace so the joined
            // user/order_items data the cards render is preserved.
            setOrders((prev) =>
                prev.map((order) =>
                    order.id === updatedOrder.id
                        ? { ...order, ...updatedOrder }
                        : order
                )
            );
        };

        socket.on(SocketEvents.ORDER_UPDATED, handleOrderUpdate);

        return () => {
            socket.off(SocketEvents.ORDER_UPDATED, handleOrderUpdate);
        };

    }, [socket]);

    // No client-side date/payment/status/search filtering and no client-side
    // aggregation remain. `orders` is a prefix of the server's already-filtered
    // result set, so re-filtering it here would only ever hide matching rows
    // that live on pages not yet loaded, and `summary` comes from the server
    // computed over the whole filtered set rather than the loaded prefix.
    //
    // Summary scope note: the cards span the date + payment window but are
    // deliberately NOT narrowed by the status cards or the search box. That is
    // the behaviour this page has always had -- the cards are the breakdown
    // you click to apply a status filter, so they have to keep showing the
    // totals you are choosing between.

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-24 rounded-2xl bg-slate-200 animate-pulse" />
                    ))}
                </div>
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 rounded-2xl bg-slate-200 animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="relative z-10"></div>

            {/* HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Order History</h2>
                    <p className="text-gray-500 text-sm mt-1">View completed, cancelled and refunded orders</p>
                </div>

                <div className="flex items-center gap-2">
                    {/* DATE RANGE PICKER */}
                    <div className="relative" ref={dateFilterRef}>
                        <button
                            ref={dateButtonRef}
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();

                                setPopupPosition({
                                    top: rect.bottom + 8,
                                    left: rect.right,
                                });

                                setShowDateFilter((v) => !v);
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition whitespace-nowrap"
                        >
                            <Calendar size={15} className="text-blue-500" />

                            <span>
                                {dateFilter === "all" && "All Orders"}
                                {dateFilter === "today" && "Today"}
                                {dateFilter === "yesterday" && "Yesterday"}
                                {dateFilter === "7days" && "Last 7 Days"}
                                {dateFilter === "3months" && "Last 3 Months"}
                                {dateFilter === "thisMonth" && "This Month"}

                                {dateFilter === "specific" &&
                                    (selectedDate
                                        ? new Date(selectedDate).toLocaleDateString("en-GB")
                                        : "Specific Date")}

                                {dateFilter === "range" &&
                                    (dateRange.from && dateRange.to
                                        ? `${new Date(dateRange.from).toLocaleDateString("en-GB")} - ${new Date(dateRange.to).toLocaleDateString("en-GB")}`
                                        : "Custom Range")}
                            </span>

                            <ChevronDown size={15} className="text-slate-400" />
                        </button>

                        {showDateFilter && (
                            <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-[9999] overflow-hidden">

                                <button
                                    onClick={() => {
                                        setDateFilter("all");
                                        setShowDateFilter(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50"
                                >
                                    All Orders
                                </button>

                                <button
                                    onClick={() => {
                                        setDateFilter("today");
                                        setShowDateFilter(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50"
                                >
                                    Today
                                </button>

                                <button
                                    onClick={() => {
                                        setDateFilter("yesterday");
                                        setShowDateFilter(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50"
                                >
                                    Yesterday
                                </button>

                                <button
                                    onClick={() => {
                                        setDateFilter("7days");
                                        setShowDateFilter(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50"
                                >
                                    Last 7 Days
                                </button>

                                <button
                                    onClick={() => {
                                        setDateFilter("3months");
                                        setShowDateFilter(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50"
                                >
                                    Last 3 Months
                                </button>

                                <button
                                    onClick={() => {
                                        setDateFilter("thisMonth");
                                        setShowDateFilter(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50"
                                >
                                    This Month
                                </button>

                                <div className="border-t border-slate-200 my-1" />

                                <button
                                    onClick={() => {
                                        setTempSelectedDate(selectedDate);
                                        setDateFilter("specific");
                                        setShowSpecificPopup(true);
                                        setShowRangePopup(false);
                                        setShowDateFilter(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50"
                                >
                                    Specific Date
                                </button>

                                <button
                                    onClick={() => {
                                        setTempDateRange(dateRange);
                                        setDateFilter("range");
                                        setShowRangePopup(true);
                                        setShowSpecificPopup(false);
                                        setShowDateFilter(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50"
                                >
                                    Custom Range
                                </button>

                            </div>
                        )}

                        <AnimatePresence>
                            {showSpecificPopup &&
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                                    transition={{
                                        duration: 0.18,
                                        ease: "easeOut",
                                    }}
                                    style={{
                                        position: "fixed",
                                        top: popupPosition.top,
                                        left: Math.max(
                                            16,
                                            Math.min(
                                                popupPosition.left - 320,
                                                window.innerWidth - 336
                                            )
                                        ),
                                        width: Math.min(320, window.innerWidth - 32),
                                    }}
                                    className="bg-white border border-slate-200 rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,.18)] z-[99999] p-5"
                                >

                                    {/* Header */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                                            <CalendarDays size={18} className="text-blue-600" />
                                        </div>

                                        <div>
                                            <h3 className="text-base font-semibold text-slate-800">
                                                Select Date
                                            </h3>

                                            <p className="text-xs text-slate-500">
                                                Choose a date to filter orders
                                            </p>
                                        </div>
                                    </div>

                                    {/* Date Picker */}
                                    <DatePicker
                                        selected={toDate(tempSelectedDate)}
                                        onChange={(date) => {
                                            setTempSelectedDate(toISO(date));
                                            setIsCalendarOpen(false);
                                        }}
                                        open={isCalendarOpen}
                                        onClickOutside={() => setIsCalendarOpen(false)}
                                        onSelect={() => setIsCalendarOpen(false)}
                                        onInputClick={() => setIsCalendarOpen(false)}
                                        dateFormat="dd-MM-yyyy"
                                        placeholderText="DD-MM-YYYY"
                                        maxDate={new Date()}
                                        showPopperArrow={false}
                                        calendarStartDay={1}
                                        showIcon
                                        icon={
                                            <CalendarDays
                                                size={18}
                                                className="cursor-pointer text-blue-600"
                                                onClick={() => setIsCalendarOpen(true)}
                                            />
                                        }
                                        toggleCalendarOnIconClick={false}
                                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition-all
                           focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    />

                                    {/* Footer */}
                                    <div className="mt-5 border-t border-slate-100 pt-4">
                                        <div className="flex justify-end gap-3">
                                            <button
                                                onClick={() => {
                                                    setTempSelectedDate(selectedDate);
                                                    setIsCalendarOpen(false);
                                                    setShowSpecificPopup(false);
                                                }}
                                                className="h-11 flex-1 sm:flex-none px-6 rounded-xl border border-slate-300 bg-white text-slate-600 font-medium hover:bg-slate-50 transition"
                                            >
                                                Cancel
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setSelectedDate(tempSelectedDate);
                                                    setDateFilter("specific");
                                                    setIsCalendarOpen(false);
                                                    setShowSpecificPopup(false);
                                                }}
                                                className="h-11 flex-1 sm:flex-none px-6 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            }
                        </AnimatePresence>

                        <AnimatePresence>
                            {showRangePopup && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                                    transition={{
                                        duration: 0.18,
                                        ease: "easeOut",
                                    }}
                                    style={{
                                        position: "fixed",
                                        top: popupPosition.top,
                                        left: Math.max(
                                            16,
                                            Math.min(
                                                popupPosition.left - 320,
                                                window.innerWidth - 336
                                            )
                                        ),
                                        width: Math.min(320, window.innerWidth - 32),
                                    }}
                                    className="bg-white border border-slate-200 rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,.18)] z-[99999] p-5"
                                >
                                    {/* Header */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                                            <CalendarDays size={18} className="text-blue-600" />
                                        </div>

                                        <div>
                                            <h3 className="text-base font-semibold text-slate-800">
                                                Custom Range
                                            </h3>

                                            <p className="text-xs text-slate-500">
                                                Select a start and end date
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">

                                        {/* From */}
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">
                                                From
                                            </label>

                                            <DatePicker
                                                selected={toDate(tempDateRange.from)}
                                                onChange={(date) =>
                                                    setTempDateRange((prev) => ({
                                                        ...prev,
                                                        from: toISO(date),
                                                    }))
                                                }
                                                dateFormat="dd-MM-yyyy"
                                                placeholderText="Select From Date"
                                                maxDate={new Date()}
                                                showPopperArrow={false}
                                                calendarStartDay={1}
                                                className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 text-sm font-semibold text-slate-700 outline-none transition-all
                        focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </div>

                                        {/* To */}
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">
                                                To
                                            </label>

                                            <DatePicker
                                                selected={toDate(tempDateRange.to)}
                                                onChange={(date) =>
                                                    setTempDateRange((prev) => ({
                                                        ...prev,
                                                        to: toISO(date),
                                                    }))
                                                }
                                                dateFormat="dd-MM-yyyy"
                                                placeholderText="Select To Date"
                                                minDate={toDate(tempDateRange.from)}
                                                maxDate={new Date()}
                                                showPopperArrow={false}
                                                calendarStartDay={1}
                                                className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 text-sm font-semibold text-slate-700 outline-none transition-all
                        focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </div>

                                    </div>

                                    {/* Footer */}
                                    <div className="mt-5 border-t border-slate-100 pt-4">
                                        <div className="flex justify-end gap-3">

                                            <button
                                                onClick={() => {
                                                    setTempDateRange(dateRange);
                                                    setShowRangePopup(false);
                                                }}
                                                className="h-11 flex-1 sm:flex-none px-6 rounded-xl border border-slate-300 bg-white text-slate-600 font-medium hover:bg-slate-50 transition"
                                            >
                                                Cancel
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setDateRange(tempDateRange);
                                                    setDateFilter("range");
                                                    setShowRangePopup(false);
                                                }}
                                                className="h-11 flex-1 sm:flex-none px-6 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
                                            >
                                                Apply
                                            </button>

                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>


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
                                    className={`flex w-full items-center justify-between px-4 py-3 transition ${paymentFilter === "all"
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
                                    className={`flex w-full items-center justify-between px-4 py-3 transition ${paymentFilter === "cash"
                                        ? "bg-blue-50 text-blue-600 font-semibold"
                                        : "hover:bg-slate-50"
                                        }`}
                                >
                                    <span>💵 Cash</span>
                                    {paymentFilter === "cash" && <span>✓</span>}
                                </button>

                                <button
                                    onClick={() => {
                                        setPaymentFilter("online");
                                        setShowPaymentFilter(false);
                                    }}
                                    className={`flex w-full items-center justify-between px-4 py-3 transition ${paymentFilter === "online"
                                        ? "bg-blue-50 text-blue-600 font-semibold"
                                        : "hover:bg-slate-50"
                                        }`}
                                >
                                    <span>💳 Online</span>
                                    {paymentFilter === "online" && <span>✓</span>}
                                </button>

                                <div className="border-t border-slate-200" />

                                <button
                                    onClick={() => {
                                        setPaymentFilter("all");
                                        setSummaryFilter("all");
                                        setSearch("");
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
            </div>

            {/* SEARCH */}
            <div className="relative">
                <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by Order ID, Customer Name, Phone Number"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
            </div>


            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <SummaryCard
                    icon={ClipboardList}
                    label="Total Orders"
                    value={summary.total}
                    bg="bg-blue-50"
                    color="text-blue-600"
                    delay={0}
                    onClick={() =>
                        setSummaryFilter((prev) => (prev === "all" ? "" : "all"))
                    }
                    isActive={summaryFilter === "all"}
                />
                <SummaryCard
                    icon={CheckCircle2}
                    label="Completed"
                    value={summary.completed}
                    bg="bg-green-50"
                    color="text-green-600"
                    delay={0.05}
                    onClick={() =>
                        setSummaryFilter((prev) =>
                            prev === "completed" ? "" : "completed"
                        )
                    }
                    isActive={summaryFilter === "completed"}
                />

                <SummaryCard
                    icon={XCircle}
                    label="Cancelled"
                    value={summary.cancelled}
                    bg="bg-red-50"
                    color="text-red-500"
                    delay={0.1}
                    onClick={() =>
                        setSummaryFilter((prev) =>
                            prev === "cancelled" ? "" : "cancelled"
                        )
                    }
                    isActive={summaryFilter === "cancelled"}
                />

                <SummaryCard
                    icon={RefreshCw}
                    label="Refunded"
                    value={summary.refunded}
                    bg="bg-cyan-50"
                    color="text-cyan-600"
                    delay={0.15}
                    onClick={() =>
                        setSummaryFilter((prev) =>
                            prev === "refunded" ? "" : "refunded"
                        )
                    }
                    isActive={summaryFilter === "refunded"}
                />

                <SummaryCard icon={Wallet} label="Total Revenue" value={`₹${summary.revenue.toLocaleString("en-IN")}`} bg="bg-blue-50" color="text-blue-600" delay={0.15}
                    onClick={() =>
                        setSummaryFilter((prev) =>
                            prev === "revenue" ? "" : "revenue"
                        )
                    }
                    isActive={summaryFilter === "revenue"} />

            </div>

            {/* NEW-HISTORY PROMPT */}
            {staleList && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <p className="text-sm font-medium text-blue-700">
                        An order has moved into history since this list loaded.
                    </p>

                    <button
                        onClick={refreshFromStart}
                        className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                        Refresh
                    </button>
                </div>
            )}

            {/* HISTORY LIST */}
            {orders.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                    {initialLoadFailed
                        ? "Could not load order history."
                        : "No history matches your filters."}

                    {initialLoadFailed && (
                        <div className="mt-4">
                            <button
                                onClick={refreshFromStart}
                                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                                Try again
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map((order) => (
                        <HistoryCard key={order.id} order={order} onViewDetails={setSelectedOrder} />
                    ))}
                </div>
            )}

            {/* INFINITE SCROLL FOOT */}
            {orders.length > 0 && (
                <div className="pt-2">

                    {loadingMore && (
                        <div
                            className="space-y-4"
                            role="status"
                            aria-live="polite"
                            aria-label="Loading more orders"
                        >
                            {[1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="h-32 rounded-2xl bg-slate-200 animate-pulse"
                                />
                            ))}
                        </div>
                    )}

                    {loadMoreFailed && (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <p className="text-sm text-slate-500">
                                Could not load more orders.
                            </p>

                            <button
                                onClick={loadNextPage}
                                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {!hasMore && !loadingMore && !loadMoreFailed && (
                        <p className="py-6 text-center text-sm text-gray-400">
                            No more orders
                        </p>
                    )}

                    {/* Sentinel. Sits after the rows so it only enters the
                        viewport once the admin has actually reached the end. */}
                    <div ref={setObserverTarget} aria-hidden="true" className="h-px" />
                </div>
            )}


            <ViewDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />

        </div>
    );
};

export default AdminOrderHistory;