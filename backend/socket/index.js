import { Server } from "socket.io";
import { registerSocketEvents } from "./events.js";
import { authenticateSocket } from "./auth.js";
import { getAllowedOrigins } from "../utils/allowedOrigins.js";
import { startAdminRoleRecheckInterval } from "./adminRoleRecheck.js";


let io = null;

export function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      // Previously `process.env.CORS_ORIGINS.split(",")`, which threw a
      // TypeError when the variable was absent. initializeSocket() runs
      // before the HTTP server ever listens, so that crash took down the
      // whole process at startup rather than degrading one feature.
      origin: getAllowedOrigins(),
      credentials: true,
    },

    transports: ["websocket"],

    pingTimeout: 60000,

    pingInterval: 25000,

    serveClient: false,
  });

  io.use(authenticateSocket);

  registerSocketEvents(io);

  startAdminRoleRecheckInterval(io);

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error("Socket.IO is not initialized.");
  }

  return io;
}