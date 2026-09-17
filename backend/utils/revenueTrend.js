// Revenue Trend series for Admin Analytics.
//
// Accounting (see supabase/migrations/20260917120000_net_revenue_accounting.sql):
//   gross    total_amount of revenue orders (Completed, or Refunded)
//   refunds  successful (processed) refund amounts of those orders
//   net      gross - refunds
// In every point `revenue` and `cumulative` are NET figures; `gross` and
// `refunds` are carried alongside for the tooltip. Everything is dated by when
// the order was placed. Amounts are summed in integer paise and returned as
// rupee numbers.
//
// All calendar and clock arithmetic is on India Standard Time, whatever the
// Node process timezone is.

import { IST_OFFSET_MS } from "./istDate.js";
import { numericToPaise } from "./money.js";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// Up to this many revenue orders, each order is its own point.
const PER_ORDER_MAX = 12;
// Candidate intraday bucket sizes, smallest first.
const BUCKET_MINUTES = [5, 10, 15, 30, 60, 120, 180];
// Largest number of intraday buckets before a coarser size is chosen.
const MAX_INTRADAY_BUCKETS = 24;

const toRupees = (paise) => Math.round(paise) / 100;

// Refunds can never exceed what was charged.
const clampRefund = (refund, gross) => Math.min(Math.max(refund, 0), gross);

// A revenue-order row: { created_at, gross, refund } from
// analytics_revenue_accounting, or a legacy { created_at, total_amount } row
// (no refund data) while that function is unavailable.
function orderRowPaise(row) {
  const gross = numericToPaise(row.gross ?? row.total_amount) ?? 0;
  const refund = clampRefund(numericToPaise(row.refund ?? 0) ?? 0, gross);
  return { gross, refund };
}

// Start of the IST clock bucket containing `t` (e.g. 10:37 -> 10:30 for 15 min).
function istBucketStart(t, bucketMs) {
  return Math.floor((t + IST_OFFSET_MS) / bucketMs) * bucketMs - IST_OFFSET_MS;
}

/**
 * Chooses the intraday bucket size for a set of order timestamps.
 * Returns 0 for "one point per order", otherwise a size in minutes.
 */
export function chooseIntradayBucketMinutes(times) {
  if (times.length <= PER_ORDER_MAX) return 0;

  const first = times[0];
  const last = times[times.length - 1];

  for (const minutes of BUCKET_MINUTES) {
    const bucketMs = minutes * MINUTE_MS;
    const count =
      (istBucketStart(last, bucketMs) - istBucketStart(first, bucketMs)) / bucketMs + 1;

    if (count <= MAX_INTRADAY_BUCKETS) return minutes;
  }

  return BUCKET_MINUTES[BUCKET_MINUTES.length - 1];
}

/**
 * Builds the series for a single IST day from that day's revenue orders.
 *
 * @param {Array<{created_at: string, gross?: number, refund?: number, total_amount?: number}>} orders
 * @param {{ windowStart: Date, windowEnd: Date, now?: number }} options
 *
 * Points are plotted at the time revenue was earned: the order time in
 * per-order mode, otherwise the end of the bucket (clamped to the window end
 * and to "now"), so the cumulative line never rises before the orders did.
 */
export function buildIntradayTrend(orders, { windowStart, windowEnd, now = Date.now() }) {
  const entries = (orders || [])
    .map((order) => ({
      t: Date.parse(order.created_at),
      ...orderRowPaise(order),
    }))
    .filter((entry) => Number.isFinite(entry.t))
    .sort((a, b) => a.t - b.t);

  const base = {
    mode: "intraday",
    timezone: "Asia/Kolkata",
    windowStart: windowStart.getTime(),
    windowEnd: windowEnd.getTime(),
  };

  if (entries.length === 0) {
    return {
      ...base,
      bucketMinutes: null,
      firstOrderAt: null,
      lastOrderAt: null,
      totalRevenue: 0,
      grossRevenue: 0,
      refunds: 0,
      revenueOrders: 0,
      points: [],
    };
  }

  const times = entries.map((entry) => entry.t);
  const bucketMinutes = chooseIntradayBucketMinutes(times);
  const points = [];
  let cumulative = 0;
  let totalGross = 0;
  let totalRefunds = 0;

  if (bucketMinutes === 0) {
    for (const entry of entries) {
      const net = entry.gross - entry.refund;
      cumulative += net;
      totalGross += entry.gross;
      totalRefunds += entry.refund;

      points.push({
        t: entry.t,
        start: entry.t,
        end: entry.t,
        gross: toRupees(entry.gross),
        refunds: toRupees(entry.refund),
        revenue: toRupees(net),
        orders: 1,
        cumulative: toRupees(cumulative),
      });
    }
  } else {
    const bucketMs = bucketMinutes * MINUTE_MS;
    const firstBucket = istBucketStart(times[0], bucketMs);
    const lastBucket = istBucketStart(times[times.length - 1], bucketMs);
    const cap = Math.min(windowEnd.getTime(), Math.max(now, times[times.length - 1]));

    let index = 0;

    for (let start = firstBucket; start <= lastBucket; start += bucketMs) {
      const end = start + bucketMs;
      let gross = 0;
      let refunds = 0;
      let count = 0;

      while (index < entries.length && entries[index].t < end) {
        gross += entries[index].gross;
        refunds += entries[index].refund;
        count += 1;
        index += 1;
      }

      cumulative += gross - refunds;
      totalGross += gross;
      totalRefunds += refunds;

      points.push({
        t: Math.max(start, Math.min(end, cap)),
        start: Math.max(start, windowStart.getTime()),
        end: Math.min(end, windowEnd.getTime() + 1),
        gross: toRupees(gross),
        refunds: toRupees(refunds),
        revenue: toRupees(gross - refunds),
        orders: count,
        cumulative: toRupees(cumulative),
      });
    }
  }

  return {
    ...base,
    bucketMinutes,
    firstOrderAt: times[0],
    lastOrderAt: times[times.length - 1],
    totalRevenue: toRupees(cumulative),
    grossRevenue: toRupees(totalGross),
    refunds: toRupees(totalRefunds),
    revenueOrders: entries.length,
    points,
  };
}

