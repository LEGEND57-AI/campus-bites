import { useEffect, useRef, useState } from 'react';
import { formatRupees } from "../../utils/revenueChart";
import { adminAPI, analyticsAPI } from "../../services/api";
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  DollarSign,
  Clock,
  Timer,
  ChefHat,
  CircleCheckBig,
} from "lucide-react";
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useSocket } from "../../socket/SocketProvider";
import { SocketEvents } from "../../socket/constants";
import { useResyncOnReconnect } from "../../socket/useResyncOnReconnect";
import { useSingleFlightRefetch } from "../../hooks/useSingleFlightRefetch";

// The IST calendar date (YYYY-MM-DD) an instant falls on. CampusCraves runs on
// India time, so "today" must not depend on the browser's own timezone.
const getISTDate = (date) =>
  new Date(date).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const AdminDashboard = () => {
  const navigate = useNavigate();

  // Reactive socket: getSocket() returned null on a fresh load because child
  // effects run before SocketProvider's, and nothing re-ran this effect once
  // the socket connected.
  const socket = useSocket();

  const [stats, setStats] = useState({
    ordersToday: 0,
    grossRevenue: 0,
    refunds: 0,
    netRevenue: 0,
    activeOrders: 0,

    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mirrors the latest recentOrders so the socket handler can test membership
  // synchronously without a stale closure.
  const recentOrdersRef = useRef(recentOrders);

  useEffect(() => {
    recentOrdersRef.current = recentOrders;
  }, [recentOrders]);

  const fetchStats = async () => {
    try {
      const { data } = await analyticsAPI.getDashboardSummary();

      setStats({
        ordersToday: data.ordersToday || 0,
        // Today's accounting (IST), computed by the backend: net = gross -
        // successful refunds. totalRevenue is the older name for net.
        grossRevenue: Number(data.grossRevenue ?? data.totalRevenue ?? 0),
        refunds: Number(data.refunds || 0),
        netRevenue: Number(data.netRevenue ?? data.totalRevenue ?? 0),
        activeOrders: data.activeOrders || 0,

        pendingOrders: data.pendingOrders || 0,
        preparingOrders: data.preparingOrders || 0,
        readyOrders: data.readyOrders || 0,
      });

    } catch (err) {
      console.error(err);
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentOrders = async () => {
    try {
      const { data } = await adminAPI.getOrders();

      // Compared on the IST calendar, matching the server's IST "today"
      // window. toDateString() used the browser's local timezone.
      const today = getISTDate(new Date());

      const todayOrders = data
        .filter(order =>
          getISTDate(order.created_at) === today
        )
        .sort((a, b) => b.token_number - a.token_number)
        .slice(0, 5);

      setRecentOrders(todayOrders);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load recent orders');
    }
  };

  // One request at a time per data set; triggers that arrive while one is
  // running coalesce into a single follow-up (see useSingleFlightRefetch).
  // Stats get a short coalescing window because a single admin action emits
  // both order-updated and analytics-updated, which should share one request.
  const {
    refetch: refetchStats,
  } = useSingleFlightRefetch(fetchStats, { coalesceMs: 100 });

  const {
    refetch: refetchRecentOrders,
    markStale: markRecentOrdersStale,
  } = useSingleFlightRefetch(fetchRecentOrders);

  // 🔥 AUTO REFRESH
  useEffect(() => {
    refetchStats({ immediate: true });
    refetchRecentOrders();
  }, [refetchStats, refetchRecentOrders]);

  // Updates emitted while the socket was down are never replayed, so re-read
  // both once per reconnect (the first connection is skipped).
  useResyncOnReconnect(socket, () => {
    refetchStats({ immediate: true });
    refetchRecentOrders();
  });

  // Split out from the initial fetch above so it can depend on `socket`
  // without re-firing that fetch when the socket connects.
  useEffect(() => {
    if (!socket) return;

    // Kept as a refetch on purpose. These are server-computed aggregates
    // (ordersToday, totalRevenue, activeOrders, per-status counts) derived from
    // every order; a single updated order is not enough to recompute them
    // correctly, so merging would risk showing wrong numbers.
    const handleAnalyticsUpdate = () => {
      refetchStats();
    };

    // The recent-orders list, by contrast, can be merged in place when the
    // updated order is already shown. A refetch still runs when it is not,
    // since this event also announces brand-new orders that belong at the top
    // of the list.
    const handleOrderUpdate = (updatedOrder) => {

      // New orders and auto-cancellations emit only order-updated, and they
      // change the today/active/per-status counts too, so the stats follow
      // every order event (coalesced with analytics-updated).
      refetchStats();

      if (!updatedOrder?.id) {
        refetchRecentOrders();
        return;
      }

      const alreadyListed = recentOrdersRef.current.some(
        (order) => order.id === updatedOrder.id
      );

      if (!alreadyListed) {
        refetchRecentOrders();
        return;
      }

      // An in-flight list response may predate this change.
      markRecentOrdersStale();

      setRecentOrders((prev) =>
        prev.map((order) =>
          order.id === updatedOrder.id
            ? { ...order, ...updatedOrder }
            : order
        )
      );
    };

    socket.on(
      SocketEvents.ANALYTICS_UPDATED,
      handleAnalyticsUpdate
    );

    socket.on(
      SocketEvents.ORDER_UPDATED,
      handleOrderUpdate
    );

    return () => {
      socket.off(
        SocketEvents.ANALYTICS_UPDATED,
        handleAnalyticsUpdate
      );

      socket.off(
        SocketEvents.ORDER_UPDATED,
        handleOrderUpdate
      );
    };
  }, [socket, refetchStats, refetchRecentOrders, markRecentOrdersStale]);


  const formatToken = (token) => {
    return `#${String(token || 0).padStart(2, "0")}`;
  };

  const cards = [
    {
      title: 'Orders Today',
      value: stats.ordersToday,
      icon: ShoppingCart,
      color: 'text-blue-500'
    },
    {
      // Today only (IST), so it is labelled as such.
      title: "Today's Net Revenue",
      value: formatRupees(stats.netRevenue),
      hint: `Gross ${formatRupees(stats.grossRevenue)} · Refunds ${formatRupees(stats.refunds)}`,
      icon: DollarSign,
      color: 'text-green-500'
    },
    {
      title: 'Active Orders',
      value: stats.activeOrders,
      icon: Clock,
      color: 'text-orange-500'
    },
  ];

  const statusCards = [
    {
      title: "Pending",
      value: stats.pendingOrders,
      icon: Timer,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-500",
    },
    {
      title: "Preparing",
      value: stats.preparingOrders,
      icon: ChefHat,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-500",
    },
    {
      title: "Ready",
      value: stats.readyOrders,
      icon: CircleCheckBig,
      iconBg: "bg-green-100",
      iconColor: "text-green-500",
    },
  ];

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'ready':
        return 'bg-green-100 text-green-600';
      case 'preparing':
        return 'bg-yellow-100 text-yellow-600';
      case 'rejected':
        return 'bg-red-100 text-red-600';
      case 'accepted':
        return 'bg-blue-100 text-blue-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-card p-6 rounded-xl shadow-md hover:scale-[1.02] transition"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-500 text-sm">{card.title}</p>
                <p className="text-3xl font-bold mt-2">{card.value}</p>
                {card.hint && (
                  <p className="text-xs text-gray-400 mt-1">{card.hint}</p>
                )}
              </div>

              <card.icon className={`w-12 h-12 ${card.color} opacity-50`} />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {statusCards.map((card) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="glass-card p-6 rounded-xl shadow-md hover:scale-[1.02] transition"
          >
            <div className="flex justify-between items-center">

              <div>
                <p className="text-gray-500 text-sm">
                  {card.title}
                </p>

                <p className="text-3xl font-bold mt-2">
                  {card.value}
                </p>
              </div>

              {
                (() => {
                  const Icon = card.icon;

                  return (
                    <div
                      className={`
          w-14 h-14 rounded-full
          ${card.iconBg}
          flex items-center justify-center
        `}
                    >
                      <Icon
                        className={`
            w-7 h-7
            ${card.iconColor}
          `}
                      />
                    </div>
                  );
                })()
              }

            </div>
          </motion.div>
        ))}
      </div>

      {/* RECENT ORDERS */}
      <div className="mt-8 bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">🎟 Today's Active Tokens</h3>

        {recentOrders.length === 0 ? (
          <p className="text-gray-400">No recent orders</p>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                onClick={() =>
                  navigate("/admin/orders", {
                    state: {
                      orderId: order.id,
                    },
                  })
                }
                className="flex justify-between items-center border-b pb-2 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition"
              >
                <div>
                  <p className="font-bold text-blue-600">
                    🎟 Token {formatToken(order.token_number)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(order.created_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(order.status)}`}
                >
                  {order.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default AdminDashboard;