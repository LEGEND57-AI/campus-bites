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

  return socket;
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