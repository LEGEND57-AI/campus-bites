import { useEffect, useSyncExternalStore } from "react";
import { notificationAPI } from "../services/api";
import { createUnreadCountStore } from "./unreadCountStore";

// A realtime-maintained count only needs a server read when it may have
// drifted: first use, after a socket reconnect (invalidate), or once it is
// older than this.
export const UNREAD_COUNT_STALE_MS = 60_000;

export const unreadCountStore = createUnreadCountStore({
  staleMs: UNREAD_COUNT_STALE_MS,
  fetchCount: async () => {
    const { data } = await notificationAPI.getUnreadCount();
    const count = Number.isInteger(data?.count) ? data.count : data?.unreadCount;
    return Number.isInteger(count) ? count : 0;
  },
});

// The unread count for display. Mounting (e.g. every page's header) reads it
// from the shared store and only fetches when it is missing or stale; pass
// { maxAgeMs: 0 } to insist on a fresh server value (the Notifications page).
export function useUnreadCount({ maxAgeMs = UNREAD_COUNT_STALE_MS } = {}) {
  const { count } = useSyncExternalStore(
    unreadCountStore.subscribe,
    unreadCountStore.getSnapshot
  );

  useEffect(() => {
    unreadCountStore
      .ensureFresh({ maxAgeMs })
      .catch((err) => console.error(err));
  }, [maxAgeMs]);

  return count ?? 0;
}
