import { useCallback, useEffect, useRef } from "react";

// Runs `load` so that at most one request is in flight at a time.
//
// Overlapping GETs resolve in any order, so without this a slower, older
// response can land after a newer one and overwrite it (e.g. a realtime
// update or a freshly placed order appears and then disappears again).
//
// - refetch(): starts `load` if idle. If a load is already running, it queues
//   ONE follow-up that starts after it finishes; any number of further calls
//   while running coalesce into that same single follow-up.
// - markStale(): if a load is running, queue the follow-up without starting a
//   load when idle. Use it after updating local state in place from a realtime
//   event that an in-flight response may predate.
//
// `coalesceMs` (optional) delays the start of an idle refetch briefly so that
// events arriving together (e.g. order-updated and analytics-updated emitted
// for the same change) share one request. Pass { immediate: true } to skip
// the delay, e.g. for the first load.
//
// The latest `load` is always the one that runs, so a queued follow-up uses
// the current filters/props rather than those captured when it was queued.
export function useSingleFlightRefetch(load, { coalesceMs = 0 } = {}) {
  const loadRef = useRef(load);
  loadRef.current = load;

  const inFlightRef = useRef(null);
  const queuedRef = useRef(false);
  const pendingTimerRef = useRef(null);

  const start = useCallback(() => {
    const run = (async () => {
      try {
        do {
          queuedRef.current = false;
          await loadRef.current();
        } while (queuedRef.current);
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    return run;
  }, []);

  const refetch = useCallback(
    ({ immediate = false } = {}) => {
      if (inFlightRef.current) {
        queuedRef.current = true;
        return inFlightRef.current;
      }

      if (coalesceMs > 0 && !immediate) {
        if (!pendingTimerRef.current) {
          pendingTimerRef.current = setTimeout(() => {
            pendingTimerRef.current = null;

            if (inFlightRef.current) {
              queuedRef.current = true;
            } else {
              start();
            }
          }, coalesceMs);
        }

        return undefined;
      }

      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }

      return start();
    },
    [coalesceMs, start]
  );

  const markStale = useCallback(() => {
    if (inFlightRef.current) {
      queuedRef.current = true;
    }
  }, []);

  useEffect(
    () => () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    },
    []
  );

  return { refetch, markStale };
}
