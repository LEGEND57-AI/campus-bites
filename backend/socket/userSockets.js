import { getIO } from "./index.js";
import { getUserRoom } from "./rooms.js";
import logger from "../utils/logger.js";

// Disconnecting a user's live Socket.IO connections when all of their sessions
// are revoked (logout-all, refresh-token reuse detection, password reset).
//
// No separate userId -> sockets map is kept: every authenticated socket
// already joins the room "user:<id>" (rooms.js) with the id from the
// server-verified token (auth.js), and the Socket.IO adapter adds and removes
// room members as sockets connect and disconnect. That room IS the mapping --
// every tab and device of the user, and only that user. It lives in this
// process's memory, so a restart simply starts empty, like the connections.
//
// disconnectSockets(true) closes the underlying connections. The client sees
// the "io server disconnect" reason, after which socket.io-client does not
// reconnect by itself.
//
// A handshake can be in flight while the sweep runs: the token was checked
// (auth.js looks the user up in the DB) but the socket has not joined its room
// yet, so the sweep cannot see it. The sweep time is therefore remembered for
// a short while, and events.js disconnects a socket whose handshake began at
// or before its user's latest sweep. A connection whose handshake starts after
// the sweep is authenticated exactly as before.

const IN_FLIGHT_HANDSHAKE_WINDOW_MS = 60 * 1000;

const lastSweepAt = new Map(); // userId -> ms of the latest sweep (short-lived)

// Disconnects every socket in the user's room. Returns how many were
// connected. Never throws: session revocation has already succeeded when this
// runs, and a socket problem must not turn that into a failed request.
export function disconnectUserSockets(userId) {
  if (userId === undefined || userId === null || userId === "") {
    return 0;
  }

  const id = String(userId);

  try {
    const io = getIO();
    const sweptAt = Date.now();

    lastSweepAt.set(id, sweptAt);
    setTimeout(() => {
      if (lastSweepAt.get(id) === sweptAt) {
        lastSweepAt.delete(id);
      }
    }, IN_FLIGHT_HANDSHAKE_WINDOW_MS).unref();

    const room = getUserRoom(id);
    const connected = io.sockets.adapter.rooms.get(room)?.size ?? 0;

    io.in(room).disconnectSockets(true);

    logger.info(
      { userId: id, sockets: connected },
      "session revocation: disconnected the user's sockets"
    );

    return connected;
  } catch (err) {
    // getIO() throws only when Socket.IO was never initialised (scripts,
    // tests without a socket server): there is nothing to disconnect.
    logger.warn(
      { userId: id, err: err?.message },
      "session revocation: socket disconnect skipped"
    );
    return 0;
  }
}

// True when this socket's handshake began at or before the latest sweep of
// its user -- it authenticated against sessions that have since been revoked.
export function handshakePredatesSweep(socket) {
  const sweptAt = lastSweepAt.get(String(socket.user?.id));
  const issued = socket.handshake?.issued;

  return sweptAt !== undefined && Number.isFinite(issued) && issued <= sweptAt;
}
