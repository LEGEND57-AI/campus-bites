// Single source of truth for the trusted frontend origins.
//
// Three call sites previously parsed CORS_ORIGINS independently and did not
// agree. The HTTP CORS layer and the Socket.IO layer both skipped trimming,
// so a value written as "a.com, b.com" silently failed to match the second
// origin -- a configuration typo that presents as an unexplained CORS bug.
// The Socket.IO layer additionally had no guard against the variable being
// absent, which threw a TypeError during module evaluation and killed the
// process before it could ever listen. requireTrustedOrigin.js already had
// the correct implementation; this promotes it to a shared helper so the
// three layers cannot drift apart again.
//
// Evaluated on every call rather than cached at import, which preserves
// requireTrustedOrigin.js's existing per-request semantics: the check always
// reflects current configuration rather than whatever was set at boot.
export function getAllowedOrigins() {
  return (process.env.CORS_ORIGINS?.split(",") || [])
    .map((origin) => origin.trim())
    .filter(Boolean);
}
