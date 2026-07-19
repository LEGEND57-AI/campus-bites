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
    Wallet,
} from "lucide-react";


const REFRESH_INTERVAL = 30000;


const todayStr = () => new Date().toISOString().split("T")[0];
const formatDisplay = (iso) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const formatToken = (order) =>
    order.token_number ? `#${String(order.token_number).padStart(2, "0")}` : `#${order.id}`;

const toDate = (value) => (value ? new Date(value) : null);

const toISO = (date) => {
    if (!date) return "";
    return date.toISOString().split("T")[0];
};

const AdminOrderHistory = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState("");
    const [summaryFilter, setSummaryFilter] = useState("all");
    const [paymentFilter, setPaymentFilter] = useState("all");
    const [showPaymentFilter, setShowPaymentFilter] = useState(false);
    const [page, setPage] = useState(1);
    const [selectedOrder, setSelectedOrder] = useState(null);

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

    const fetchOrders = useCallback(async () => {
        try {

            const params = {};

            if (dateFilter === "specific" && selectedDate) {

                params.from = selectedDate;
                params.to = selectedDate;

            }

            if (
                dateFilter === "range" &&
                dateRange.from &&
                dateRange.to
            ) {

                params.from = dateRange.from;
                params.to = dateRange.to;

            }

            const { data } = await adminAPI.getHistory(params);

            if (!Array.isArray(data)) {
                setOrders([]);
                toast.error(data?.error || "Invalid orders data");
                return;
            }
            setOrders(data);
        } catch (err) {
            console.error("Failed to fetch order history:", err);
            toast.error("Failed to fetch order history");
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [dateFilter, selectedDate, dateRange]);

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchOrders]);

    const dateFilteredOrders = useMemo(() => {
        return orders.filter((order) => {
            const orderDate = new Date(order.created_at);
            const today = new Date();

            today.setHours(0, 0, 0, 0);

            if (dateFilter === "today") {
                const d = new Date(orderDate);
                d.setHours(0, 0, 0, 0);

                if (d.getTime() !== today.getTime()) return false;
            }

            if (dateFilter === "yesterday") {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);

                const d = new Date(orderDate);
                d.setHours(0, 0, 0, 0);

                if (d.getTime() !== yesterday.getTime()) return false;
            }

            if (dateFilter === "7days") {
                const last7 = new Date(today);
                last7.setDate(last7.getDate() - 6);

                if (orderDate < last7) return false;
            }

            if (dateFilter === "3months") {
                const last3 = new Date(today);
                last3.setMonth(last3.getMonth() - 3);

                if (orderDate < last3) return false;
            }

            if (dateFilter === "thisMonth") {
                if (
                    orderDate.getMonth() !== today.getMonth() ||
                    orderDate.getFullYear() !== today.getFullYear()
                ) {
                    return false;
                }
            }

            return true;
        });
    }, [orders, dateFilter]);

    const filteredOrders = useMemo(() => {
        return dateFilteredOrders.filter((order) => {

            // Payment Filter
            if (
                paymentFilter === "cash" &&
                order.payment_method !== "CASH"
            ) {
                return false;
            }

            if (
                paymentFilter === "online" &&
                order.payment_method !== "RAZORPAY"
            ) {
                return false;
            }

            if (summaryFilter === "completed" && order.status !== "Completed") {
                return false;
            }

            if (summaryFilter === "cancelled" && order.status !== "Rejected") {
                return false;
            }

            if (search.trim()) {
                const q = search.trim().toLowerCase();

                const matchesId = String(order.id).toLowerCase().includes(q);
                const matchesToken = formatToken(order).toLowerCase().includes(q);
                const matchesName = order.user?.name?.toLowerCase().includes(q);
                const matchesPhone = order.user?.phone?.toLowerCase().includes(q);

                if (!matchesId && !matchesToken && !matchesName && !matchesPhone) {
                    return false;
                }
            }

            return true;
        });
    }, [dateFilteredOrders, search, summaryFilter, paymentFilter]);

    useEffect(() => {
        setPage(1);
    }, [search, dateFilter, summaryFilter]);


    const paginatedOrders = filteredOrders;

    // ---------- Summary (over filtered set, not just current page) ----------
    const summary = useMemo(() => {

        const paymentFilteredOrders = dateFilteredOrders.filter((order) => {
            if (
                paymentFilter === "cash" &&
                order.payment_method !== "CASH"
            ) {
                return false;
            }

            if (
                paymentFilter === "online" &&
                order.payment_method !== "RAZORPAY"
            ) {
                return false;
            }

            return true;
        });

        const completed = paymentFilteredOrders.filter(
            (o) => o.status === "Completed"
        );

        const cancelled = paymentFilteredOrders.filter(
            (o) => o.status === "Rejected"
        );

        const revenue = completed.reduce(
            (sum, o) => sum + Number(o.total_amount || 0),
            0
        );

        return {
            total: paymentFilteredOrders.length,
            completed: completed.length,
            cancelled: cancelled.length,
            revenue,
        };
    }, [dateFilteredOrders, paymentFilter]);


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
                    <p className="text-gray-500 text-sm mt-1">View completed and cancelled orders</p>
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
                                        setPage(1);
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                <SummaryCard icon={Wallet} label="Total Revenue" value={`₹${summary.revenue.toLocaleString("en-IN")}`} bg="bg-blue-50" color="text-blue-600" delay={0.15}
                    onClick={() =>
                        setSummaryFilter((prev) =>
                            prev === "revenue" ? "" : "revenue"
                        )
                    }
                    isActive={summaryFilter === "revenue"} />

            </div>

            {/* HISTORY LIST */}
            {filteredOrders.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                    No history matches your filters.
                </div>
            ) : (
                <div className="space-y-4">
                    {paginatedOrders.map((order) => (
                        <HistoryCard key={order.id} order={order} onViewDetails={setSelectedOrder} />
                    ))}
                </div>
            )}


            <ViewDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />

        </div>
    );
};

export default AdminOrderHistory;