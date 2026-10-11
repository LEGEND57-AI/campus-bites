/**
 * Turns a failed request into one short sentence a student can act on.
 *
 * The rule this exists to enforce: `error.message` is never shown. That string
 * carries backend wording, axios internals and occasionally stack text, none of
 * which belongs on screen. Only the shape of the failure -- a transport code or
 * an HTTP status -- decides what the user reads.
 *
 * `fallback` is the caller's own sentence for "the request was refused and we
 * have nothing more specific to say", so each action can name what it was
 * trying to do.
 */
export function describeError(
  error,
  fallback = "Something went wrong. Please try again."
) {
  // Axios aborts on timeout with no response attached (services/api.js sets a
  // 30s ceiling on every request).
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
    return "That took longer than expected. Please try again.";
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your connection and try again.";
  }

  const status = error?.response?.status;

  // No status at all means the request never reached a reply: DNS, refused
  // connection, CORS, or the network dropping mid-flight.
  if (!status) {
    return "Couldn't reach CampusCraves. Check your connection and try again.";
  }

  if (status === 429) {
    return "Too many attempts just now. Wait a moment and try again.";
  }

  if (status === 401 || status === 403) {
    return "You don't have permission to do that. Try signing in again.";
  }

  if (status === 404) {
    return "That item is no longer available.";
  }

  if (status === 409) {
    return "This changed while you were working. Refresh and try again.";
  }

  if (status === 413) {
    return "That file is too large. Choose a smaller image.";
  }

  if (status >= 500) {
    return "CampusCraves is having trouble right now. Please try again in a moment.";
  }

  return fallback;
}

export default describeError;
