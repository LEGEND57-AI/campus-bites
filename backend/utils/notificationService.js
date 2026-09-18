import { supabase } from "../db.js";
import {
    emitNotification,
    emitNotificationsRead,
    emitNotificationsCleared,
} from "../socket/emitters.js";

import { sendPushNotification } from "./pushNotification.js";

/**
 * Create a new notification
 */
const createNotification = async ({
    userId,
    title,
    message,
    type,
    orderId,
    tokenNumber,
    actionUrl,
}) => {

    const { data, error } = await supabase
        .from("notifications")
        .insert({
            user_id: userId,
            title,
            message,
            type,
            order_id: orderId,
            token_number: tokenNumber,
            action_url: actionUrl,
        })
        .select()
        .single();

    if (error) throw error;

    // 🔔 Real-time Socket Notification
    emitNotification(userId, data);

    // 📱 Web Push Notification
    // Do not block the order API response.
    sendPushNotification(
        userId,
        title,
        message,
        {
            orderId,
            actionUrl,
            tokenNumber,
        }
    ).catch((error) => {
        console.error(
            "Push notification failed:",
            error?.message || error
        );
    });

    return data;
};

/**
 * Get all notifications for a user
 */
const getNotifications = async (
    userId,
    page = 1,
    limit = 10
) => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .eq("is_deleted", false)
        .order("created_at", {
            ascending: false,
        })
        .range(from, to);

    if (error) throw error;

    return {
        notifications: data,
        hasMore: to + 1 < count,
        total: count,
    };
};

/**
 * Get unread notification count
 */
const getUnreadCount = async (userId) => {
    const { count, error } = await supabase
        .from("notifications")
        .select("*", {
            count: "exact",
            head: true,
        })
        .eq("user_id", userId)
        .eq("is_read", false)
        .eq("is_deleted", false);

    if (error) throw error;

    return count || 0;
};

/**
 * Mark a notification as read
 */
const markAsRead = async (notificationId, userId) => {
    const { data, error } = await supabase
        .from("notifications")
        .update({
            is_read: true,
        })
        .eq("id", notificationId)
        .eq("user_id", userId)
        .eq("is_deleted", false)
        .select()
        .single();

    if (error) throw error;

    const unreadCount = await getUnreadCount(userId);

    emitNotificationsRead(userId, { scope: "ids", ids: [data.id], unreadCount });

    return { notification: data, unreadCount };
};

/**
 * Mark all notifications as read.
 *
 * One conditional UPDATE, scoped to the user and to rows that are still
 * unread, so it is atomic and idempotent (a second click updates nothing).
 *
 * `upTo` (optional ISO timestamp) limits it to notifications created at or
 * before the newest one the user has seen, so a notification that arrives
 * while the request is in flight stays unread.
 *
 * Returns the number of rows changed and the user's fresh unread count, and
 * tells the user's other tabs/devices.
 */
const markAllAsRead = async (userId, { upTo } = {}) => {
    let query = supabase
        .from("notifications")
        .update({
            is_read: true,
        })
        .eq("user_id", userId)
        .eq("is_read", false)
        .eq("is_deleted", false);

    if (upTo) query = query.lte("created_at", upTo);

    const { data, error } = await query.select("id");

    if (error) throw error;

    const unreadCount = await getUnreadCount(userId);
    const updated = data?.length || 0;

    emitNotificationsRead(userId, { scope: "all", upTo: upTo || null, unreadCount });

    return { updated, unreadCount };
};

/**
 * Clear (soft delete) all of the user's READ notifications, the same way a
 * single notification is deleted. Unread notifications are never cleared, so
 * one that arrives while the request is in flight survives.
 *
 * `upTo` (optional ISO timestamp) additionally limits it to notifications
 * created at or before the newest one the user has seen.
 *
 * Atomic and idempotent: one conditional UPDATE scoped to the user.
 */
const clearReadNotifications = async (userId, { upTo } = {}) => {
    let query = supabase
        .from("notifications")
        .update({
            is_deleted: true,
        })
        .eq("user_id", userId)
        .eq("is_read", true)
        .eq("is_deleted", false);

    if (upTo) query = query.lte("created_at", upTo);

    const { data, error } = await query.select("id");

    if (error) throw error;

    const unreadCount = await getUnreadCount(userId);
    const cleared = data?.length || 0;

    emitNotificationsCleared(userId, { scope: "read", upTo: upTo || null, unreadCount });

    return { cleared, unreadCount };
};

/**
 * Soft delete a notification
 */
const deleteNotification = async (notificationId, userId) => {
    const { data, error } = await supabase
        .from("notifications")
        .update({
            is_deleted: true,
        })
        .eq("id", notificationId)
        .eq("user_id", userId)
        .eq("is_deleted", false)
        .select("id");

    if (error) throw error;

    if (data?.length) {
        const unreadCount = await getUnreadCount(userId);
        emitNotificationsCleared(userId, { scope: "ids", ids: [notificationId], unreadCount });
    }

    return true;
};

export {
    createNotification,
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    clearReadNotifications,
    deleteNotification,
};