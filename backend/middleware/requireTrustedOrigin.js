import logger from "../utils/logger.js";
import { getAllowedOrigins } from "../utils/allowedOrigins.js";

// Explicit CSRF defense for the only two cookie-authenticated endpoints.
//
// Every other authenticated route in this app takes its identity from the
// Authorization header (see middleware/auth.js) with no cookie fallback, so a
// cross-site attacker cannot authenticate to them without a CORS preflight
// that fails — those routes are structurally outside CSRF scope.
// POST /session/refresh and POST /session/logout are the exceptions: they
// authenticate purely from the httpOnly refreshToken cookie, and production
// must use SameSite=None (frontend and backend are separate HTTPS origins),
// so SameSite provides no CSRF protection for them.
//
// The global CORS origin callback in server.js already rejects unknown
// origins before any handler runs, but that is an incidental side effect of
// CORS configuration rather than a stated CSRF control — nothing at the route
// says so, and a future CORS change could silently remove it. This middleware
// makes the guarantee explicit and testable at the two routes that actually
// depend on it.
//
// It is deliberately mounted per-route and never globally, so server-to-server
// callers elsewhere are unaffected — in particular the Razorpay webhook, which
// legitimately sends no Origin header and must keep working.

// Trusted origins come from utils/allowedOrigins.js, the same helper the HTTP
// CORS layer and Socket.IO now use, so all three cannot drift apart. That
// helper reads per call rather than caching at import, which preserves this
// middleware's existing behaviour of always reflecting current configuration.

export function requireTrustedOrigin(req, res, next) {
  const allowedOrigins = getAllowedOrigins();

  const origin = req.headers.origin;

  if (origin) {
    if (allowedOrigins.includes(origin)) {
      return next();
    }

    (req.log || logger).warn(
      { origin, path: req.originalUrl },
      "Rejected cookie-authenticated request from untrusted Origin"
    );

    return res.status(403).json({
      error: "Request origin not allowed.",
    });
  }

  // No Origin header. Fall back to Referer, comparing only its origin
  // component (scheme://host[:port]) and never the raw string, so a crafted
  // value such as https://evil.com/?x=https://trusted.example can never match.
  const referer = req.headers.referer;

  if (referer) {
    let refererOrigin = null;

    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      // Malformed Referer — treat as untrusted rather than guessing.
      refererOrigin = null;
    }

    if (refererOrigin && allowedOrigins.includes(refererOrigin)) {
      return next();
    }

    (req.log || logger).warn(
      { referer, path: req.originalUrl },
      "Rejected cookie-authenticated request from untrusted Referer"
    );

    return res.status(403).json({
      error: "Request origin not allowed.",
    });
  }

  // Neither header identifies a trusted origin, so deny.
  //
  // These two endpoints exist solely to serve the browser frontend's httpOnly
  // cookie flow. In every deployment the frontend is a different origin from
  // this API, which makes a legitimate call cross-origin — and a cross-origin
  // credentialed XHR always carries an Origin header, or CORS itself would
  // fail first. A request presenting neither header is therefore never the
  // intended browser flow.
  (req.log || logger).warn(
    { path: req.originalUrl },
    "Rejected cookie-authenticated request with no Origin or Referer header"
  );

  return res.status(403).json({
    error: "Request origin not allowed.",
  });
}
