import { useEffect, useState, useRef, useCallback } from 'react';
import { analyticsAPI } from "../../services/api";
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
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
  RotateCcw,
  Receipt,
  CheckCircle2,
} from 'lucide-react';
import { useSocket } from "../../socket/SocketProvider";
import { SocketEvents } from "../../socket/constants";
import { useResyncOnReconnect } from "../../socket/useResyncOnReconnect";
import { useSingleFlightRefetch } from "../../hooks/useSingleFlightRefetch";
import RevenueTrendChart from "../../components/admin/RevenueTrendChart";
import { formatRupees } from "../../utils/revenueChart";

// Order + labels for the dropdown menu (matches Image 1)
const RANGE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7days', label: 'Last 7 Days' },
  { key: '30days', label: 'Last 30 Days' },
  { key: '3months', label: 'Last 3 Months' },
  { key: 'thismonth', label: 'This Month' },
  { key: 'thisyear', label: 'This Year' },
];

const RANGE_LABELS = RANGE_OPTIONS.reduce((acc, o) => {
  acc[o.key] = o.label;
  return acc;
}, {});

// Pending -> Preparing -> Ready -> Completed. Legacy "Accepted" orders are
// counted with Pending by the server.
const STATUS_COLORS = {
  Pending: "#f59e0b",      // Orange
  Preparing: "#8b5cf6",    // Purple
  Ready: "#22c55e",        // Green
  Completed: "#10b981",    // Emerald
  Cancelled: "#ef4444",    // Red
  Refunded: "#06b6d4",     // Cyan
};


const getISTDate = (date) =>
  new Date(date).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

const todayStr = () => getISTDate(new Date());

// A YYYY-MM-DD value is a calendar date; parsing it with Date() would read it
// as UTC midnight and could show the previous day west of UTC.
const formatDisplayDate = (isoStr) => {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
};

