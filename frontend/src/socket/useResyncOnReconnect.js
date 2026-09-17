import { useEffect, useRef } from "react";
import { SocketEvents } from "./constants";

// Socket.IO never replays events emitted while a client was disconnected, so a
// page that keeps server data in sync from socket events goes stale across a
// reconnect. This calls `resync` exactly once per REconnect so the page can
// re-read its data.
//
// It deliberately does not fire on the page's first connection: the page
// already loads its data on mount, and a refetch there would only duplicate
// that request.
//
// "Reconnect" covers both cases SocketProvider produces: the same socket
// connecting again after a drop, and a replacement socket object (built after
// an access-token refresh) for a page that had already been connected.
export function useResyncOnReconnect(socket, resync) {
  const resyncRef = useRef(resync);
  const hasConnectedRef = useRef(false);
  const lastSocketRef = useRef(null);

  useEffect(() => {
    resyncRef.current = resync;
  });

  useEffect(() => {
    if (!socket) return;

    const isReplacement =
      lastSocketRef.current !== null && lastSocketRef.current !== socket;

    lastSocketRef.current = socket;

    // A replacement socket may finish connecting before this effect attaches
    // its listener, in which case its connect event has already fired.
    if (socket.connected) {
      if (isReplacement && hasConnectedRef.current) {
        resyncRef.current();
      }

      hasConnectedRef.current = true;
    }

    const handleConnect = () => {
      if (hasConnectedRef.current) {
        resyncRef.current();
      }

      hasConnectedRef.current = true;
    };

    socket.on(SocketEvents.CONNECT, handleConnect);

    return () => {
      socket.off(SocketEvents.CONNECT, handleConnect);
    };
  }, [socket]);
}
