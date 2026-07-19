import { useEffect, useState, useRef, useCallback } from 'react';
import { analyticsAPI } from "../../services/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Area, AreaChart,
  PieChart, Pie, Cell, CartesianGrid, Legend
} from 'recharts';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Clock,
  Wallet,
  Flame,
  AlertTriangle,
  Trophy,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  X,
  RefreshCw,
} from 'lucide-react';

// 🔥 Fill missing dates (timezone-safe: does all math on local Y/M/D parts,
// never round-trips through toISOString for the arithmetic itself)
const fillMissingDates = (data) => {
  if (!data || data.length === 0) return [];

  const map = new Map(data.map(d => [d.date, Number(d.revenue || 0)]));

  const parseYMD = (str) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d); // local, no UTC shift
  };

  const toYMD = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const start = parseYMD(data[0].date);
  const end = parseYMD(data[data.length - 1].date);

  const result = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = toYMD(d);
    result.push({
      date: dateStr,
      revenue: Number(map.get(dateStr) || 0)
    });
  }

  return result;
};

// Order + labels for the dropdown menu (matches Image 1)
const RANGE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7days', label: 'Last 7 Days' },
  { key: '3months', label: 'Last 3 Months' },
  { key: 'thismonth', label: 'This Month' },
  { key: 'thisyear', label: 'This Year' },
];

const RANGE_LABELS = RANGE_OPTIONS.reduce((acc, o) => {
  acc[o.key] = o.label;
  return acc;
}, {});

const STATUS_COLORS = {
  Pending: "#f59e0b",
  Accepted: "#3b82f6",
  Preparing: "#8b5cf6",
  Ready: "#22c55e",
  Cancelled: "#ef4444",
};

// How often to poll for "live" updates. Lower = more real-time feeling,
// but more load on your backend. 15-20s is a good balance for a campus app.
const POLL_INTERVAL_MS = 20000;

const todayStr = () => new Date().toISOString().split('T')[0];

