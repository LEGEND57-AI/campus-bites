import { Server } from "socket.io";
import { registerSocketEvents } from "./events.js";
import { authenticateSocket } from "./auth.js";


let io = null;

export function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGINS.split(","),
      credentials: true,
    },

    transports: ["websocket"],

    pingTimeout: 60000,

    pingInterval: 25000,

    serveClient: false,
  });

  io.use(authenticateSocket);

  registerSocketEvents(io);

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error("Socket.IO is not initialized.");
  }

  return io;
}