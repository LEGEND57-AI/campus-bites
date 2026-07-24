import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
    CheckCircle2,
    XCircle,
    RotateCcw,
    MoreVertical,
    Eye,
    Printer,
    FileDown,
} from "lucide-react";

const ORDER_STATUS_META = {
    Completed: {
        label: "Completed",
        icon: CheckCircle2,
        badge: "bg-green-100 text-green-700",
        iconColor: "text-green-500"
    },

    Refunded: {
        label: "Refunded",
        icon: RotateCcw,
        badge: "bg-cyan-100 text-cyan-700",
        iconColor: "text-cyan-600",
    },

    Rejected: {
        label: "Cancelled",
        icon: XCircle,
        badge: "bg-red-100 text-red-700",
        iconColor: "text-red-500"
    },
};

const PAYMENT_STYLES = {
    PAID: "bg-green-100 text-green-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    FAILED: "bg-red-100 text-red-700",
    REFUNDED: "bg-orange-100 text-orange-700",
    CANCELLED: "bg-red-100 text-red-700",
};

const formatAmount = (amount) => `₹${Number(amount || 0).toFixed(2)}`;

const formatDateParts = (date) => {
    if (!date) return { day: "—", time: "—" };
    const d = new Date(date);
    return {
        day: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
    };
};

const formatToken = (order) =>
    order.token_number ? `#${String(order.token_number).padStart(2, "0")}` : `#${order.id}`;

const MAX_ITEMS_PREVIEW = 3;

const HistoryCard = ({ order, onViewDetails }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
        };
        if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuOpen]);

    const statusMeta = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.Rejected;
    const StatusIcon = statusMeta.icon;

    const isRefunded = order.status === "Refunded";
    const paymentBadgeClass = PAYMENT_STYLES[order.payment_status] || "bg-gray-100 text-gray-700";

    const { day, time } = formatDateParts(order.created_at);
    const items = order.order_items || [];
    const visibleItems = items.slice(0, MAX_ITEMS_PREVIEW);
    const extraCount = items.length - MAX_ITEMS_PREVIEW;

    const handleMenuAction = (action) => {
        setMenuOpen(false);
        if (action === "view") onViewDetails(order);
        if (action === "print") toast("Print Receipt coming soon", { icon: "🖨️" });
        if (action === "download") toast("Download Invoice coming soon", { icon: "📄" });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            className="relative rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow p-4 sm:p-5"
        >
            {/* THREE DOT MENU */}
            <div className="absolute top-2 right-1" ref={menuRef}>
                <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                    <MoreVertical size={17} />
                </button>

                <AnimatePresence>
                    {menuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.97 }}
                            transition={{ duration: 0.12 }}
                            className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-20"
                        >
                            <button
                                onClick={() => handleMenuAction("view")}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition"
                            >
                                <Eye size={15} /> View Details
                            </button>
                            <button
                                onClick={() => handleMenuAction("print")}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition"
                            >
                                <Printer size={15} /> Print Receipt
                            </button>
                            <button
                                onClick={() => handleMenuAction("download")}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition"
                            >
                                <FileDown size={15} /> Download Invoice
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[140px_minmax(0,700px)_170px]">

                {/* LEFT: Token + status */}
                <div className="flex sm:flex-col gap-4 sm:gap-0">
                    <div className="shrink-0 w-[110px] sm:w-auto rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:p-4 text-center">
                        <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-400 font-semibold">Token</p>
                        <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-800">{formatToken(order)}</h2>

                        <div className={`mt-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.badge}`}>
                            <StatusIcon size={12} />
                            {statusMeta.label}
                        </div>

                        <p className="mt-2.5 text-[11px] text-gray-500">{day}</p>
                        <p className="text-[11px] text-gray-400">{time}</p>
                    </div>

                    {/* Customer — mobile only, next to token */}
                    <div className="flex flex-col justify-center gap-1.5 sm:hidden min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 truncate">{order.user?.name || "Unknown"}</h3>
                        <p className="text-xs text-gray-500 truncate">+91 {order.user?.phone || "Not Available"}</p>
                    </div>
                </div>

                {/* CENTER: Customer + items */}
                <div className="min-w-0 max-w-[700px] space-y-3">

                    <div className="hidden sm:block">
                        <h3 className="text-lg font-bold text-gray-900">{order.user?.name || "Unknown"}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">+91 {order.user?.phone || "Not Available"}</p>
                    </div>

                    <div className="space-y-1.5">
                        {visibleItems.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                                <span className="text-slate-600 truncate">
                                    <span className="font-semibold text-slate-800">{item.quantity}x</span> {item.food_items?.name || "Unknown Item"}
                                </span>
                            </div>
                        ))}
                        {extraCount > 0 && (
                            <p className="text-xs font-semibold text-blue-600">+{extraCount} More</p>
                        )}
                    </div>

                    <button
                        onClick={() => onViewDetails(order)}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
                    >
                        View Details →
                    </button>
                </div>

                {/* RIGHT: Total + payment */}
                <div className="relative text-center sm:border-l sm:border-slate-100 sm:pl-5 lg:pr-8 xl:pr-10 flex sm:flex-col sm:items-center justify-between sm:justify-start gap-2">
                    <div className="w-full text-center">
                        <p className="text-xs text-gray-400">Total Amount</p>
                        <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-0.5">
                            {formatAmount(order.total_amount)}
                        </p>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-2 mt-3 w-full">
                        <p className="text-xs text-gray-500">
                            {order.payment_method === "CASH" ? "Cash" : order.payment_method === "UPI" ? "UPI" : "Online"}
                        </p>
                        <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isRefunded
                                    ? "bg-cyan-100 text-cyan-700"
                                    : paymentBadgeClass
                                }`}
                        >
                            {isRefunded && <RotateCcw size={11} />}
                            {isRefunded ? "REFUNDED" : (order.payment_status || "UNKNOWN")}
                        </span>
                    </div>
                </div>

            </div>
        </motion.div>
    );
};

export default HistoryCard;