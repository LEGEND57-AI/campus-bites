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

// All notification routes require authentication
router.use(authenticate);

/**
 * GET /api/notifications
 * Get all notifications for logged in user
 */
router.get("/", async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

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