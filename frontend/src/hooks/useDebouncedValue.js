import { useEffect, useState } from "react";

// The value, delayed until it has stopped changing for `delayMs`. Used for
// server-side search: one request per pause in typing, not per keystroke.
export const SEARCH_DEBOUNCE_MS = 300;

export function useDebouncedValue(value, delayMs = SEARCH_DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
