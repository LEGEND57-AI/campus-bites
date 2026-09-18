// Scheduling behind useSingleFlightRefetch, kept free of React so it can be
// tested on its own.
//
// Guarantees:
// - At most one `load` runs at a time. Overlapping GETs resolve in any order,
//   so without this an older response could land after a newer one.
// - An IMMEDIATE refetch (first load, filter/search change, a user action,
//   Refresh, reconnect) starts at once, or -- if a load is running -- queues
//   ONE follow-up that starts as soon as it finishes.
// - A COALESCED refetch (a realtime event), when `coalesceMs` > 0, waits
//   `coalesceMs`; every coalesced request inside that window shares the one
//   load. If a load is already running, the follow-up waits a further
//   `coalesceMs` after it finishes instead of starting straight away, so a
//   steady stream of events produces at most one load per
//   (coalesceMs + load time) -- not one per event.
// - An immediate request always wins over a pending coalesced one: the load it
//   starts reads everything the pending one would have.
// - markStale(): if a load is running, queue an immediate follow-up without
//   starting a load when idle (the in-flight response may predate a change
//   already applied locally).
//
// The latest `load` is always the one that runs (callers pass a function that
// reads their current filters), so a follow-up never uses stale arguments.

// Window used by the admin screens for refetches triggered by realtime events
// (order-updated / analytics-updated). A lunch rush emits several events per
// order; refetching per event is what ran an admin into the rate limit.
export const REALTIME_REFETCH_COALESCE_MS = 1500;

const NONE = 0;
const COALESCED = 1;
const IMMEDIATE = 2;

export function createRefetchScheduler(
  load,
  { coalesceMs = 0, setTimer = setTimeout, clearTimer = clearTimeout } = {}
) {
  let inFlight = null;
  let followUp = NONE;
  let timer = null;

  const cancelPending = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };

  const schedule = () => {
    if (timer !== null) return;

    timer = setTimer(() => {
      timer = null;

      if (inFlight) {
        if (followUp === NONE) followUp = COALESCED;
      } else {
        start();
      }
    }, coalesceMs);
  };

  const start = () => {
    const run = (async () => {
      try {
        do {
          followUp = NONE;
          await load();
        } while (followUp === IMMEDIATE);
      } finally {
        inFlight = null;

        if (followUp === COALESCED) {
          followUp = NONE;
          schedule();
        }
      }
    })();

    inFlight = run;
    return run;
  };

  const refetch = ({ immediate = false } = {}) => {
    if (immediate || coalesceMs <= 0) {
      cancelPending();

      if (inFlight) {
        followUp = IMMEDIATE;
        return inFlight;
      }

      return start();
    }

    if (inFlight) {
      if (followUp === NONE) followUp = COALESCED;
      return inFlight;
    }

    schedule();
    return undefined;
  };

  const markStale = () => {
    if (inFlight) followUp = IMMEDIATE;
  };

  return { refetch, markStale, cancelPending };
}
