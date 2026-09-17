import { io } from "socket.io-client";
import { getAccessToken, userAPI } from "../services/api";

let socket = null;

// Handshake rejections the server's socket auth middleware produces
// (backend/socket/auth.js).
const AUTH_ERROR_MESSAGES = ["Authentication required", "Invalid or expired token"];
const AUTH_RECOVERY_COOLDOWN_MS = 30000;
let lastAuthRecoveryAt = 0;

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
    // Unlimited: with a fixed attempt count, any outage longer than the
    // backoff window (a server restart or deploy, a laptop waking from
    // sleep) left the socket permanently disconnected until a page reload.
    // socket.io still caps the delay between attempts.
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  // Defensive fallback: socket.io's own reconnection logic replays the
  // `auth` object exactly as it was when the socket was created. If the
  // access token has since rotated (see api.js's refresh interceptor),
  // a reconnect triggered by a network drop -- not by React re-rendering
  // SocketProvider -- would otherwise keep retrying with the stale,
  // expired token and eventually give up entirely.
  socket.io.on("reconnect_attempt", () => {
    socket.auth.token = getAccessToken();
  });

  // The in-memory access token is only refreshed when an HTTP request gets a
  // 401, so a page left idle past the token's lifetime reconnects with an
  // expired one. The server rejects that handshake, and socket.io does not
  // retry a rejection from server middleware, so realtime would stay dead
  // until a reload.
  //
  // Recover through one authenticated request rather than calling the
  // refresh endpoint directly: an expired token gets a 401, and api.js's
  // interceptor then refreshes it through its own single, queued refresh
  // (a second uncoordinated refresh with the same cookie would be rejected
  // by the backend's rotation). setAccessToken() broadcasts the new token
  // and SocketProvider rebuilds the socket with it. The cooldown stops a
  // handshake the server keeps rejecting from looping requests.
  socket.on("connect_error", (err) => {
    if (!AUTH_ERROR_MESSAGES.includes(err?.message)) return;

    const now = Date.now();
    if (now - lastAuthRecoveryAt < AUTH_RECOVERY_COOLDOWN_MS) return;
    lastAuthRecoveryAt = now;

    userAPI.getProfile().catch(() => {
      // A failed refresh is already handled by the interceptor (logout).
    });
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