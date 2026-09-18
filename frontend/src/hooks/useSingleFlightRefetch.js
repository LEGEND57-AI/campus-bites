import { useCallback, useEffect, useRef } from "react";
import { createRefetchScheduler } from "../utils/refetchScheduler";

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
// for the same change) share one request, and spaces follow-ups requested
// while a load is running by the same window. Pass { immediate: true } to skip
// the delay, e.g. for the first load or a user action. The scheduling rules
// live in utils/refetchScheduler.js.
//
// The latest `load` is always the one that runs, so a queued follow-up uses
// the current filters/props rather than those captured when it was queued.
export function useSingleFlightRefetch(load, { coalesceMs = 0 } = {}) {
  const loadRef = useRef(load);
  loadRef.current = load;

  const schedulerRef = useRef(null);

  if (schedulerRef.current === null) {
    schedulerRef.current = createRefetchScheduler(
      () => loadRef.current(),
      { coalesceMs }
    );
  }

  const refetch = useCallback(
    (options) => schedulerRef.current.refetch(options),
    []
  );

  const markStale = useCallback(() => schedulerRef.current.markStale(), []);

  useEffect(() => () => schedulerRef.current.cancelPending(), []);

  return { refetch, markStale };
}
