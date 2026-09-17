import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import {
  categoryTickInterval,
  formatBucketLabel,
  formatBucketTick,
  formatISTTime,
  formatISTTimeRange,
  formatRupees,
  formatRupeesCompact,
  intradayAxis,
  intradayChartRows,
  rupeeTicks,
} from '../../utils/revenueChart';

const BLUE = '#2563EB';

// Tracks a media query so tick density and chart height follow the viewport.
function useMediaQuery(query) {
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;

    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);

    onChange();
    mql.addEventListener?.('change', onChange);
    // Some embedded/emulated viewports resize without a media-query event.
    window.addEventListener('resize', onChange);
    return () => {
      mql.removeEventListener?.('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, [query]);

  return matches;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// rows: [label, value, tone] where tone is 'strong' | 'refund' | undefined;
// a null row draws a divider.
function TooltipCard({ title, rows }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg shadow-slate-900/5 text-xs sm:text-[13px] min-w-[190px]">
      <p className="font-semibold text-slate-900 mb-1.5">{title}</p>
      <div className="space-y-1">
        {rows.map((row, i) =>
          row === null ? (
            <div key={`divider-${i}`} className="border-t border-slate-100 my-1" />
          ) : (
            <div key={row[0]} className="flex items-center justify-between gap-4">
              <span className="text-slate-500">{row[0]}</span>
              <span
                className={
                  row[2] === 'strong'
                    ? 'font-bold text-blue-600'
                    : row[2] === 'refund'
                      ? 'font-semibold text-rose-600'
                      : 'font-semibold text-slate-800'
                }
              >
                {row[1]}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// Gross, refunds and net for one period, then the running net total.
const accountingRows = (point, ordersLabel) => [
  ['Gross revenue', formatRupees(point.gross)],
  ['Refunds', point.refunds > 0 ? `−${formatRupees(point.refunds)}` : formatRupees(0), point.refunds > 0 ? 'refund' : undefined],
  ['Net revenue', formatRupees(point.revenue)],
  ...(ordersLabel ? [[ordersLabel, point.orders ?? 0]] : []),
  null,
  ['Cumulative net', formatRupees(point.cumulative), 'strong'],
];

function IntradayTooltip({ active, payload, perOrder }) {
  const point = active && payload?.length ? payload[0].payload : null;
  if (!point || point.synthetic) return null;

  const title = perOrder
    ? formatISTTime(point.t, { alwaysMinutes: true })
    : formatISTTimeRange(point.start, point.end);

  return (
    <TooltipCard
      title={title}
      rows={accountingRows(point, perOrder ? null : 'Revenue orders')}
    />
  );
}

function MultiDayTooltip({ active, payload, mode }) {
  const point = active && payload?.length ? payload[0].payload : null;
  if (!point) return null;

  return (
    <TooltipCard
      title={formatBucketLabel(point, mode)}
      rows={accountingRows(point, 'Revenue orders')}
    />
  );
}

function EmptyState({ isToday, rangeLabel, totalOrders, cancelledOrders }) {
  let detail;

  if (totalOrders > 0 && (cancelledOrders || 0) === totalOrders) {
    detail = `${plural(totalOrders, 'order')} ${totalOrders === 1 ? 'was' : 'were'} cancelled, so nothing counts as revenue.`;
  } else if (totalOrders > 0) {
    detail = `${plural(totalOrders, 'order')} placed. Revenue is counted once an order is completed.`;
  } else {
    detail = isToday
      ? 'Completed orders will appear here as they come in.'
      : 'No orders were placed in this period.';
  }

  return (
    <div className="flex flex-col items-center justify-center text-center py-12 sm:py-16 px-4">
      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
        <LineChartIcon size={22} className="text-blue-500" />
      </div>
      <p className="text-sm sm:text-base font-semibold text-slate-800">
        {isToday ? 'No revenue yet today' : `No revenue for ${rangeLabel}`}
      </p>
      <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs">{detail}</p>
    </div>
  );
}

/**
 * Revenue Trend: cumulative NET revenue (gross revenue of completed and
 * refunded orders, minus successful refunds). Every point carries gross,
 * refunds and net from the backend; nothing is recalculated here.
 *
 * `trend` comes from /analytics/dashboard:
 *  - mode "intraday": points on an IST time axis (one per order, or per
 *    activity-aligned bucket), with window bounds;
 *  - mode "day" | "week" | "month": zero-filled calendar buckets.
 */
export default function RevenueTrendChart({
  trend,
  rangeLabel,
  isToday,
  totalOrders = 0,
  cancelledOrders = 0,
}) {
  const isMobile = useMediaQuery('(max-width: 639px)');
  const height = isMobile ? 240 : 300;

  const mode = trend?.mode;
  const points = trend?.points || [];
  // Net total. The chart is shown whenever there was gross revenue, so a
  // fully refunded period still shows its orders (with a flat net line).
  const total = Number(trend?.totalRevenue || 0);
  const gross = Number(trend?.grossRevenue ?? total);
  const refunds = Number(trend?.refunds || 0);
  const hasRevenue = points.length > 0 && gross > 0;

  const intraday = useMemo(() => {
    if (mode !== 'intraday' || !hasRevenue) return null;

    const first = points[0];
    const last = points[points.length - 1];
    const perOrder = trend.bucketMinutes === 0;

    const axis = intradayAxis({
      firstAt: perOrder ? first.t : first.start,
      lastAt: last.t,
      windowStart: trend.windowStart,
      windowEnd: trend.windowEnd,
      maxTicks: isMobile ? 4 : 8,
    });

    return { axis, perOrder, rows: intradayChartRows(trend, axis) };
  }, [mode, hasRevenue, points, trend, isMobile]);

  const yTicks = useMemo(() => rupeeTicks(total, isMobile ? 5 : 6), [total, isMobile]);
  const yWidth = Math.max(40, 12 + 7 * Math.max(...yTicks.map((v) => formatRupeesCompact(v).length)));

  const caption =
    mode === 'intraday'
      ? trend?.bucketMinutes === 0
        ? 'Each step is an order (IST)'
        : trend?.bucketMinutes
          ? `${trend.bucketMinutes >= 60 ? `${trend.bucketMinutes / 60}-hour` : `${trend.bucketMinutes}-minute`} intervals (IST)`
          : 'Time of day (IST)'
      : mode === 'week'
        ? 'Weekly totals (weeks start Monday)'
        : mode === 'month'
          ? 'Monthly totals'
          : 'Daily totals';

  const commonAxis = {
    tick: { fontSize: 11, fill: '#94a3b8' },
    axisLine: false,
    tickLine: false,
  };

  const yAxis = (
    <YAxis
      {...commonAxis}
      width={yWidth}
      domain={[0, yTicks[yTicks.length - 1]]}
      ticks={yTicks}
      allowDecimals={false}
      tickFormatter={formatRupeesCompact}
    />
  );

  const dotFor = (count) => (props) => {
    const { cx, cy, payload, index } = props;
    if (payload?.synthetic || count > 16 || cx == null || cy == null) {
      return <g key={`dot-${index}`} />;
    }
    return (
      <circle key={`dot-${index}`} cx={cx} cy={cy} r={isMobile ? 3 : 3.5} stroke={BLUE} strokeWidth={2} fill="#fff" />
    );
  };

  // No hover marker on the synthetic start/end rows, which have no tooltip.
  const activeDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload?.synthetic || cx == null || cy == null) return <g />;
    return <circle cx={cx} cy={cy} r={6} stroke={BLUE} strokeWidth={3} fill="#fff" />;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 mb-4">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-slate-900">Revenue Trend</h3>
          <p className="text-xs sm:text-sm text-slate-400">
            Cumulative net revenue{hasRevenue ? ` · ${caption}` : ''}
          </p>
        </div>
        {hasRevenue && (
          <div className="text-left sm:text-right">
            <p className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
              {formatRupees(total)} <span className="text-xs font-semibold text-slate-400">net</span>
            </p>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Gross {formatRupees(gross)} · Refunds {formatRupees(refunds)}
            </p>
          </div>
        )}
      </div>

      {!hasRevenue ? (
        <EmptyState
          isToday={isToday}
          rangeLabel={rangeLabel}
          totalOrders={totalOrders}
          cancelledOrders={cancelledOrders}
        />
      ) : intraday ? (
        <div className="w-full" style={{ height }} role="img" aria-label={`Cumulative net revenue for ${rangeLabel}: ${formatRupees(total)} (gross ${formatRupees(gross)}, refunds ${formatRupees(refunds)})`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={intraday.rows} margin={{ top: 10, right: isMobile ? 18 : 28, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BLUE} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

              <XAxis
                {...commonAxis}
                dataKey="t"
                type="number"
                scale="time"
                domain={intraday.axis.domain}
                ticks={intraday.axis.ticks}
                interval={0}
                tickFormatter={(t) => formatISTTime(t)}
                padding={{ left: 4, right: 4 }}
              />
              {yAxis}

              <Tooltip
                content={<IntradayTooltip perOrder={intraday.perOrder} />}
                cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }}
              />

              <Area
                type={intraday.perOrder ? 'stepAfter' : 'monotoneX'}
                dataKey="cumulative"
                stroke={BLUE}
                strokeWidth={isMobile ? 2.5 : 3}
                fill="url(#revenueTrendFill)"
                animationDuration={450}
                dot={dotFor(points.length)}
                activeDot={activeDot}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="w-full" style={{ height }} role="img" aria-label={`Cumulative net revenue for ${rangeLabel}: ${formatRupees(total)} (gross ${formatRupees(gross)}, refunds ${formatRupees(refunds)})`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 10, right: isMobile ? 18 : 28, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BLUE} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

              <XAxis
                {...commonAxis}
                dataKey="start"
                interval={categoryTickInterval(
                  points.length,
                  mode === 'month' ? (isMobile ? 6 : 12) : (isMobile ? 4 : 8)
                )}
                tickFormatter={(start) => formatBucketTick(start, mode)}
                minTickGap={4}
              />
              {yAxis}

              <Tooltip
                content={<MultiDayTooltip mode={mode} />}
                cursor={{ fill: 'rgba(148,163,184,0.12)' }}
              />

              {/* Net revenue of each period, under the running net total. */}
              <Bar
                dataKey="revenue"
                fill="#bfdbfe"
                radius={[3, 3, 0, 0]}
                maxBarSize={28}
                animationDuration={450}
              />

              <Area
                type="monotoneX"
                dataKey="cumulative"
                stroke={BLUE}
                strokeWidth={isMobile ? 2.5 : 3}
                fill="url(#revenueTrendFill)"
                animationDuration={450}
                dot={dotFor(points.length)}
                activeDot={activeDot}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasRevenue && mode !== 'intraday' && (
        <div className="flex items-center gap-4 mt-3 text-[11px] sm:text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full bg-blue-600" /> Cumulative net
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-200" />
            {mode === 'day' ? 'Net per day' : mode === 'week' ? 'Net per week' : 'Net per month'}
          </span>
        </div>
      )}
    </div>
  );
}
