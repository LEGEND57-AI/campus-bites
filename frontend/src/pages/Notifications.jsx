import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
    Bell,
    Check,
    SlidersHorizontal,
} from "lucide-react";

import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import MobileBottomNav from "../components/dashboard/MobileBottomNav";
import NotificationCard from "../components/notifications/NotificationCard";
import NotificationSkeleton from "../components/notifications/NotificationSkeleton";

import { notificationAPI } from "../services/api";


const CATEGORY_MAP = {
    order_placed: "orders",
    order_confirmed: "orders",
    order_ready: "orders",
    order_completed: "orders",
    order_cancelled: "orders",
    payment_received: "payments",
    system_update: "system",
    announcement: "updates",
};

const getDateGroup = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();

    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const dayDiff = Math.floor(
        (startOfDay(now) - startOfDay(date)) / (1000 * 60 * 60 * 24)
    );

    if (dayDiff === 0) return "Today";
    if (dayDiff === 1) return "Yesterday";
    if (dayDiff <= 7) return "This Week";
    return "Earlier";
};

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "Earlier"];

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadNotifications = useCallback(async () => {
        setLoading(true);

        try {
            const { data } = await notificationAPI.getNotifications();

            setNotifications(data.notifications || data || []);

        } catch (err) {
            console.error(err);
            toast.error("Failed to load notifications");
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshNotifications = useCallback(async () => {
        try {
            const { data } = await notificationAPI.getNotifications();

            setNotifications(data.notifications || data || []);
        } catch (err) {
            console.error(err);
        }
    }, []);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!document.hidden && !loading) {
                refreshNotifications();
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [refreshNotifications, loading]);

    const handleMarkRead = async (id) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
        await notificationAPI.markAsRead(id);
    };

    const handleMarkAllRead = async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        await notificationAPI.markAllAsRead();
        toast.success("All notifications marked as read");
    };

    const handleDelete = async (id) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        await notificationAPI.deleteNotification(id);
    };

    const filteredNotifications = useMemo(() => {
        return notifications;
    }, [notifications]);

    const groupedNotifications = useMemo(() => {
        const groups = {};

        filteredNotifications.forEach((n) => {
            const group = getDateGroup(n.created_at);
            if (!groups[group]) groups[group] = [];
            groups[group].push(n);
        });

        return GROUP_ORDER.filter((g) => groups[g]?.length).map((g) => ({
            label: g,
            items: groups[g],
        }));
    }, [filteredNotifications]);

    const unreadInView = filteredNotifications.filter((n) => !n.is_read).length;

    return (
        <div className="min-h-screen bg-[#F3F6FB] p-3 lg:p-5">

            <div
                className="
        bg-white
        rounded-[32px]
        overflow-hidden
        min-h-[calc(100vh-24px)]
        shadow-[0_15px_40px_rgba(0,0,0,0.08)]
        flex
      "
            >

                <Sidebar />

                <div className="flex-1 min-w-0">

                    <DashboardHeader />

                    <main
                        className="
            px-4
            md:px-6
            lg:px-8
            py-5
            pb-24
          "
                    >

                        <div className="space-y-6">

                            {/* HEADER */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Notifications</h2>
                                    <p className="text-gray-500 text-sm mt-1">Stay updated with real-time alerts and important updates</p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={handleMarkAllRead}
                                        disabled={unreadInView === 0}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition"
                                    >
                                        <Check size={15} />
                                        Mark all as read
                                    </button>

                                </div>
                            </div>


                            {/* LIST */}
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <NotificationSkeleton key={i} />
                                    ))}
                                </div>
                            ) : filteredNotifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-100">
                                    <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-5">
                                        <Bell size={32} className="text-blue-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800">No Notifications Yet</h3>
                                    <p className="text-sm text-slate-400 mt-1.5 max-w-xs">
                                        We'll notify you whenever there are important updates, order changes, or announcements.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {groupedNotifications.map((group) => (
                                        <div key={group.label}>
                                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3">
                                                {group.label}
                                            </h3>

                                            <div className="space-y-3">
                                                <AnimatePresence initial={false}>
                                                    {group.items.map((notification) => (
                                                        <NotificationCard
                                                            key={notification.id}
                                                            notification={notification}
                                                            onMarkRead={handleMarkRead}
                                                            onDelete={handleDelete}
                                                        />
                                                    ))}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    ))}


                                </div>
                            )}

                        </div>

                    </main>

                    <MobileBottomNav />

                </div>

            </div>

        </div>
    );
};

export default Notifications;