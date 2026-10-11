import React from "react";

/**
 * The outermost error boundary, mounted in main.jsx above every provider.
 *
 * ChunkErrorBoundary (inside App) still owns chunk-loading failures and is
 * deliberately untouched: it keeps its own "Update available" recovery screen
 * and still rethrows anything that is not a chunk problem, because it must not
 * become a catch-all for ordinary application bugs. This boundary is where that
 * rethrow now lands.
 *
 * Before it existed, an ordinary render exception propagated to the root and
 * React unmounted the whole tree -- a confirmed blank page (#root with zero
 * children) was reachable from nothing worse than an API returning 200 with an
 * unexpected shape.
 *
 * Being the last line of defence constrains how this is written:
 *
 *  - It renders no application component, reads no context, and calls no API.
 *    Whatever broke the tree below must not be able to break the fallback too.
 *  - Styling is inline rather than Tailwind classes, so the screen is still
 *    correct if the stylesheet is the thing that failed to load.
 *  - The brand mark is an inline SVG, not the imported PNG, so nothing has to
 *    be fetched to render this.
 *  - Reload is a plain window.location.reload(), not router navigation: the
 *    router is part of the tree that just failed.
 *
 * Nothing about the caught error reaches the screen -- no message, no stack, no
 * backend detail. It goes to the console only, which is where the previous
 * uncaught-error behaviour already put it.
 */
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    // hasError rather than the caught value: null, undefined and other falsy
    // values can be thrown too.
    this.state = { hasError: false };

    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // The one intentional diagnostic. Same information an uncaught error would
    // have printed before this boundary existed.
    console.error("AppErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          boxSizing: "border-box",
          background: "#F8FAFC",
          fontFamily:
            'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            boxSizing: "border-box",
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "24px",
            padding: "32px 28px",
            textAlign: "center",
            boxShadow: "0 8px 24px -4px rgba(15, 23, 42, 0.10)",
          }}
        >
          <svg
            width="44"
            height="44"
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden="true"
            style={{ display: "block", margin: "0 auto 18px" }}
          >
            <path
              d="M30 11.5A12 12 0 1 0 30 28.5"
              stroke="#2563EB"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <circle cx="31.5" cy="14" r="2.6" fill="#3B82F6" />
            <circle cx="34.5" cy="20" r="1.9" fill="#60A5FA" />
            <circle cx="31" cy="25.5" r="1.4" fill="#93C5FD" />
          </svg>

          <h1
            style={{
              margin: 0,
              fontSize: "22px",
              lineHeight: 1.25,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#0F172A",
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              fontSize: "15px",
              lineHeight: 1.6,
              color: "#64748B",
            }}
          >
            CampusCraves ran into an unexpected problem on this page. Reloading
            usually fixes it.
          </p>

          <button
            type="button"
            onClick={this.handleReload}
            style={{
              marginTop: "24px",
              width: "100%",
              height: "48px",
              border: 0,
              borderRadius: "12px",
              background: "#2563EB",
              color: "#FFFFFF",
              fontSize: "16px",
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
