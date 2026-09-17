// Scale, tick and label helpers for the Admin Analytics Revenue Trend.
//
// Everything time-related is computed on India Standard Time (fixed +05:30,
// no daylight saving) from epoch milliseconds, so the chart reads the same in
// any browser timezone.

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ---------------- money ---------------- */

// ₹1,23,456 or ₹1,234.50 -- decimals only when there are paise.
export function formatRupees(value) {
  const amount = Math.round(Number(value || 0) * 100) / 100;
  const hasPaise = !Number.isInteger(amount);

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

// Compact axis label: ₹0, ₹750, ₹1.5K, ₹12K, ₹1.2L, ₹3Cr.
export function formatRupeesCompact(value) {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);

  const compact = (divisor, suffix) => {
    const scaled = amount / divisor;
    const digits = Math.abs(scaled) < 10 && !Number.isInteger(scaled) ? 1 : 0;
    return `₹${Number(scaled.toFixed(digits))}${suffix}`;
  };

  if (abs >= 1e7) return compact(1e7, "Cr");
  if (abs >= 1e5) return compact(1e5, "L");
  if (abs >= 1e3) return compact(1e3, "K");

  return `₹${Math.round(amount)}`;
}

// A 1, 2, 2.5 or 5 x 10^k step at or above `rough`.
export function niceStep(rough) {
  if (!(rough > 0)) return 1;

  const exponent = Math.floor(Math.log10(rough));
  const magnitude = 10 ** exponent;
  const fraction = rough / magnitude;

  const nice =
    fraction <= 1 ? 1 :
      fraction <= 2 ? 2 :
        fraction <= 2.5 ? 2.5 :
          fraction <= 5 ? 5 : 10;

  return nice * magnitude;
}

/**
 * Rounded rupee ticks from 0 to just above `max`, with at most `maxTicks`
 * ticks. Steps are whole rupees, so axis labels never need decimals.
 */
export function rupeeTicks(max, maxTicks = 5) {
  const top = Number(max) > 0 ? Number(max) : 0;

  if (top === 0) return [0, 50, 100];

  const intervals = Math.max(1, maxTicks - 1);
  let step = Math.max(1, niceStep(top / intervals));

  // Leave a little headroom so the line never touches the top edge.
  let upper = Math.ceil((top * 1.05) / step) * step;

  while (upper / step > intervals) {
    step = Math.max(1, niceStep(step * 1.01));
    upper = Math.ceil((top * 1.05) / step) * step;
  }

  // A 2.5 step below ₹10 would produce ₹2.5 labels; use whole rupees.
  if (!Number.isInteger(step)) {
    step = Math.ceil(step);
    upper = Math.ceil((top * 1.05) / step) * step;
  }

  const ticks = [];
  for (let v = 0; v <= upper + step / 1000; v += step) {
    ticks.push(Math.round(v));
  }

  return ticks;
}

/* ---------------- intraday time ---------------- */

function istClock(t) {
  const shifted = new Date(t + IST_OFFSET_MS);
  return { hours: shifted.getUTCHours(), minutes: shifted.getUTCMinutes() };
}

