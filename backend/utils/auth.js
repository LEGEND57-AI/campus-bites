import { supabase } from "../db.js";
import { verifyToken } from "./jwt.js";

// ================= AUTHENTICATED USER LOOKUP =================
//
// Every authenticated request (and socket handshake) verifies the access token
// and then reads the user row: that read is what rejects a deleted user and
// gives isAdmin the CURRENT role rather than the one in the token. It was also
// one extra database round trip on every API call.
//
// Two savings, neither of which weakens those checks:
//
// - Concurrent lookups for the same user share one query. A page load fires
//   several requests at once (Home sends five in parallel); they now cost one
//   lookup instead of five. Shared only while the query is in flight, so the
//   answer is exactly as fresh as before -- for admins too.
//
// - Non-admin users are remembered for USER_CACHE_TTL_MS, keyed by the user id
//   from a token whose signature and expiry were just verified (the token is
//   always verified; only the row read is skipped). An admin is never served
//   from this cache, so a cached entry can only ever carry a non-admin role:
//   it can never grant admin rights, and an admin who is demoted loses access
//   on their very next request, exactly as before. The staleness it allows is
//   bounded and in the safe direction: a student promoted to admin waits up to
//   the TTL for admin access, and a student row deleted directly in the
//   database stays usable for at most the TTL (the application itself has no
//   code path that changes roles or deletes users).
//
// Session revocation is unaffected: access tokens carry no session id, so
// logout / logout-all / password reset have never ended an access token early
// -- they revoke refresh sessions, which this does not touch.
const USER_CACHE_TTL_MS = 30_000;
const USER_CACHE_MAX_ENTRIES = 10_000;

const cachedUsers = new Map(); // userId -> { user, expiresAt }
const pendingLookups = new Map(); // userId -> { promise, stale }

const lookupUser = async (userId) => {
  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, name, phone, role")
    .eq("id", userId)
    .single();

  if (error || !user) {
    throw new Error("Invalid token");
  }

  return user;
};

export async function getUserFromToken(token) {
  const decoded = verifyToken(token);
  const userId = decoded?.userId;

  if (typeof userId !== "string" || !userId) {
    throw new Error("Invalid token");
  }

  const cached = cachedUsers.get(userId);

  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return { ...cached.user };
    }
    cachedUsers.delete(userId);
  }

  let flight = pendingLookups.get(userId);

  if (!flight) {
    flight = { stale: false };
    flight.promise = lookupUser(userId).finally(() => {
      // Only unregister this lookup -- an invalidation may already have
      // replaced it with a newer one for the same user.
      if (pendingLookups.get(userId) === flight) {
        pendingLookups.delete(userId);
      }
    });
    pendingLookups.set(userId, flight);
  }

  const user = await flight.promise;

  // A lookup that started before invalidateCachedUser() ran may have read the
  // row as it was before the change, so it never populates the cache.
  if (user.role !== "admin" && !flight.stale) {
    if (cachedUsers.size >= USER_CACHE_MAX_ENTRIES) {
      cachedUsers.delete(cachedUsers.keys().next().value);
    }
    cachedUsers.set(userId, {
      user: { ...user },
      expiresAt: Date.now() + USER_CACHE_TTL_MS,
    });
  }

  return { ...user };
}

// Drop a remembered user (their row just changed). A lookup still in flight
// may have read the old row: it is marked stale, so it cannot re-populate the
// cache when it finishes, and unregistered, so requests from now on start a
// fresh lookup instead of joining it.
export function invalidateCachedUser(userId) {
  if (userId !== undefined && userId !== null) {
    const id = String(userId);
    cachedUsers.delete(id);

    const flight = pendingLookups.get(id);
    if (flight) {
      flight.stale = true;
      pendingLookups.delete(id);
    }
  }
}

/**
 * Fresh, DB-only role lookup for a batch of user ids -- deliberately
 * separate from getUserFromToken, which also verifies a JWT. Callers that
 * already know which users they mean (e.g. re-checking already-connected
 * sockets) have no token to verify and only need the current role.
 *
 * Batched rather than one query per id so re-checking many connected
 * sockets costs one query, not one per socket.
 *
 * Returns a Map of id -> role. An id with no matching row (e.g. a deleted
 * user) is simply absent from the map; callers should treat "absent" the
 * same as "not admin".
 */
export async function getUserRolesByIds(userIds) {
  const uniqueIds = [...new Set(userIds)];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data: users, error } = await supabase
    .from("users")
    .select("id, role")
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(users.map((user) => [user.id, user.role]));
}