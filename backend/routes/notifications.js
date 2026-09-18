import express from "express";
import { authenticate } from "../middleware/auth.js";

import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    clearReadNotifications,
    deleteNotification,
} from "../utils/notificationService.js";

const router = express.Router();

// Same pagination bounds as routes/history.js and routes/orders.js, with the
// smaller default this endpoint has always used.
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

// All notification routes require authentication
router.use(authenticate);

// Optional `upTo` cutoff for the bulk actions: an ISO timestamp (the newest
// notification the client has seen). Returns undefined when absent, null when
// present but invalid. The target user always comes from the session, never
// from the request.
// The validated original string is passed through (as a bound value), so the
// database's microsecond precision is kept: re-serialising through Date would
// truncate to milliseconds and exclude the newest notification itself.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

const parseUpTo = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" || value.length > 64) return null;
    if (!ISO_TIMESTAMP.test(value) || Number.isNaN(Date.parse(value))) return null;

    return value;
};

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

        const { notification, unreadCount } = await markAsRead(
            req.params.id,
            req.user.id
        );

        res.json({
            success: true,
            notification,
            unreadCount,
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
 * Mark all of the current user's unread notifications as read.
 * Body (optional): { upTo: ISO timestamp } — only those created at or before it.
 */
router.put("/read-all", async (req, res) => {
    const upTo = parseUpTo(req.body?.upTo);

    if (upTo === null) {
        return res.status(400).json({ error: "Invalid upTo timestamp" });
    }

    try {

        const { updated, unreadCount } = await markAllAsRead(req.user.id, { upTo });

        res.json({
            success: true,
            message: "All notifications marked as read.",
            updated,
            unreadCount,
        });

    } catch (error) {

        console.error("Read All Error:", error);

        res.status(500).json({
            error: "Failed to mark all notifications as read",
        });

    }
});

/**
 * DELETE /api/notifications
 * Clear all of the current user's READ notifications (soft delete, like the
 * single delete below). Unread notifications are kept.
 * Query (optional): ?upTo=ISO timestamp — only those created at or before it.
 */
router.delete("/", async (req, res) => {
    const upTo = parseUpTo(req.query?.upTo);

    if (upTo === null) {
        return res.status(400).json({ error: "Invalid upTo timestamp" });
    }

    try {

        const { cleared, unreadCount } = await clearReadNotifications(req.user.id, { upTo });

        res.json({
            success: true,
            message: "Notifications cleared.",
            cleared,
            unreadCount,
        });

    } catch (error) {

        console.error("Clear Notifications Error:", error);

        res.status(500).json({
            error: "Failed to clear notifications",
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