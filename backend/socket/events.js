import { joinUserRoom, joinAdminRoom } from "./rooms.js";

export function registerSocketEvents(io) {
    io.on("connection", async (socket) => {
        console.log(
            `🟢 ${socket.user.name} (${socket.user.role}) connected - ${socket.id}`
        );

        await joinUserRoom(socket);
        await joinAdminRoom(socket);

        socket.on("disconnect", (reason) => {
            console.log(
                `🔴 ${socket.user?.name || "Unknown"} disconnected (${reason})`
            );
            console.log(`Reason: ${reason}`);
        });
    });
}