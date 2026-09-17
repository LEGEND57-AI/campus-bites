// India Standard Time calendar helpers.
//
// CampusCraves runs on the IST calendar: an order belongs to the IST day it
// was placed on, whatever timezone the Node process or the database happens
// to use (IST in development, usually UTC in production). Every "today" or
// calendar range is resolved here to explicit instants, so neither the host's
// nor PostgreSQL's timezone can influence the result.
//
// IST has a fixed +05:30 offset and no daylight saving, so shifting by a
// constant is exact.

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The IST calendar date an instant falls on.
export function istCalendarParts(instant = new Date()) {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

// Date.UTC normalises out-of-range month/day, so { month: month - 3 } and
// { day: day - 6 } roll back across year and month boundaries correctly.
export function istStartOfDay({ year, month, day }) {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS);
}

// Inclusive end of an IST day (23:59:59.999). Kept for the SQL functions that
// take an inclusive upper bound; new queries should prefer istDayWindow().
export function istEndOfDay({ year, month, day }) {
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MS);
}

// Half-open window [start of the IST day, start of the next IST day) for the
// IST day containing `instant`. Use with `>= start AND < end`.
export function istDayWindow(instant = new Date()) {
  const today = istCalendarParts(instant);

  return {
    start: istStartOfDay(today),
    end: istStartOfDay({ ...today, day: today.day + 1 }),
  };
}

// Named analytics ranges, resolved on the IST calendar. The end is the
// inclusive end of today.
export function getISTDateRange(range = "7days", instant = new Date()) {
  const today = istCalendarParts(instant);
  const endOfToday = istEndOfDay(today);

  switch (range) {
    case "today":
      return { start: istStartOfDay(today), end: endOfToday };

    case "yesterday": {
      const yesterday = { ...today, day: today.day - 1 };
      return {
        start: istStartOfDay(yesterday),
        end: istEndOfDay(yesterday),
      };
    }

    case "7days":
      return {
        start: istStartOfDay({ ...today, day: today.day - 6 }),
        end: endOfToday,
      };

    // Last 30 days inclusive of today.
    case "30days":
      return {
        start: istStartOfDay({ ...today, day: today.day - 29 }),
        end: endOfToday,
      };

    case "3months":
      return {
        start: istStartOfDay({ ...today, month: today.month - 3 }),
        end: endOfToday,
      };

    case "thismonth":
      return {
        start: istStartOfDay({ ...today, day: 1 }),
        end: endOfToday,
      };

    case "thisyear":
      return {
        start: istStartOfDay({ year: today.year, month: 0, day: 1 }),
        end: endOfToday,
      };

    default:
      return {
        start: istStartOfDay({ ...today, day: today.day - 6 }),
        end: endOfToday,
      };
  }
}

// A YYYY-MM-DD string is an IST calendar date, not an instant, so it is parsed
// by component rather than by Date() -- which would read it as UTC.
export function istDayFromISODate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));

  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}
