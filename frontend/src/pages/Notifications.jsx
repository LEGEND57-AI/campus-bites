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
    Loader2,
    SlidersHorizontal,
    Trash2,
} from "lucide-react";

import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import MobileBottomNav from "../components/dashboard/MobileBottomNav";
import NotificationCard from "../components/notifications/NotificationCard";
import NotificationSkeleton from "../components/notifications/NotificationSkeleton";
import ClearNotificationsModal from "../components/notifications/ClearNotificationsModal";

import { useSocket } from "../socket/SocketProvider";
import { SocketEvents } from "../socket/constants";

import { notificationAPI } from "../services/api";
import { unreadCountStore, useUnreadCount } from "../notifications/useUnreadCount";


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

const createdAtMs = (n) => Date.parse(n?.created_at) || 0;

// The newest notification the user has seen: bulk actions only touch
// notifications created at or before it, so one that arrives while a request
// is in flight is never marked read or cleared unseen.
const newestCreatedAt = (list) =>
    list.reduce(
        (newest, n) => (!newest || createdAtMs(n) > createdAtMs({ created_at: newest }) ? n.created_at : newest),
        null
    );

const isAtOrBefore = (n, upTo) => !upTo || createdAtMs(n) <= Date.parse(upTo);

const Notifications = () => {
    // Reactive socket: getSocket() returned null on a fresh load because child
    // effects run before SocketProvider's, leaving the listener unattached.
    const socket = useSocket();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    const [hasMore, setHasMore] = useState(true);

    const [loadingMore, setLoadingMore] = useState(false);

    const [observerTarget, setObserverTarget] = useState(null);

    // Server-side unread count (all pages, not just the loaded rows). It
    // decides the header action together with the list:
    //   unreadCount > 0             -> "Mark all as read"
    //   unreadCount 0, list has any -> "Clear all"
    //   empty list                  -> no action
    // It is the app-wide shared count (the header shows the same number),
    // read fresh from the server when this page opens -- one request shared
    // with the header's -- and kept current by realtime events in
    // SocketProvider.
    const unreadCount = useUnreadCount({ maxAgeMs: 0 });

    // "read" | "clear" | null while a bulk request is in flight; the ref also
    // blocks a second click before React re-renders.
    const [pendingAction, setPendingAction] = useState(null);
    const actionInFlightRef = useRef(false);
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);

    // Latest list for the socket handlers (membership checks without stale
    // closures).
    const notificationsRef = useRef(notifications);
    notificationsRef.current = notifications;

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

    }, [loadNotifications]);

    // Split from the load above so it can depend on `socket`. The handler is a
    // stored reference and cleanup passes it to off(); the previous
    // socket.off(NOTIFICATION_NEW) removed every listener for that event on the
    // shared socket -- which included DashboardHeader's unread-count listener,
    // rendered on this very page.
    useEffect(() => {

        if (!socket) return;

        const handleNewNotification = (notification) => {

            if (!notification?.id) return;

            // A re-delivered notification changes nothing (and is not
            // counted twice).
            if (notificationsRef.current.some((n) => n.id === notification.id)) {
                return;
            }

            setNotifications((prev) => {

                if (prev.some((n) => n.id === notification.id)) {
                    return prev;
                }

                return [
                    notification,
                    ...prev,
                ];

            });

            // The unread count (which turns "Clear all" back into "Mark all as
            // read") is updated by the shared store in SocketProvider.
            setHasMore(true);

        };

        // Read in this tab or another tab/device of the same user.
        const handleRead = (payload) => {

            if (!payload) return;

            if (payload.scope === "all") {
                setNotifications((prev) =>
                    prev.map((n) => (!n.is_read && isAtOrBefore(n, payload.upTo) ? { ...n, is_read: true } : n))
                );
            } else if (Array.isArray(payload.ids)) {
                const ids = new Set(payload.ids);
                setNotifications((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, is_read: true } : n)));
            }

        };

        // Cleared / deleted in this tab or another tab/device of the same user.
        const handleCleared = (payload) => {

            if (!payload) return;

            if (payload.scope === "read") {
                setNotifications((prev) => prev.filter((n) => !(n.is_read && isAtOrBefore(n, payload.upTo))));
                if (payload.unreadCount === 0) setHasMore(false);
            } else if (Array.isArray(payload.ids)) {
                const ids = new Set(payload.ids);
                setNotifications((prev) => prev.filter((n) => !ids.has(n.id)));
            }

        };

        socket.on(SocketEvents.NOTIFICATION_NEW, handleNewNotification);
        socket.on(SocketEvents.NOTIFICATION_READ, handleRead);
        socket.on(SocketEvents.NOTIFICATION_CLEARED, handleCleared);

        return () => {
            socket.off(SocketEvents.NOTIFICATION_NEW, handleNewNotification);
            socket.off(SocketEvents.NOTIFICATION_READ, handleRead);
            socket.off(SocketEvents.NOTIFICATION_CLEARED, handleCleared);
        };

    }, [socket]);


    // The three handlers below update local state optimistically and then call
    // the API. Previously the await was unguarded, so a rejected request left
    // the UI showing a change the server never accepted -- and, because these
    // are fired from onClick and their promise is never awaited, produced an
    // unhandled rejection with no message to the user.
    //
    // Each now rolls back only the rows it actually touched, using functional
    // updates. Restoring a snapshot of the whole list would be simpler but
    // would erase any notification that arrived over the socket while the
    // request was in flight.
    //
    // The "previous" values are read synchronously from this render's
    // `notifications` rather than captured inside an updater: an updater runs
    // during React's render phase, which is not guaranteed to have happened by
    // the time the awaited call rejects. Reading the closure is safe here
    // because the socket handler only ever prepends new notifications, never
    // mutates existing ones.

    const handleMarkRead = async (id) => {

        const previous = notifications.find((n) => n.id === id);
        const wasRead = previous ? previous.is_read : undefined;

        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));

        try {

            const { data } = await notificationAPI.markAsRead(id);

            unreadCountStore.applyServerCount(data?.unreadCount);

        } catch (err) {

            console.error(err);

            // Only undo what this call changed. If it was already read there
            // is nothing to restore.
            if (wasRead === false) {
                setNotifications((prev) =>
                    prev.map((n) => (n.id === id ? { ...n, is_read: false } : n))
                );
            }

            toast.error("Failed to mark notification as read");

        }

    };

    const handleMarkAllRead = async () => {

        if (actionInFlightRef.current) return;

        const upTo = newestCreatedAt(notificationsRef.current);

        actionInFlightRef.current = true;
        setPendingAction("read");

        try {

            const { data } = await notificationAPI.markAllAsRead(upTo);

            setNotifications((prev) =>
                prev.map((n) => (!n.is_read && isAtOrBefore(n, upTo) ? { ...n, is_read: true } : n))
            );

            unreadCountStore.applyServerCount(data?.unreadCount);

            toast.success("All notifications marked as read");

        } catch (err) {

            console.error(err);

            toast.error("Failed to mark all notifications as read");

        } finally {

            actionInFlightRef.current = false;
            setPendingAction(null);

        }

    };

    const handleClearAll = async () => {

        if (actionInFlightRef.current) return;

        const upTo = newestCreatedAt(notificationsRef.current);

        actionInFlightRef.current = true;
        setPendingAction("clear");

        try {

            const { data } = await notificationAPI.clearAll(upTo);

            // Only read notifications are cleared on the server; anything that
            // arrived unread meanwhile stays.
            setNotifications((prev) => prev.filter((n) => !(n.is_read && isAtOrBefore(n, upTo))));

            if (Number.isInteger(data?.unreadCount)) {
                unreadCountStore.applyServerCount(data.unreadCount);
                if (data.unreadCount === 0) setHasMore(false);
            }

            setConfirmClearOpen(false);

            toast.success("All notifications cleared");

        } catch (err) {

            console.error(err);

            toast.error("Failed to clear notifications");

        } finally {

            actionInFlightRef.current = false;
            setPendingAction(null);

        }

    };

    const handleDelete = async (id) => {

        const index = notifications.findIndex((n) => n.id === id);
        const removed = index === -1 ? null : notifications[index];

        setNotifications((prev) => prev.filter((n) => n.id !== id));

        try {

            await notificationAPI.deleteNotification(id);

        } catch (err) {

            console.error(err);

            if (removed) {
                setNotifications((prev) => {

                    // Already present (e.g. re-delivered over the socket):
                    // leave the list alone rather than duplicating the row.
                    if (prev.some((n) => n.id === removed.id)) {
                        return prev;
                    }

                    const next = [...prev];

                    // Clamped because the list can have grown while the
                    // request was in flight.
                    next.splice(Math.min(index, next.length), 0, removed);

                    return next;

                });
            }

            toast.error("Failed to delete notification");

        }

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

    // Decided from the data (server unread count + list), never from which
    // button was last clicked.
    const headerAction =
        unreadCount > 0 ? "read" : filteredNotifications.length > 0 ? "clear" : null;

    // "Mark all as read" / "Clear all". Compact variant for the mobile row
    // beside the first group label.
    const renderHeaderAction = ({ compact = false } = {}) => {

        if (loading || !headerAction) return null;

        const size = compact
            ? "gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            : "gap-2 px-4 py-2.5 rounded-xl text-sm";
        const iconSize = compact ? 13 : 15;

        if (headerAction === "read") {
            return (
                <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={pendingAction !== null}
                    aria-busy={pendingAction === "read"}
                    className={`flex items-center ${size} border border-slate-200 bg-white font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 disabled:hover:bg-white disabled:cursor-not-allowed transition`}
                >
                    {pendingAction === "read"
                        ? <Loader2 size={iconSize} className="animate-spin" />
                        : <Check size={iconSize} />}
                    Mark all as read
                </button>
            );
        }

        return (
            <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                disabled={pendingAction !== null}
                aria-busy={pendingAction === "clear"}
                className={`flex items-center ${size} border border-slate-200 bg-white font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-60 disabled:hover:bg-white disabled:cursor-not-allowed transition`}
            >
                {pendingAction === "clear"
                    ? <Loader2 size={iconSize} className="animate-spin" />
                    : <Trash2 size={iconSize} />}
                Clear all
            </button>
        );

    };

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

            lg:rounded-[32px]
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

                        <div className="space-y-4 sm:space-y-6">

                            {/* HEADER */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Notifications</h2>
                                    <p className="text-gray-500 text-sm mt-1">Stay updated with real-time alerts and important updates</p>
                                </div>

                                {/* Tablet / desktop: action beside the title. On mobile it sits
                                    on the first group's row instead (see LIST). */}
                                <div className="hidden sm:flex items-center gap-2 shrink-0">
                                    {renderHeaderAction()}
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
                                    {groupedNotifications.map((group, groupIndex) => (
                                        <div key={group.label}>
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide">
                                                    {group.label}
                                                </h3>

                                                {groupIndex === 0 && (
                                                    <div className="flex sm:hidden items-center gap-2 shrink-0">
                                                        {renderHeaderAction({ compact: true })}
                                                    </div>
                                                )}
                                            </div>

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

                    <ClearNotificationsModal
                        open={confirmClearOpen}
                        busy={pendingAction === "clear"}
                        onClose={() => setConfirmClearOpen(false)}
                        onConfirm={handleClearAll}
                    />

                </div>

            </div>

        </div>
    );
};

export default Notifications;