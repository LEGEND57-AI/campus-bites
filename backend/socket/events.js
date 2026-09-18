import { joinUserRoom, joinAdminRoom } from "./rooms.js";
import logger from "../utils/logger.js";

export function registerSocketEvents(io) {
    io.on("connection", async (socket) => {
        // Identified by user id, not name. This fires on every connection
        // (and on every reconnect after a deploy or network blip, for every
        // client at once), so it is debug-level: one structured line instead
        // of an unconditional console write.
        logger.debug(
            { userId: socket.user.id, role: socket.user.role, socketId: socket.id },
            "socket connected"
        );

        await joinUserRoom(socket);
        await joinAdminRoom(socket);

        socket.on("disconnect", (reason) => {
            logger.debug(
                { userId: socket.user?.id || null, socketId: socket.id, reason },
                "socket disconnected"
            );
        });
    });
}