const AdminAnalytics = () => {
  // Reactive socket: getSocket() returned null on a fresh load because child
  // effects run before SocketProvider's, leaving the listener unattached.
  const socket = useSocket();

  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);       // true only for the very first load
  const [refreshing, setRefreshing] = useState(false); // true for background/range-switch fetches

  // 'today' | 'yesterday' | '7days' | '30days' | '3months' | 'thismonth' | 'thisyear' | 'specific'
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

  // The selection the screen currently shows. Requests run one at a time (see
  // useSingleFlightRefetch below), so a range switch made while a request is
  // in flight queues a follow-up; the in-flight response, which belongs to the
  // previous selection, is dropped instead of briefly overwriting the view.
  const selectionKey = `${range}|${specificDate}`;
  const selectionKeyRef = useRef(selectionKey);
  selectionKeyRef.current = selectionKey;
  // Set by a user range change so the next load shows the refreshing state.
  const userRequestedRef = useRef(false);

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
    const requestedSelection = `${range}|${specificDate}`;

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

      // A newer request has since been fired, or the user switched to another
      // range while this one was loading — discard this stale response.
      if (
        mySeq !== requestSeqRef.current ||
        requestedSelection !== selectionKeyRef.current
      ) return;

      // The server returns the Revenue Trend already bucketed and
      // zero-filled on the IST calendar.
      setStats(data || {});

      rateLimitedRef.current = false;
      hasLoadedOnceRef.current = true;

    } catch (err) {
      if (
        mySeq !== requestSeqRef.current ||
        requestedSelection !== selectionKeyRef.current
      ) return;

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
      // A dropped response leaves the loading state to the follow-up request.
      if (
        mySeq === requestSeqRef.current &&
        requestedSelection === selectionKeyRef.current
      ) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [range, specificDate]);

  // Every load -- first load, range change, realtime event, reconnect -- runs
  // through one single-flight queue, so at most one analytics request is ever
  // in flight and triggers that arrive meanwhile coalesce into one follow-up.
  // Realtime events additionally share a short window, so the paired
  // order-updated + analytics-updated of a single admin action cost one
  // request.
  const { refetch: refetchAnalytics } = useSingleFlightRefetch(
    () => {
      if (range === "specific" && !specificDate) return undefined;

      const isBackground = !userRequestedRef.current;
      userRequestedRef.current = false;

      return fetchAnalytics(isBackground);
    },
    { coalesceMs: 100 }
  );

  useEffect(() => {

    if (range === "specific" && !specificDate) {
      return;
    }

    userRequestedRef.current = true;
    refetchAnalytics({ immediate: true });

  }, [range, specificDate, refetchAnalytics]);

  // Split from the fetch above so it can depend on `socket`. The handler is a
  // stored reference and cleanup passes it to off(); the previous
  // socket.off(ANALYTICS_UPDATED) removed every listener for that event on the
  // shared socket, including AdminDashboard's.
  //
  // The same "specific range with no date chosen" guard is kept, so no live
  // refresh fires for a selection that cannot be fetched yet.
  useEffect(() => {

    if (!socket) return;

    if (range === "specific" && !specificDate) {
      return;
    }

    // New orders and auto-cancellations emit only order-updated but still
    // change these figures, so both events refresh the view.
    const handleAnalyticsUpdate = () => {
      refetchAnalytics();
    };

    socket.on(SocketEvents.ANALYTICS_UPDATED, handleAnalyticsUpdate);
    socket.on(SocketEvents.ORDER_UPDATED, handleAnalyticsUpdate);

    return () => {
      socket.off(SocketEvents.ANALYTICS_UPDATED, handleAnalyticsUpdate);
      socket.off(SocketEvents.ORDER_UPDATED, handleAnalyticsUpdate);
    };

  }, [socket, range, specificDate, refetchAnalytics]);

  // Updates emitted while the socket was down are never replayed.
  useResyncOnReconnect(socket, () => {
    refetchAnalytics({ immediate: true });
  });

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

  const revenueTrend = stats.revenueTrend;
  const isSingleDay = revenueTrend?.mode === 'intraday';

  // Net Revenue trend badge: net revenue in the second half of a multi-day
  // range against the first half. Not shown for a single day, where halves of
  // the clock say little.
  const getTrend = () => {
    const points = revenueTrend?.points || [];
    if (isSingleDay || points.length < 2) return null;

    const mid = Math.floor(points.length / 2);
    const sum = (arr) => arr.reduce((s, d) => s + Number(d.revenue || 0), 0);

    const firstSum = sum(points.slice(0, mid));
    const secondSum = sum(points.slice(mid));

    if (firstSum === 0) return null;

    return ((secondSum - firstSum) / firstSum) * 100;
  };

  const trend = getTrend();

  // Every accounting figure below comes from the backend (Gross / Refunds /
  // Net revenue, revenue orders and AOV = Net / revenue orders); nothing is
  // recalculated here.
  const isLegacyAccounting = stats.accountingModel === 'legacy';
  const failedRefunds = Number(stats.failedRefunds || 0);
  const revenueOrders = Number(stats.revenueOrders || 0);
  const refundedRevenueOrders = Math.max(
    revenueOrders - Number(stats.statusBreakdown?.completed || 0),
    0
  );

  const refundsHint = isLegacyAccounting
    ? 'Refund accounting unavailable'
    : failedRefunds > 0
      ? `${failedRefunds} failed, not counted`
      : 'Successful refunds only';

  // "yesterday", "last 7 days", or a formatted date as-is.
  const trendRangeLabel =
    range === 'specific' ? currentRangeLabel : currentRangeLabel.toLowerCase();

  const pieData = [
    { name: "Pending", value: stats.statusBreakdown?.pending || 0 },
    { name: "Preparing", value: stats.statusBreakdown?.preparing || 0 },
    { name: "Ready", value: stats.statusBreakdown?.ready || 0 },
    { name: "Completed", value: stats.statusBreakdown?.completed || 0 },
    { name: "Cancelled", value: stats.statusBreakdown?.cancelled || 0 },
    { name: "Refunded", value: stats.statusBreakdown?.refunded || 0 },
  ];

  const chartData = pieData.filter(item => item.value > 0);

  const totalStatusCount = pieData.reduce((s, p) => s + p.value, 0);

  const summaryCards = [
    {
      title: "Gross Revenue",
      value: formatRupees(stats.grossRevenue),
      hint: "Completed & refunded orders",
      icon: Receipt,
      color: "text-slate-700",
      bg: "bg-slate-100",
    },
    {
      title: "Refunds",
      value: formatRupees(stats.refunds),
      hint: refundsHint,
      icon: RotateCcw,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      title: "Net Revenue",
      value: formatRupees(stats.netRevenue),
      hint: "Gross minus refunds",
      icon: Wallet,
      color: "text-green-600",
      bg: "bg-green-50",
      trend,
    },
    {
      title: "Avg. Order Value",
      value: formatRupees(stats.avgOrderValue),
      hint: "Net per revenue order",
      icon: TrendingUp,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      title:
        range === "today"
          ? "Orders Today"
          : "Total Orders",
      value:
        range === "today"
          ? stats.ordersToday
          : stats.totalOrders,
      hint: `All statuses · ${stats.activeOrders || 0} active`,
      icon: ShoppingBag,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Revenue Orders",
      value: revenueOrders,
      hint: refundedRevenueOrders > 0
        ? `Completed · ${refundedRevenueOrders} refunded`
        : "Completed orders",
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  // Precompute once instead of inside every list item's render
  const maxPopularQty = Math.max(...(stats.popularItems || []).map((p) => p.qty || 0), 1);
  const maxCategoryQty = Math.max(...(stats.topCategories || []).map((c) => c.qty || 0), 1);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
      <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 transition-opacity duration-200 ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
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
              <p
                className={`text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 truncate ${card.color}`}
                title={String(card.value ?? 0)}
              >
                {card.value ?? 0}
              </p>
              {card.hint && (
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 leading-snug">{card.hint}</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* REVENUE TREND — full width hero chart */}
      <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 transition-opacity duration-200 ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
        <RevenueTrendChart
          trend={revenueTrend}
          rangeLabel={trendRangeLabel}
          isToday={range === 'today'}
          totalOrders={Number(stats.totalOrders || 0)}
          cancelledOrders={Number(stats.statusBreakdown?.cancelled || 0)}
        />
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
                    data={chartData}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={STATUS_COLORS[entry.name]}
                      />
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
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {entry.value}
                      <span className="ml-1.5 text-xs font-normal text-slate-400">
                        {Math.round((entry.value / totalStatusCount) * 100)}%
                      </span>
                    </span>
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