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
            .select("*")
            .eq("user_id", userId);

    if (error || !subscriptions?.length) {
        return;
    }

    const payload = JSON.stringify({
        title,
        body,
        data,
    });

    for (const sub of subscriptions) {

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

        } catch (err) {

            console.error(
                "Push Error:",
                err.statusCode || err.message
            );

            // Subscription expired
            if (
                err.statusCode === 404 ||
                err.statusCode === 410
            ) {

                await supabase
                    .from("push_subscriptions")
                    .delete()
                    .eq("endpoint", sub.endpoint);

            }

        }

    }

}