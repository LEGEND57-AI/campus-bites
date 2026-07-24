import { supabase } from "../db.js";

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

    return data;
};

/**
 * Mark all notifications as read
 */
const markAllAsRead = async (userId) => {
    const { error } = await supabase
        .from("notifications")
        .update({
            is_read: true,
        })
        .eq("user_id", userId)
        .eq("is_read", false)
        .eq("is_deleted", false);

    if (error) throw error;

    return true;
};

/**
 * Soft delete a notification
 */
const deleteNotification = async (notificationId, userId) => {
    const { error } = await supabase
        .from("notifications")
        .update({
            is_deleted: true,
        })
        .eq("id", notificationId)
        .eq("user_id", userId)
        .eq("is_deleted", false);

    if (error) throw error;

    return true;
};

export {
    createNotification,
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
};