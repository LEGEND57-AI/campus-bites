import { io } from "socket.io-client";

let socket = null;

export function connectSocket(token) {
  if (socket?.connected) {
    return socket;
  }

  socket = io(import.meta.env.VITE_API_URL, {
    transports: ["websocket"],
    autoConnect: false,

    auth: {
      token,
    },

    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Defensive fallback: socket.io's own reconnection logic replays the
  // `auth` object exactly as it was when the socket was created. If the
  // access token has since rotated (see api.js's refresh interceptor),
  // a reconnect triggered by a network drop -- not by React re-rendering
  // SocketProvider -- would otherwise keep retrying with the stale,
  // expired token and eventually give up entirely.
  socket.io.on("reconnect_attempt", () => {
    socket.auth.token = localStorage.getItem("token");
  });

  return socket;
}

export function updateSocketToken(token) {
  if (socket) {
    socket.auth.token = token;
  }
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}