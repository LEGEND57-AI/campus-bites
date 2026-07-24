import { useEffect, useState } from 'react';
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

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    ordersToday: 0,
    totalRevenue: 0,
    activeOrders: 0,

    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔥 AUTO REFRESH
  useEffect(() => {
    fetchStats();
    fetchRecentOrders();

    const interval = setInterval(() => {
      fetchStats();
      fetchRecentOrders();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await analyticsAPI.getDashboardSummary();

      setStats({
        ordersToday: data.ordersToday || 0,
        totalRevenue: Number(data.totalRevenue || 0),
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

      const today = new Date().toDateString();

      const todayOrders = data
        .filter(order =>
          new Date(order.created_at).toDateString() === today
        )
        .sort((a, b) => b.token_number - a.token_number)
        .slice(0, 5);

      setRecentOrders(todayOrders);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load recent orders');
    }
  };

  // ✅ FORMAT ₹
  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

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
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue), // ✅ FIXED
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