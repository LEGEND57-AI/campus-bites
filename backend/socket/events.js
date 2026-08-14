import { joinUserRoom, joinAdminRoom } from "./rooms.js";

export function registerSocketEvents(io) {
    io.on("connection", async (socket) => {
        // Identified by user id, not name. This fires on every connection,
        // so logging the student's real name accumulated PII continuously
        // for no diagnostic value the id does not already provide.
        console.log(
            `🟢 user ${socket.user.id} (${socket.user.role}) connected - ${socket.id}`
        );

        await joinUserRoom(socket);
        await joinAdminRoom(socket);

        socket.on("disconnect", (reason) => {
            console.log(
                `🔴 user ${socket.user?.id || "unknown"} disconnected (${reason})`
            );
            console.log(`Reason: ${reason}`);
        });
    });
}