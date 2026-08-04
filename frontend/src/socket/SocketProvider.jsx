import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  connectSocket,
  disconnectSocket,
} from "./socket";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, token } = useAuth();

  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // User not logged in
    if (!user || !token) {
      disconnectSocket();
      setSocket(null);
      return;
    }

    // Create socket
    const socketInstance = connectSocket(token);

    // Connect manually (autoConnect = false)
    socketInstance.connect();

    setSocket(socketInstance);

    return () => {
      disconnectSocket();
    };
  }, [user, token]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}