const formatDisplayDate = (isoStr) => {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatXAxisLabel = (value, range) => {

  switch (range) {

    case "today":
    case "yesterday":
    case "specific": {
      const hour = Number(value.split(":")[0]);

      const displayHour =
        hour === 0 ? 12 :
          hour > 12 ? hour - 12 :
            hour;

      const period = hour >= 12 ? "PM" : "AM";

      return `${displayHour} ${period}`;
    }

    case "7days": {
      const date = new Date(value);

      return date.toLocaleDateString("en-IN", {
        weekday: "short",
      });
    }


    case "3months": {
      const date = new Date(value);

      return date.toLocaleDateString("en-IN", {
        month: "short",
      });
    }

    case "thisyear": {
      const date = new Date(value);

      return date.toLocaleDateString("en-IN", {
        month: "short",
      });
    }

    case "thismonth": {
      const date = new Date(value);

      return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
    }



    default:
      return value;
  }
};

const AdminAnalytics = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);       // true only for the very first load
  const [refreshing, setRefreshing] = useState(false); // true for background/range-switch fetches

  // 'today' | 'yesterday' | '7days' |  '3months' | 'thismonth' | 'thisyear' | 'specific'
  const [range, setRange] = useState('7days');

  // applied specific date (only updates when user picks a day in the calendar)
  const [specificDate, setSpecificDate] = useState('');

  // draft date inside the calendar view, before it's applied
  const [pendingDate, setPendingDate] = useState('');

  const [showMenu, setShowMenu] = useState(false);
  const [menuView, setMenuView] = useState('list'); // 'list' | 'calendar'
  const menuRef = useRef(null);

  const rateLimitedRef = useRef(false);

  // Guards against race conditions when the user switches ranges quickly:
  // only the response matching the *latest* request is applied.
  const requestSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  // close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
        setMenuView('list');
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const fetchAnalytics = useCallback(async (isBackground = false) => {
    const mySeq = ++requestSeqRef.current;

    if (!hasLoadedOnceRef.current) {
      setLoading(true);
    } else if (!isBackground) {
      // user actively switched range/applied date -> show refresh state
      setRefreshing(true);
    }

    try {
      const params =
        range === 'specific'
          ? { from: specificDate, to: specificDate }
          : { range };

      const { data } = await analyticsAPI.getDashboard(params);

      // A newer request has since been fired (user switched range again) —
      // discard this stale response.
      if (mySeq !== requestSeqRef.current) return;

      let revenue = data?.revenueByDay || [];

      revenue = revenue
        .map(r => ({
          ...r,
          revenue: Number(r.revenue || 0)
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      if (
        range === "7days" ||
        range === "thismonth"
      ) {
        revenue = fillMissingDates(revenue);
      }

      setStats({
        ...data,
        revenueByDay: revenue
      });

      rateLimitedRef.current = false;
      hasLoadedOnceRef.current = true;

    } catch (err) {
      if (mySeq !== requestSeqRef.current) return;

      console.error(err);

      if (err?.response?.status === 429) {
        rateLimitedRef.current = true;
        const retryAfter = err?.response?.data?.retryAfter;
        toast.error(
          retryAfter
            ? `Too many requests. Retrying in ${retryAfter}s.`
            : 'Too many requests. Please wait a moment.'
        );
      } else {
        toast.error('Failed to load analytics');
      }

    } finally {
      if (mySeq === requestSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [range, specificDate]);

  useEffect(() => {
    if (range === 'specific' && !specificDate) {
      // specific date selected in menu but not applied yet — don't fetch
      return;
    }

    fetchAnalytics(false);

    const interval = setInterval(() => {
      if (!rateLimitedRef.current) {
        fetchAnalytics(true); // background refresh, no skeleton/spinner flash
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);

  }, [range, specificDate, fetchAnalytics]);

  const selectRange = (key) => {
    setRange(key);
    setShowMenu(false);
    setMenuView('list');
  };

  const openCalendarView = () => {
    setPendingDate(specificDate || todayStr());
    setMenuView('calendar');
  };

  const handleApplyDate = () => {
    if (!pendingDate) {
      toast.error('Please select a date');
      return;
    }

    setSpecificDate(pendingDate);
    setRange('specific');
    setShowMenu(false);
    setMenuView('list');
  };

  const currentRangeLabel =
    range === 'specific' && specificDate
      ? formatDisplayDate(specificDate)
      : RANGE_LABELS[range];

  const revenueByDay = stats.revenueByDay || [];

  // 🔥 Trend: compare last half of range vs first half
  const getTrend = () => {
    if (revenueByDay.length < 2) return null;

    const mid = Math.floor(revenueByDay.length / 2);
    const firstHalf = revenueByDay.slice(0, mid);
    const secondHalf = revenueByDay.slice(mid);

    const sum = (arr) => arr.reduce((s, d) => s + d.revenue, 0);

    const firstSum = sum(firstHalf) || 0;
    const secondSum = sum(secondHalf) || 0;

    if (firstSum === 0) return null;

    const change = ((secondSum - firstSum) / firstSum) * 100;
    return change;
  };

  const trend = getTrend();

  // FIX: was `totalRevenue / ordersToday`, which is wrong for any range
  // other than "today" (mixes a range-scoped number with a today-only number).
  // Backend should return `totalOrders` = order count for the SAME range as
  // totalRevenue. Falls back to ordersToday only when range === 'today'.
  const ordersForRange =
    range === 'today'
      ? (stats.ordersToday || 0)
      : (stats.totalOrders ?? stats.ordersToday ?? 0);

  const avgOrderValue =
    ordersForRange > 0
      ? (Number(stats.totalRevenue || 0) / ordersForRange)
      : 0;

  const pieData = [
    { name: "Pending", value: stats.statusBreakdown?.pending || 0 },
    { name: "Accepted", value: stats.statusBreakdown?.accepted || 0 },
    { name: "Preparing", value: stats.statusBreakdown?.preparing || 0 },
    { name: "Ready", value: stats.statusBreakdown?.ready || 0 },
    { name: "Cancelled", value: stats.statusBreakdown?.cancelled || 0 },
  ];

  const totalStatusCount = pieData.reduce((s, p) => s + p.value, 0);

  const summaryCards = [
    {
      title: "Total Revenue",
      value: `₹${Number(stats.totalRevenue || 0).toFixed(2)}`,
      icon: Wallet,
      color: "text-green-600",
      bg: "bg-green-50",
      trend,
    },
    {
      title:
        range === "today"
          ? "Orders Today"
          : "Orders",
      value:
        range === "today"
          ? stats.ordersToday
          : stats.totalOrders,
      icon: ShoppingBag,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Active Orders",
      value: stats.activeOrders || 0,
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      title: "Avg. Order Value",
      value: `₹${avgOrderValue.toFixed(2)}`,
      icon: TrendingUp,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
  ];

  // Precompute once instead of inside every list item's render
  const maxPopularQty = Math.max(...(stats.popularItems || []).map((p) => p.qty || 0), 1);
  const maxCategoryQty = Math.max(...(stats.topCategories || []).map((c) => c.qty || 0), 1);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2.5">
            Analytics Dashboard
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              Live
            </span>
          </h2>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
            Business insights for {currentRangeLabel.toLowerCase()}
            {refreshing && (
              <span className="flex items-center gap-1 text-blue-500">
                <RefreshCw size={11} className="animate-spin" />
                updating…
              </span>
            )}
          </p>
        </div>

        {/* RANGE DROPDOWN */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => {
              if (showMenu) {
                setShowMenu(false);
                setMenuView('list');
              } else {
                setShowMenu(true);
              }
            }}
            className="
              whitespace-nowrap
              flex items-center gap-2
              px-4 sm:px-5
              py-2
              rounded-xl
              text-sm
              font-semibold
              text-white
              bg-gradient-to-r from-blue-600 to-cyan-500
              shadow-lg shadow-blue-500/25
              transition-all duration-300
              hover:opacity-90
            "
          >
            <Calendar size={15} />
            {currentRangeLabel}
            <ChevronDown
              size={15}
              className={`transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="
                  absolute right-0 mt-2 z-50
                  w-[260px]
                  bg-white rounded-2xl shadow-2xl border border-slate-100
                  overflow-hidden
                "
              >
                {menuView === 'list' ? (
                  <div className="py-2">
                    {RANGE_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => selectRange(opt.key)}
                        className="
                          w-full flex items-center justify-between
                          px-4 py-2.5 text-sm text-left
                          text-slate-700 hover:bg-slate-50
                          transition
                        "
                      >
                        {opt.label}
                        {range === opt.key && (
                          <Check size={16} className="text-blue-600" />
                        )}
                      </button>
                    ))}

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      onClick={openCalendarView}
                      className="
                        w-full flex items-center justify-between
                        px-4 py-2.5 text-sm text-left
                        text-slate-700 hover:bg-slate-50
                        transition
                      "
                    >
                      Specific Date
                      {range === 'specific' && (
                        <Check size={16} className="text-blue-600" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => setMenuView('list')}
                        className="text-slate-400 hover:text-slate-600 transition"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <h4 className="font-bold text-slate-900 text-sm">Select a Date</h4>
                    </div>

                    <input
                      type="date"
                      value={pendingDate}
                      max={todayStr()}
                      onChange={(e) => setPendingDate(e.target.value)}
                      className="
                        w-full px-3 py-2.5 rounded-xl border border-slate-200
                        text-sm focus:border-blue-500 focus:ring-2
                        focus:ring-blue-100 outline-none transition
                      "
                    />

                    <button
                      onClick={handleApplyDate}
                      className="
                        mt-4 w-full py-2.5 rounded-xl
                        bg-gradient-to-r from-blue-600 to-cyan-500
                        text-white text-sm font-semibold
                        hover:opacity-90 transition
                      "
                    >
                      Apply
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* SUMMARY — KPI CARDS */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 transition-opacity duration-200 ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
        {summaryCards.map((card, i) => {
          const Icon = card.icon;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6"
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <Icon size={18} className={card.color} />
                </div>

                {card.trend !== undefined && card.trend !== null && (
                  <span
                    className={`
                      flex items-center gap-0.5
                      text-[10px] sm:text-xs font-bold
                      px-2 py-0.5 rounded-full
                      ${card.trend >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}
                    `}
                  >
                    {card.trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {Math.abs(card.trend).toFixed(0)}%
                  </span>
                )}
              </div>

              <p className="text-gray-500 text-[11px] sm:text-sm">{card.title}</p>
              <p className={`text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 truncate ${card.color}`}>
                {card.value}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* REVENUE TREND — full width hero chart */}
      <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 transition-opacity duration-200 ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Revenue Trend</h3>
            <p className="text-xs sm:text-sm text-gray-400">Daily revenue over {currentRangeLabel.toLowerCase()}</p>
          </div>
        </div>

        {revenueByDay.length === 0 ? (
          <p className="text-gray-400 text-center py-16 text-sm">No revenue data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={240} className="sm:!h-[300px]">
            <AreaChart data={revenueByDay} margin={{
              top: 10,
              right: 15,
              left: 5,
              bottom: 10,
            }}>

              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />

              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="date"
                interval={
                  range === "7days"
                    ? 0
                      : range === "thismonth"
                        ? 4
                        : range === "3months"
                          ? 0
                          : range === "thisyear"
                            ? 0
                            : "preserveStartEnd"
                }
                tickFormatter={(value) => formatXAxisLabel(value, range)}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={(label) => {
                  if (
                    range === "today" ||
                    range === "yesterday" ||
                    range === "specific"
                  ) {
                    return formatXAxisLabel(label, range);
                  }

                  const date = new Date(label);

                  if (range === "7days") {
                    return date.toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    });
                  }

                  return date.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });
                }}

                formatter={(value) => [
                  `₹${Number(value).toFixed(2)}`,
                  "Revenue",
                ]}
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                  background: "#fff",
                  fontSize: 13,
                }}
              />

              <Area
                type={
                  range === "today" ||
                    range === "yesterday" ||
                    range === "specific"
                    ? "linear"
                    : "monotone"
                }
                dataKey="revenue"
                stroke="#2563EB"
                strokeWidth={4}
                fill="url(#colorRevenue)"
                animationDuration={800}
                dot={{
                  r: 4,
                  stroke: "#2563EB",
                  strokeWidth: 2,
                  fill: "#ffffff",
                }}
                activeDot={{
                  r: 7,
                  stroke: "#2563EB",
                  strokeWidth: 3,
                  fill: "#ffffff",
                }}
              />

            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* GRID: STATUS + TOP ITEMS + TOP CATEGORIES */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 transition-opacity duration-200 ${refreshing ? 'opacity-60' : 'opacity-100'}`}>

        {/* ORDER STATUS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4">Order Status</h3>

          {totalStatusCount === 0 ? (
            <p className="text-gray-400 text-center py-10 text-sm">No orders yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={STATUS_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-2 mt-2">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[entry.name] }}
                      />
                      <span className="text-gray-600">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* TOP ITEMS — ranked list */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-amber-500" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Top Items</h3>
          </div>

          {(stats.popularItems || []).length === 0 ? (
            <p className="text-gray-400 text-center py-10 text-sm">No data</p>
          ) : (
            <div className="space-y-3">
              {(stats.popularItems || []).slice(0, 5).map((item, i) => {
                const pct = ((item.qty || 0) / maxPopularQty) * 100;

                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                        {item.name}
                      </span>
                      <span className="text-sm font-bold text-blue-600 shrink-0">{item.qty}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TOP CATEGORIES — ranked list */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={18} className="text-orange-500" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Top Categories</h3>
          </div>

          {(stats.topCategories || []).length === 0 ? (
            <p className="text-gray-400 text-center py-10 text-sm">No data</p>
          ) : (
            <div className="space-y-3">
              {(stats.topCategories || []).slice(0, 5).map((cat, i) => {
                const pct = ((cat.qty || 0) / maxCategoryQty) * 100;

                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                        {cat.name}
                      </span>
                      <span className="text-sm font-bold text-indigo-600 shrink-0">{cat.qty}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* LOW PERFORMING ITEMS */}
      <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 transition-opacity duration-200 ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-red-500" />
          <h3 className="text-base sm:text-lg font-bold text-slate-900">Low Performing Items</h3>
        </div>

        {(stats.lowItems || []).length === 0 ? (
          <p className="text-gray-400 text-sm">No data</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {stats.lowItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-xl border border-red-100 bg-red-50/50 px-4 py-3"
              >
                <span className="text-sm text-slate-700 truncate">{item.name}</span>
                <span className="shrink-0 text-sm font-bold text-red-500 bg-white px-2.5 py-0.5 rounded-full">
                  {item.qty}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default AdminAnalytics;