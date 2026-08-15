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

function isChunkLoadError(error) {
  if (!error) {
    return false;
  }

  if (error.name === "ChunkLoadError") {
    return true;
  }

  const message = String(error.message || "");

  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = { error: null };

    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
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
    const { error } = this.state;

    if (error) {
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
