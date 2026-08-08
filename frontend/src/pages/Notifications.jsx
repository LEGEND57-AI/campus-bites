import React, {
    useCallback,
    useEffect,
    useMemo,
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

import { getSocket } from "../socket/socket";
import { SocketEvents } from "../socket/constants";

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
    const [page, setPage] = useState(1);

    const [hasMore, setHasMore] = useState(true);

    const [loadingMore, setLoadingMore] = useState(false);

    const [observerTarget, setObserverTarget] = useState(null);

    const loadNotifications = useCallback(
        async (pageNumber = 1, append = false) => {

            if (pageNumber === 1) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            try {

                const { data } =
                    await notificationAPI.getNotifications(
                        pageNumber,
                        10
                    );

                if (append) {

                    setNotifications(prev => {

                        const ids = new Set(prev.map(n => n.id));

                        const newNotifications =
                            data.notifications.filter(
                                n => !ids.has(n.id)
                            );

                        return [
                            ...prev,
                            ...newNotifications,
                        ];

                    });

                } else {

                    setNotifications(
                        data.notifications
                    );

                }

                setHasMore(data.hasMore);

            } catch (err) {

                console.error(err);

                toast.error(
                    "Failed to load notifications"
                );

            } finally {

                setLoading(false);

                setLoadingMore(false);

            }

        },
        []
    );


    useEffect(() => {

        loadNotifications(1, false);

        const socket = getSocket();

        if (socket) {

            socket.on(SocketEvents.NOTIFICATION_NEW, (notification) => {

                setNotifications((prev) => {

                    if (prev.some((n) => n.id === notification.id)) {
                        return prev;
                    }

                    return [
                        notification,
                        ...prev,
                    ];

                });

                setHasMore(true);


            });

        }

        return () => {
            socket?.off(SocketEvents.NOTIFICATION_NEW);
        };

    }, [loadNotifications]);


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

    useEffect(() => {

        if (!observerTarget || !hasMore || loadingMore) return;

        const observer = new IntersectionObserver(

            (entries) => {

                if (entries[0].isIntersecting) {

                    setPage((prev) => {
                        const next = prev + 1;
                        loadNotifications(next, true);
                        return next;
                    });

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
        loadingMore,
        loadNotifications,

    ]);

    const unreadInView = filteredNotifications.filter((n) => !n.is_read).length;

    return (
        <div className="min-h-screen bg-[#F3F6FB] p-0 md:p-3 lg:p-5">

            <div
                className="
            bg-white
            flex
            min-h-screen

            rounded-none
            shadow-none
            overflow-visible

            md:rounded-[32px]
            md:overflow-hidden
            md:min-h-[calc(100vh-24px)]
            md:shadow-[0_15px_40px_rgba(0,0,0,0.08)]
        "
            >

                <Sidebar />

                <div className="flex-1 min-w-0">

                    <DashboardHeader />

                    <main
                        className="
        px-3
        sm:px-4
        md:px-6
        lg:px-8
        py-4
        md:py-5
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
                                                    {group.items.map((notification, index) => {

                                                        const isLast =
                                                            group === groupedNotifications[groupedNotifications.length - 1] &&
                                                            index === group.items.length - 1;

                                                        return (

                                                            <div
                                                                key={notification.id}
                                                                ref={isLast ? setObserverTarget : null}
                                                            >

                                                                <NotificationCard
                                                                    notification={notification}
                                                                    onMarkRead={handleMarkRead}
                                                                    onDelete={handleDelete}
                                                                />

                                                            </div>

                                                        );

                                                    })}
                                                </AnimatePresence>

                                            </div>
                                        </div>
                                    ))}

                                    {loadingMore && (

                                        <div className="py-6 flex justify-center">

                                            <NotificationSkeleton />

                                        </div>

                                    )}

                                    {!hasMore && notifications.length > 0 && (

                                        <div className="py-6 text-center">

                                            <p className="text-slate-400 text-sm">

                                                You're all caught up 🎉

                                            </p>

                                        </div>

                                    )}

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