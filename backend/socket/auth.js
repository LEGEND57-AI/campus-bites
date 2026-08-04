import { getUserFromToken } from "../utils/auth.js";

export async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const user = await getUserFromToken(token);

    socket.user = user;

    next();

  } catch (err) {
    next(new Error("Invalid or expired token"));
  }
}