// 10 AM, 10:30 AM, 12 PM, 12 AM.
export function formatISTTime(t, { alwaysMinutes = false } = {}) {
  const { hours, minutes } = istClock(t);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  if (minutes === 0 && !alwaysMinutes) return `${hour12} ${period}`;

  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

// 10:30 – 10:45 AM, 11:45 AM – 12 PM.
export function formatISTTimeRange(start, end) {
  const startLabel = formatISTTime(start, { alwaysMinutes: true });
  const endLabel = formatISTTime(end, { alwaysMinutes: true });
  const [startTime, startPeriod] = startLabel.split(" ");

  return startPeriod === endLabel.split(" ")[1]
    ? `${startTime} – ${endLabel}`
    : `${startLabel} – ${endLabel}`;
}

const ceilIST = (t, stepMs) =>
  Math.ceil((t + IST_OFFSET_MS) / stepMs) * stepMs - IST_OFFSET_MS;

const TIME_TICK_MINUTES = [15, 30, 60, 120, 180, 240, 360];

/**
 * X domain and ticks for a single IST day.
 *
 * The axis starts shortly before the first revenue point instead of at
 * midnight and ends shortly after the last: padding is 8% of the active span,
 * at least 15 minutes (30 for a single order), and never leaves the IST day.
 * Ticks are placed on round IST clock times inside that domain, using the
 * smallest step (15 min ... 6 h) that keeps at most `maxTicks` labels.
 */
export function intradayAxis({ firstAt, lastAt, windowStart, windowEnd, maxTicks = 6 }) {
  const dayEnd = windowEnd + 1; // exclusive: next IST midnight
  const span = Math.max(0, lastAt - firstAt);
  const pad = span === 0 ? 30 * MINUTE_MS : Math.max(15 * MINUTE_MS, span * 0.08);

  const lo = Math.max(windowStart, firstAt - pad);
  const hi = Math.min(dayEnd, lastAt + pad);

  const ticksFor = (stepMs) => {
    const ticks = [];
    for (let t = ceilIST(lo, stepMs); t <= hi; t += stepMs) ticks.push(t);
    return ticks;
  };

  for (const minutes of TIME_TICK_MINUTES) {
    const ticks = ticksFor(minutes * MINUTE_MS);
    if (ticks.length <= maxTicks) return { domain: [lo, hi], ticks, stepMinutes: minutes };
  }

  const minutes = TIME_TICK_MINUTES[TIME_TICK_MINUTES.length - 1];
  return { domain: [lo, hi], ticks: ticksFor(minutes * MINUTE_MS), stepMinutes: minutes };
}

/**
 * Chart rows for a single IST day: the server's points plus a zero anchor at
 * the left edge and, for a day that is still running or already over, a tail
 * that carries the final total to the right edge. Synthetic rows are flagged
 * so the tooltip ignores them.
 */
export function intradayChartRows(trend, axis, now = Date.now()) {
  const points = trend?.points || [];
  if (points.length === 0) return [];

  const [lo, hi] = axis.domain;
  const perOrder = trend.bucketMinutes === 0;
  const first = points[0];
  const last = points[points.length - 1];

  const anchorAt = perOrder ? lo : Math.max(lo, first.start);
  const rows = [];

  if (anchorAt < first.t) {
    rows.push({ t: anchorAt, cumulative: 0, synthetic: true });
  }

  rows.push(...points);

  const tailAt = Math.min(hi, Math.max(last.t, now));
  if (tailAt > last.t) {
    rows.push({ t: tailAt, cumulative: last.cumulative, synthetic: true });
  }

  return rows;
}

/* ---------------- calendar dates ---------------- */

function parseKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return { year, month: month - 1, day };
}

function weekdayOf({ year, month, day }) {
  return WEEKDAYS_SHORT[new Date(Date.UTC(year, month, day, 12)).getUTCDay()];
}

// Axis label for a multi-day bucket, from the first day it covers.
export function formatBucketTick(key, mode) {
  const { month, day } = parseKey(key);

  if (mode === "month") return MONTHS_SHORT[month];

  return `${day} ${MONTHS_SHORT[month]}`;
}

// Tooltip heading for a multi-day point.
export function formatBucketLabel(point, mode) {
  const start = parseKey(point.start);
  const end = parseKey(point.end);

  if (mode === "day") {
    return `${weekdayOf(start)}, ${start.day} ${MONTHS_SHORT[start.month]} ${start.year}`;
  }

  if (mode === "month") {
    const lastDay = new Date(Date.UTC(start.year, start.month + 1, 0)).getUTCDate();
    const whole = start.day === 1 && end.day === lastDay;

    return whole
      ? `${MONTHS_LONG[start.month]} ${start.year}`
      : `${start.day} – ${end.day} ${MONTHS_SHORT[start.month]} ${start.year}`;
  }

  // week
  if (start.month === end.month) {
    return start.day === end.day
      ? `${start.day} ${MONTHS_SHORT[start.month]}`
      : `${start.day} – ${end.day} ${MONTHS_SHORT[start.month]}`;
  }

  return `${start.day} ${MONTHS_SHORT[start.month]} – ${end.day} ${MONTHS_SHORT[end.month]}`;
}

// Tick interval so no more than `maxLabels` labels are drawn.
export function categoryTickInterval(count, maxLabels) {
  if (count <= maxLabels) return 0;
  return Math.ceil(count / maxLabels) - 1;
}
