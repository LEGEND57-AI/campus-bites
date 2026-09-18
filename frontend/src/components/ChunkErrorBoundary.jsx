import React from "react";

// Route components are loaded on demand (see App.jsx). A dynamic import can
// fail for reasons that have nothing to do with the component itself -- most
// commonly a tab that was left open across a deploy and is now asking for a
// hashed filename that no longer exists, or a transient network drop.
//
// Without a boundary React.lazy propagates that rejection to the root and the
// page goes blank. This boundary exists purely to turn that one failure mode
// into something recoverable.
//
// Matched conservatively: only the messages browsers and bundlers actually
// produce for a failed module/chunk fetch. Anything else is deliberately not
// treated as a chunk problem.
const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk/i,
];

// Anything can be thrown, not just Error objects. Classifying the caught value
// must never throw itself: an exception here would replace (and hide) the
// original error. String() throws for objects that have no primitive form --
// e.g. null-prototype objects or module namespaces -- and a property read can
// throw on exotic objects such as revoked proxies.
function readProperty(value, key) {
  try {
    return value[key];
  } catch {
    return undefined;
  }
}

function toSafeText(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  try {
    return String(value);
  } catch {
    return "";
  }
}

function isChunkLoadError(error) {
  if (error === null || error === undefined) {
    return false;
  }

  if (typeof error === "string") {
    return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(error));
  }

  if (typeof error !== "object" && typeof error !== "function") {
    return false;
  }

  if (toSafeText(readProperty(error, "name")) === "ChunkLoadError") {
    return true;
  }

  const message = toSafeText(readProperty(error, "message"));

  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    // hasError, not the caught value, marks the failure: null / undefined /
    // other falsy values can be thrown too.
    this.state = { hasError: false, error: null };

    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Logged for both kinds so a chunk failure is still visible in the
    // console, exactly as an uncaught error would have been before.
    console.error("ChunkErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    const { hasError, error } = this.state;

    if (hasError) {
      // Not a chunk-loading problem. Rethrow so the error keeps behaving
      // exactly as it did before this boundary existed rather than being
      // silently absorbed here -- this boundary must not become a catch-all
      // for ordinary application bugs.
      if (!isChunkLoadError(error)) {
        throw error;
      }

      return (
        <div className="min-h-screen bg-[#F3F6FB] flex items-center justify-center p-5">
          <div className="bg-white rounded-[32px] shadow-[0_15px_40px_rgba(0,0,0,0.08)] p-10 text-center max-w-md w-full">
            <h2 className="text-2xl font-bold text-slate-900">
              Update available
            </h2>

            <p className="mt-3 text-slate-500 leading-7">
              This page couldn&apos;t finish loading, usually because a newer
              version of CampusCraves has been released. Reloading will pick it
              up.
            </p>

            <button
              onClick={this.handleReload}
              className="
                mt-8
                w-full
                h-12
                rounded-2xl
                bg-gradient-to-r
                from-blue-600
                to-cyan-500
                text-white
                font-semibold
                hover:scale-[1.02]
                transition
              "
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChunkErrorBoundary;
