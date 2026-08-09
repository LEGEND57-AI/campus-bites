import webpush from "web-push";
import { supabase } from "../db.js";

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

export async function sendPushNotification(
    userId,
    title,
    body,
    data = {}
) {
    const { data: subscriptions, error } =
        await supabase
            .from("push_subscriptions")
            .select("endpoint, p256dh, auth")
            .eq("user_id", userId);

    if (error) {
        console.error(
            "Push subscription query failed:",
            error.message
        );
        return;
    }

    if (!subscriptions?.length) {
        return;
    }

    const payload = JSON.stringify({
        title,
        body,
        data,
    });

    const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {

            try {

                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth,
                        },
                    },
                    payload,
                    {
                        TTL: 60,
                    }
                );

                return {
                    success: true,
                    endpoint: sub.endpoint,
                };

            } catch (err) {

                console.error(
                    "Push Error:",
                    err.statusCode || err.message
                );

                // Subscription expired / no longer valid
                if (
                    err.statusCode === 404 ||
                    err.statusCode === 410
                ) {

                    const { error: deleteError } =
                        await supabase
                            .from("push_subscriptions")
                            .delete()
                            .eq("endpoint", sub.endpoint);

                    if (deleteError) {
                        console.error(
                            "Failed to remove expired subscription:",
                            deleteError.message
                        );
                    }
                }

                return {
                    success: false,
                    endpoint: sub.endpoint,
                };
            }
        })
    );

    return results;
}