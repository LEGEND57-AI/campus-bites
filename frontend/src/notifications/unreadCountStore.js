// One authoritative unread-notification count for the whole app.
//
// Before this, DashboardHeader (rendered by nearly every student page) fetched
// /notifications/unread-count on every mount, so every route change cost a
// request, and the Notifications page fetched it again in parallel for its own
// copy. Both then maintained the number from socket events separately.
//
// Now:
// - Fetches are shared: callers asking while a request is in flight get that
//   request; a count fetched less than `staleMs` ago is reused.
// - Realtime keeps it current between fetches (applied once, in
//   SocketProvider): notification-new adds one per distinct unread
//   notification id; notification-read / notification-cleared carry the
//   server's fresh count, as do the Notifications page's action responses.
// - A fetch that was in flight while a realtime change arrived cannot
//   overwrite that change with its older answer: an authoritative count from
//   the server wins, and an increment triggers one fresh read instead.
//
// Framework-free so it can be tested on its own; see useUnreadCount.js for the
// app instance and hook.
const MAX_REMEMBERED_IDS = 500;

export function createUnreadCountStore({ fetchCount, staleMs = 60_000, now = () => Date.now() }) {
  let snapshot = { count: null, loaded: false };
  let userKey = null;
  let fetchedAt = 0;
  let inFlight = null;
  let generation = 0; // bumped on user change: results for a previous user are dropped
  let version = 0; // bumped on every realtime/authoritative change
  let refetchAfterFlight = false;
  const countedIds = new Set();
  const listeners = new Set();

  const emit = () => listeners.forEach((listener) => listener());

  const setCount = (count) => {
    snapshot = { count, loaded: true };
    emit();
  };

  const load = () => {
    const gen = generation;
    const startVersion = version;
    refetchAfterFlight = false;

    const request = (async () => {
      try {
        const count = await fetchCount();
        if (gen !== generation) return snapshot.count;

        if (version === startVersion) {
          fetchedAt = now();
          setCount(count);
        }

        return snapshot.count;
      } finally {
        if (gen === generation) {
          inFlight = null;

          // An increment arrived while this read was in flight, so its answer
          // may or may not include it; read once more.
          if (refetchAfterFlight && userKey !== null) {
            refetchAfterFlight = false;
            load().catch(() => {});
          }
        }
      }
    })();

    inFlight = request;
    return request;
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot: () => snapshot,

    // The signed-in user (null when signed out). A change drops everything
    // belonging to the previous user.
    setUser(nextUserKey) {
      const key = nextUserKey ?? null;
      if (key === userKey) return;

      userKey = key;
      generation += 1;
      inFlight = null;
      fetchedAt = 0;
      refetchAfterFlight = false;
      countedIds.clear();
      snapshot = { count: null, loaded: false };
      emit();

      if (userKey !== null && listeners.size > 0) {
        load().catch(() => {});
      }
    },

    // Returns the count, fetching only when there is no fresh one. Concurrent
    // callers share a single request.
    ensureFresh({ maxAgeMs = staleMs } = {}) {
      if (userKey === null) return Promise.resolve(snapshot.count);
      if (inFlight) return inFlight;

      if (snapshot.loaded && now() - fetchedAt < maxAgeMs) {
        return Promise.resolve(snapshot.count);
      }

      return load();
    },

    // An authoritative count from the server (read/cleared events, action
    // responses).
    applyServerCount(count) {
      if (!Number.isInteger(count) || count < 0 || userKey === null) return;

      version += 1;
      fetchedAt = now();
      setCount(count);
    },

    // notification-new. Re-deliveries of the same notification are ignored.
    applyNewNotification(notification) {
      if (userKey === null || !notification?.id || notification.is_read) return;
      if (countedIds.has(notification.id)) return;

      countedIds.add(notification.id);
      if (countedIds.size > MAX_REMEMBERED_IDS) {
        countedIds.delete(countedIds.values().next().value);
      }

      version += 1;

      if (inFlight) {
        refetchAfterFlight = true;
      }

      if (snapshot.loaded) {
        setCount(snapshot.count + 1);
      } else if (!inFlight && listeners.size > 0) {
        load().catch(() => {});
      }
    },

    // Realtime may have been missed (socket reconnected): the next read must
    // go to the server; read now if something is showing the count.
    invalidate() {
      fetchedAt = 0;
      if (userKey !== null && listeners.size > 0 && !inFlight) {
        load().catch(() => {});
      }
    },
  };
}
