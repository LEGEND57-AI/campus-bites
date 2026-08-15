import express from "express";
import { authenticate } from "../middleware/auth.js";

import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
} from "../utils/notificationService.js";

const router = express.Router();

// Same pagination bounds as routes/history.js and routes/orders.js, with the
// smaller default this endpoint has always used.
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

// All notification routes require authentication
router.use(authenticate);

/**
 * GET /api/notifications
 * Get all notifications for logged in user
 */
router.get("/", async (req, res) => {
    try {
        // Clamped rather than trusted. `limit` was unbounded; `page` is
        // clamped for the same reason as in routes/orders.js -- getNotifications
        // computes (page - 1) * limit, so a negative page produced a negative
        // .range() offset. Integer parsing also rejects the floats Number()
        // used to accept, which would have made the offset fractional.
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE, 1),
            MAX_PAGE_SIZE
        );

        const result = await getNotifications(
            req.user.id,
            page,
            limit
        );

        res.json({
            success: true,
            notifications: result.notifications,
            hasMore: result.hasMore,
            total: result.total,
        });


    } catch (error) {

        console.error("Get Notifications Error:", error);

        res.status(500).json({
            error: "Failed to fetch notifications",
        });

    }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get("/unread-count", async (req, res) => {
    try {

        const count = await getUnreadCount(req.user.id);

        res.json({
            success: true,
            count,
        });

    } catch (error) {

        console.error("Unread Count Error:", error);

        res.status(500).json({
            error: "Failed to fetch unread count",
        });

    }
});

/**
 * PUT /api/notifications/:id/read
 * Mark single notification as read
 */
router.put("/:id/read", async (req, res) => {
    try {

        const notification = await markAsRead(
            req.params.id,
            req.user.id
        );

        res.json({
            success: true,
            notification,
        });

    } catch (error) {

        // markAsRead() filters on id AND user_id AND is_deleted, so PGRST116
        // ("no rows" from .single()) means this notification does not exist,
        // is not this user's, or is already deleted. All three are a 404 for
        // this caller -- and answering the same way for all three keeps the
        // response from revealing that someone else's notification exists.
        if (error?.code === "PGRST116") {
            return res.status(404).json({
                error: "Notification not found",
            });
        }

        console.error("Mark Read Error:", error);

        res.status(500).json({
            error: "Failed to mark notification as read",
        });

    }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put("/read-all", async (req, res) => {
    try {

        await markAllAsRead(req.user.id);

        res.json({
            success: true,
            message: "All notifications marked as read.",
        });

    } catch (error) {

        console.error("Read All Error:", error);

        res.status(500).json({
            error: "Failed to mark all notifications as read",
        });

    }
});

/**
 * DELETE /api/notifications/:id
 * Soft delete notification
 */
router.delete("/:id", async (req, res) => {
    try {

        await deleteNotification(
            req.params.id,
            req.user.id
        );

        res.json({
            success: true,
            message: "Notification deleted successfully.",
        });

    } catch (error) {

        console.error("Delete Notification Error:", error);

        res.status(500).json({
            error: "Failed to delete notification",
        });

    }
});

export default router;