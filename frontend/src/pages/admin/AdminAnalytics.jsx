import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Area,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

// 🔥 Fill missing dates (FIXED)
const fillMissingDates = (data) => {
  if (!data || data.length === 0) return [];

  const map = new Map(data.map(d => [d.date, Number(d.revenue || 0)]));

  const start = new Date(data[0].date);
  const end = new Date(data[data.length - 1].date);

  const result = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    result.push({
      date: dateStr,
      revenue: Number(map.get(dateStr) || 0)
    });
  }

  return result;
};

const AdminAnalytics = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7days");

  useEffect(() => {
    fetchAnalytics();

    // 🔥 AUTO REFRESH
    const interval = setInterval(fetchAnalytics, 5000);
    return () => clearInterval(interval);

  }, [range]);

  const fetchAnalytics = async () => {
    try {
      const { data } = await adminAPI.getAnalytics(range);

      let revenue = data?.revenueByDay || [];

      // 🔥 SORT + CLEAN
      revenue = revenue
        .map(r => ({
          ...r,
          revenue: Number(r.revenue || 0)
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      // 🔥 FIX missing dates
      revenue = fillMissingDates(revenue);

      setStats({
        ...data,
        revenueByDay: revenue
      });

    } catch (err) {
      console.error(err);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 PIE
  const pieData = [
    { name: 'Ready', value: stats.statusBreakdown?.Ready || 0 },
    { name: 'Preparing', value: stats.statusBreakdown?.Preparing || 0 },
    { name: 'Rejected', value: stats.statusBreakdown?.Rejected || 0 },
  ];

  const COLORS = ['#22c55e', '#facc15', '#ef4444'];

  // 🔥 SUMMARY
  const summaryCards = [
    { title: "Revenue", value: `₹${Number(stats.totalRevenue || 0).toFixed(2)}`, color: "text-green-500" },
    { title: "Orders Today", value: stats.ordersToday || 0, color: "text-blue-500" },
    { title: "Active Orders", value: stats.activeOrders || 0, color: "text-orange-500" }
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-64 bg-gray-200 animate-pulse rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10 p-4 md:p-6">

      {/* HEADER */}
      <div>
        <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
        <p className="text-gray-500 text-sm">Real-time business insights 📊</p>

        {/* RANGE */}
        <div className="flex gap-2 mt-4">
          {["today", "7days", "30days"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-lg text-sm ${
                range === r
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summaryCards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white/70 backdrop-blur-md p-6 rounded-2xl shadow-md hover:scale-[1.03] transition"
          >
            <p className="text-gray-500 text-sm">{card.title}</p>
            <p className={`text-3xl font-bold mt-2 ${card.color}`}>
              {card.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* 🔥 REVENUE */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-1">Revenue Trend</h3>

          {(stats.revenueByDay || []).length === 0 ? (
            <p className="text-gray-400 text-center py-10">No revenue data</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={stats.revenueByDay}>

                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />

                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>

                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v) => `₹${Number(v).toFixed(2)}`} />

                <Area
                  type="monotone"
                  dataKey="revenue"
                  fill="url(#colorRevenue)"
                  stroke="none"
                />

                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#22c55e"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />

              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* STATUS */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Order Status</h3>

          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" outerRadius={90}>
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* TOP ITEMS */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Top Items</h3>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.popularItems || []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2}/>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="qty" fill="#3b82f6" radius={[10,10,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CATEGORIES */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Top Categories</h3>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.topCategories || []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2}/>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="qty" fill="#6366f1" radius={[10,10,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* LOW ITEMS */}
      <div className="bg-white rounded-2xl shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Low Performing Items</h3>

        {(stats.lowItems || []).length === 0 ? (
          <p className="text-gray-400">No data</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {stats.lowItems.map((item, i) => (
              <div key={i} className="border rounded-xl p-3 flex justify-between">
                <span>{item.name}</span>
                <span className="text-red-500 font-semibold">{item.qty}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default AdminAnalytics;