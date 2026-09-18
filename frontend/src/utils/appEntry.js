import { useEffect, useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// When to show the full-screen branded loader (components/BrandLoader.jsx).
//
// The branded loader marks an app-entry event, not every page load:
//
//   first open      No record for this browser tab yet -> branded loader.
//   refresh         The page recorded "last active" moments ago (pagehide
//                   fires just before the reload) -> no branded loader.
//   re-entry        The tab was inactive for APP_REENTRY_THRESHOLD_MS or
//                   longer, either
//                     - the page is still alive and becomes visible again
//                       (visibilitychange / bfcache pageshow), or
//                     - the browser discarded it and loads it again
//                       (common on phones) -> branded loader.
//
// During an entry event ONE branded loader is presented at the app root
// (AppEntryLoader). It stays until both
//   - ENTRY_LOADER_MIN_MS has passed (one full entrance), and
//   - no full-screen loading state is mounted (session restore, lazy route
//     chunk),
// so a signed-out visitor sees branded loader -> Login, and a signed-in user
// sees branded loader -> app. Outside entry events those loading states show
// the quiet spinner.
//
// The record lives in sessionStorage under its own namespaced key: it is per
// tab, survives a refresh, is gone when the tab is closed, and never touches
// the auth/session data CampusCraves keeps elsewhere. JavaScript cannot see
// every OS/browser process kill; a page that died without firing pagehide is
// treated by the age of its last recorded activity, which is the most
// reliable signal available.
//
// Nothing here polls: the "last active" time is written only when the page
// is hidden or unloaded, timers are one-shot, and listeners are removed on
// unmount.
// ---------------------------------------------------------------------------

// Inactivity that counts as a meaningful return. Conservative on purpose.
export const APP_REENTRY_THRESHOLD_MS = 10 * 60 * 1000;

// Minimum time the branded loader is presented for an entry event
// (one full entrance + settle).
export const ENTRY_LOADER_MIN_MS = 1600;

const LAST_ACTIVE_KEY = "campuscraves:app-entry:last-active-at";

const readLastActive = () => {
  try {
    const value = Number(sessionStorage.getItem(LAST_ACTIVE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

const writeLastActive = (time = Date.now()) => {
  try {
    sessionStorage.setItem(LAST_ACTIVE_KEY, String(time));
  } catch {
    // Storage unavailable (private mode quota etc.): behave as a refresh.
  }
};

/**
 * Classifies a page load from the tab's last recorded activity.
 * @returns {"first-open" | "reentry" | "refresh"}
 */
export function classifyPageLoad(lastActiveAt, now = Date.now(), threshold = APP_REENTRY_THRESHOLD_MS) {
  if (lastActiveAt == null) return "first-open";
  return now - lastActiveAt >= threshold ? "reentry" : "refresh";
}

// ---------------- store ----------------
// `presenting`: an entry event is being presented with the branded loader.

const isBrowser = typeof window !== "undefined";
const loadKind = isBrowser ? classifyPageLoad(readLastActive()) : "refresh";

let state = { presenting: false };
let presentingSince = 0;
let minTimer = null;
let mountedLoaders = 0;

const listeners = new Set();
const setState = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => state;

// Ends the presentation once the minimum time has passed and nothing is
// loading full-screen any more.
const tryEndPresenting = () => {
  if (!state.presenting) return;
  if (Date.now() - presentingSince < ENTRY_LOADER_MIN_MS) return;
  if (mountedLoaders > 0) return;
  setState({ presenting: false });
};

const startPresenting = () => {
  presentingSince = Date.now();
  clearTimeout(minTimer);
  minTimer = setTimeout(tryEndPresenting, ENTRY_LOADER_MIN_MS);
  if (!state.presenting) setState({ presenting: true });
};

if (isBrowser) {
  if (loadKind !== "refresh") startPresenting();
  // The page is active now.
  writeLastActive();
}

// ---------------- full-screen loading states ----------------
// Session restore / lazy route chunks register while mounted, so the entry
// presentation waits for them. A short deferral lets one loading state hand
// over to the next (session restore -> route chunk) without ending early.
export function registerFullScreenLoader() {
  mountedLoaders += 1;
  return () => {
    mountedLoaders -= 1;
    if (mountedLoaders === 0) setTimeout(tryEndPresenting, 0);
  };
}

// ---------------- hooks ----------------

/** Whether an entry event is being presented with the branded loader. */
export function useEntryPresenting() {
  return useSyncExternalStore(subscribe, getSnapshot).presenting;
}

/**
 * Installs the page lifecycle listeners. Use once, at the app root.
 */
export function useAppEntryLifecycle() {
  useEffect(() => {
    let hiddenAt = document.visibilityState === "hidden" ? Date.now() : null;

    const markInactive = () => {
      hiddenAt = Date.now();
      writeLastActive(hiddenAt);
    };

    const markActive = () => {
      const now = Date.now();

      if (hiddenAt != null && now - hiddenAt >= APP_REENTRY_THRESHOLD_MS) {
        startPresenting();
      }

      hiddenAt = null;
      writeLastActive(now);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") markInactive();
      else markActive();
    };

    // bfcache restore: the page was frozen, not reloaded.
    const onPageShow = (event) => {
      if (event.persisted) markActive();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", markInactive);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", markInactive);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
}
