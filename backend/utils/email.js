// The one normalisation every email-keyed code path uses: surrounding
// whitespace removed and lower-cased. The auth routes look accounts up by this
// exact form (users.email is stored lower-case), and the account-scoped rate
// limiters key by it, so "  Student@College.EDU " and "student@college.edu"
// are the same account everywhere -- neither the lookup nor a limiter can be
// sidestepped by varying case or padding.
//
// Returns null for anything that is not a string, so callers never throw on a
// malformed body (a number, null, array or object).
export function normalizeEmail(value) {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim().toLowerCase();
}
