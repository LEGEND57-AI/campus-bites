import { useCallback, useEffect, useRef } from "react";

// Stale-response protection for requests whose inputs change (search, filters).
//
//   const { begin, cancel } = useLatestRequest();
//   const request = begin();                 // aborts the previous request
//   const res = await api.get(url, { signal: request.signal });
//   if (!request.isLatest()) return;         // superseded: ignore
//
// Two guards, because either alone is not enough:
//   - AbortController cancels the superseded HTTP request, so the browser and
//     server stop working on it;
//   - the sequence check ignores any response that still completes after a
//     newer request began (e.g. it had already arrived when abort() ran).
// So "Har" -> "Harsh" -> "Harshil" can only ever display "Harshil".
//
// cancel() aborts whatever is in flight without starting anything (e.g. when
// the inputs change before the next request starts). Everything is aborted on
// unmount.
export function useLatestRequest() {
  const stateRef = useRef({ controller: null, seq: 0 });

  const cancel = useCallback(() => {
    const state = stateRef.current;
    state.seq += 1;
    state.controller?.abort();
    state.controller = null;
  }, []);

  const begin = useCallback(() => {
    const state = stateRef.current;
    state.controller?.abort();

    const controller = new AbortController();
    const seq = ++state.seq;
    state.controller = controller;

    return {
      signal: controller.signal,
      isLatest: () => stateRef.current.seq === seq && !controller.signal.aborted,
    };
  }, []);

  useEffect(() => cancel, [cancel]);

  return { begin, cancel };
}

// True for an axios/fetch error caused by AbortController.abort().
export const isAbortError = (err) =>
  err?.code === "ERR_CANCELED" ||
  err?.name === "CanceledError" ||
  err?.name === "AbortError";
