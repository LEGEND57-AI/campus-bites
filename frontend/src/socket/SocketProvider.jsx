import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  connectSocket,
  disconnectSocket,
} from "./socket";
import { SocketEvents } from "./constants";
import { unreadCountStore } from "../notifications/useUnreadCount";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user || !token) {
      disconnectSocket();
      setSocket(null);
      return;
    }

    const socketInstance = connectSocket(token);
    socketInstance.connect();
    setSocket(socketInstance);

    return () => {
      disconnectSocket();
    };
  }, [user, token]);

  // The shared unread-count store (notifications/useUnreadCount.js) belongs to
  // the signed-in user. It is fed from here -- the one component that is always
  // mounted while signed in -- so realtime changes are applied exactly once and
  // are not lost while pages (and their headers) mount and unmount.
  const userId = user && token ? user.id : null;
  const everConnectedRef = useRef(false);

  useEffect(() => {
    everConnectedRef.current = false;
    unreadCountStore.setUser(userId);
  }, [userId]);

  useEffect(() => {
    if (!socket) return;

    const handleNew = (notification) => {
      unreadCountStore.applyNewNotification(notification);
    };

    // Read / cleared (from this tab or another tab/device of the same user):
    // the server sends the fresh unread count.
    const handleCountSync = (payload) => {
      unreadCountStore.applyServerCount(payload?.unreadCount);
    };

    // Events emitted while disconnected (or while a socket was being replaced
    // after a token refresh) are never replayed, so any connection after the
    // first makes the next read go to the server.
    const handleConnect = () => {
      if (everConnectedRef.current) {
        unreadCountStore.invalidate();
      }
      everConnectedRef.current = true;
    };

    if (socket.connected) handleConnect();

    socket.on(SocketEvents.NOTIFICATION_NEW, handleNew);
    socket.on(SocketEvents.NOTIFICATION_READ, handleCountSync);
    socket.on(SocketEvents.NOTIFICATION_CLEARED, handleCountSync);
    socket.on(SocketEvents.CONNECT, handleConnect);

    return () => {
      socket.off(SocketEvents.NOTIFICATION_NEW, handleNew);
      socket.off(SocketEvents.NOTIFICATION_READ, handleCountSync);
      socket.off(SocketEvents.NOTIFICATION_CLEARED, handleCountSync);
      socket.off(SocketEvents.CONNECT, handleConnect);
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
