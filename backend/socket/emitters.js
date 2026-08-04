import { getIO } from "./index.js";
import { SocketEvents } from "./constants.js";
import { getUserRoom, getAdminRoom } from "./rooms.js";

/**
 * Send live order update to a single student
 */
export function emitOrderUpdate(userId, order) {
    const io = getIO();

    io.to(getUserRoom(userId)).emit(
        SocketEvents.ORDER_UPDATED,
        order
    );
}

/**
 * Notify all admins that orders changed
 */
export function emitAdminOrderUpdate(order) {
    const io = getIO();

    io.to(getAdminRoom()).emit(
        SocketEvents.ORDER_UPDATED,
        order
    );
}


/**
 * Send live notification to a single student
 */
export function emitNotification(userId, notification) {
    const io = getIO();

    io.to(getUserRoom(userId)).emit(
        SocketEvents.NOTIFICATION_NEW,
        notification
    );
}

export function emitAnalyticsUpdate() {
    const io = getIO();

    io.to(getAdminRoom()).emit(
        SocketEvents.ANALYTICS_UPDATED
    );
}

/**
 * Notify all students that menu has changed
 */
export function emitMenuUpdate() {

    const io = getIO();

    io.emit(SocketEvents.MENU_UPDATED);

}