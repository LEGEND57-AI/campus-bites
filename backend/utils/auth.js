import { supabase } from "../db.js";
import { verifyToken } from "./jwt.js";

export async function getUserFromToken(token) {
  const decoded = verifyToken(token);

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, name, phone, role")
    .eq("id", decoded.userId)
    .single();

  if (error || !user) {
    throw new Error("Invalid token");
  }

  return user;
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