// ---- multi-day ----

// Calendar parts <-> "YYYY-MM-DD", using UTC-noon anchors so arithmetic never
// crosses a boundary because of the host timezone.
const partsToKey = ({ year, month, day }) => {
  const d = new Date(Date.UTC(year, month, day, 12));
  return d.toISOString().slice(0, 10);
};

const keyToUTCNoon = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day, 12);
};

const addDays = (key, days) =>
  new Date(keyToUTCNoon(key) + days * DAY_MS).toISOString().slice(0, 10);

/** Chooses day / week / month granularity from the number of calendar days. */
export function chooseMultiDayGranularity(dayCount) {
  if (dayCount <= 62) return "day";
  if (dayCount <= 186) return "week";
  return "month";
}

/**
 * Builds the series for a multi-day range from per-IST-day rows:
 * { date: "YYYY-MM-DD", gross, refunds, orders } from
 * analytics_revenue_accounting, or legacy { date, revenue } rows (no refund
 * data) while that function is unavailable. Every day, week or month in the
 * range is present, including those without revenue.
 *
 * Weeks start on Monday; the first and last week are clipped to the range.
 */
export function buildMultiDayTrend(dayRows, { startParts, endParts, granularity }) {
  const startKey = partsToKey(startParts);
  const endKey = partsToKey(endParts);
  const dayCount = Math.round((keyToUTCNoon(endKey) - keyToUTCNoon(startKey)) / DAY_MS) + 1;
  const mode = granularity || chooseMultiDayGranularity(dayCount);

  const byDay = new Map();

  for (const row of dayRows || []) {
    if (!row?.date) continue;

    const key = String(row.date).slice(0, 10);
    const gross = numericToPaise(Number(row.gross ?? row.revenue ?? 0)) ?? 0;
    const refunds = clampRefund(numericToPaise(Number(row.refunds ?? 0)) ?? 0, gross);
    const day = byDay.get(key) || { gross: 0, refunds: 0, orders: 0 };

    day.gross += gross;
    day.refunds += refunds;
    day.orders += Number(row.orders ?? 0) || 0;
    byDay.set(key, day);
  }

  const buckets = [];

  const bucketKeyFor = (key) => {
    if (mode === "day") return key;

    if (mode === "month") return `${key.slice(0, 7)}-01`;

    // Monday of the week containing `key`.
    const weekday = new Date(keyToUTCNoon(key)).getUTCDay(); // 0 = Sunday
    const sinceMonday = (weekday + 6) % 7;
    return addDays(key, -sinceMonday);
  };

  for (let i = 0, key = startKey; i < dayCount; i += 1, key = addDays(key, 1)) {
    const bucketKey = bucketKeyFor(key);
    let bucket = buckets[buckets.length - 1];

    if (!bucket || bucket.key !== bucketKey) {
      bucket = { key: bucketKey, start: key, end: key, gross: 0, refunds: 0, orders: 0 };
      buckets.push(bucket);
    }

    bucket.end = key;

    const day = byDay.get(key);
    if (day) {
      bucket.gross += day.gross;
      bucket.refunds += day.refunds;
      bucket.orders += day.orders;
    }
  }

  let cumulative = 0;
  let totalGross = 0;
  let totalRefunds = 0;

  const points = buckets.map((bucket) => {
    cumulative += bucket.gross - bucket.refunds;
    totalGross += bucket.gross;
    totalRefunds += bucket.refunds;

    return {
      key: bucket.key,
      start: bucket.start,
      end: bucket.end,
      gross: toRupees(bucket.gross),
      refunds: toRupees(bucket.refunds),
      revenue: toRupees(bucket.gross - bucket.refunds),
      orders: bucket.orders,
      cumulative: toRupees(cumulative),
    };
  });

  return {
    mode,
    timezone: "Asia/Kolkata",
    rangeStart: startKey,
    rangeEnd: endKey,
    totalRevenue: toRupees(cumulative),
    grossRevenue: toRupees(totalGross),
    refunds: toRupees(totalRefunds),
    points,
  };
}
