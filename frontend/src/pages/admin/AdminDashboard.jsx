import { useEffect, useState } from 'react';
import { adminAPI } from "../../services/api";
import { motion } from 'framer-motion';
import { ShoppingCart, DollarSign, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    ordersToday: 0,
    totalRevenue: 0,
    activeOrders: 0
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
      const { data } = await adminAPI.getAnalytics();

      setStats({
        ordersToday: data.ordersToday || 0,
        totalRevenue: Number(data.totalRevenue || 0), // ✅ SAFE NUMBER
        activeOrders: data.activeOrders || 0
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

      const sorted = data
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);

      setRecentOrders(sorted);
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

      {/* RECENT ORDERS */}
      <div className="mt-8 bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Orders</h3>

        {recentOrders.length === 0 ? (
          <p className="text-gray-400">No recent orders</p>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate('/admin/orders')}
                className="flex justify-between items-center border-b pb-2 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition"
              >
                <div>
                  <p className="font-medium">Order #{order.id}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(order.created_at).toLocaleString()}
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