import logger from "../utils/logger.js";
import { getUserRolesByIds } from "../utils/auth.js";
import { getAdminRoom } from "./rooms.js";

// How often an already-connected admin socket's room membership is
// re-confirmed against the database.
//
// joinAdminRoom() (rooms.js) only ever runs once, at the connection
// handshake. A role change afterward (e.g. an admin demoted to student)
// would otherwise leave that socket in the admin room -- and receiving
// admin-only broadcasts -- for the entire remaining lifetime of the
// connection. Socket.IO keeps a WebSocket alive independently of the JWT
// used to authenticate it, so that lifetime is not bounded by the access
// token's own expiry; this interval is what actually bounds it.
export const ADMIN_ROLE_RECHECK_INTERVAL_MS = 5 * 60 * 1000;

// Re-confirms, from the database, that every socket currently in the admin
// room still belongs to an admin user, and removes any that no longer do.
//
// - Only ever calls socket.leave() on the admin room, never
//   socket.disconnect() -- losing admin broadcasts is the only privilege
//   that needs revoking here; the connection itself and every other room
//   it holds (its own user room) are unaffected.
// - Only ever shrinks membership, never grows it: a role upgrade still
//   requires a fresh connection (a fresh handshake -> a fresh
//   joinAdminRoom() call), exactly as today. This function never adds a
//   socket to the admin room.
// - Uses getUserRolesByIds(), a fresh DB read, never the cached
//   socket.user.role captured at connection time or any JWT claim.
export async function recheckAdminRoomMemberships(io) {
  const adminSockets = [];

  for (const socket of io.sockets.sockets.values()) {
    if (socket.rooms.has(getAdminRoom())) {
      adminSockets.push(socket);
    }
  }

  if (adminSockets.length === 0) {
    return;
  }

  let currentRoles;

  try {
    currentRoles = await getUserRolesByIds(
      adminSockets.map((socket) => socket.user.id)
    );
  } catch (err) {
    // A transient DB failure must never be read as "nobody is admin
    // anymore" -- that would mass-evict every currently-legitimate admin
    // socket on a single hiccup. Leave every membership exactly as it is
    // and let the next interval try again.
    logger.error(
      { err },
      "admin room role recheck: role lookup failed, leaving memberships unchanged"
    );
    return;
  }

  for (const socket of adminSockets) {
    const currentRole = currentRoles.get(socket.user.id);

    if (currentRole !== "admin") {
      socket.leave(getAdminRoom());

      logger.info(
        {
          userId: socket.user.id,
          socketId: socket.id,
          currentRole: currentRole ?? null,
        },
        "admin room role recheck: removed socket from admin room, role no longer admin"
      );
    }
  }
}

// Starts the periodic recheck and returns the interval handle.
//
// unref()'d so this timer alone can never keep the Node process alive --
// it simply stops firing once the process has no other reason to stay up.
// That is the standard way to make a long-lived interval cleanup-safe
// without an explicit shutdown hook, which this codebase does not
// otherwise have for the socket layer.
export function startAdminRoleRecheckInterval(io) {
  const handle = setInterval(() => {
    recheckAdminRoomMemberships(io).catch((err) => {
      logger.error({ err }, "admin room role recheck: unexpected failure");
    });
  }, ADMIN_ROLE_RECHECK_INTERVAL_MS);

  handle.unref();

  return handle;
}
