import { pushAPI } from "../services/api";

export async function requestNotificationPermission() {

    if (!("Notification" in window)) {

        return false;

    }

    if (Notification.permission === "granted") {

        return true;

    }

    if (Notification.permission === "denied") {

        return false;

    }

    const permission =
        await Notification.requestPermission();

    return permission === "granted";

}

export async function subscribeToPush() {

    const registration =
        await navigator.serviceWorker.ready;

    const existingSubscription =
        await registration.pushManager.getSubscription();

    if (existingSubscription) {
        return existingSubscription;
    }

    const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/push/public-key`
    );

    const { publicKey } = await response.json();

    return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey:
            urlBase64ToUint8Array(publicKey),
    });

}

export async function registerPushSubscription() {

    try {

        const subscription =
            await subscribeToPush();

        await pushAPI.subscribe(subscription);

    } catch (err) {

        console.error(
            "Push registration failed",
            err
        );

    }

}

function urlBase64ToUint8Array(base64String) {

    const padding =
        "=".repeat((4 - base64String.length % 4) % 4);

    const base64 =
        (base64String + padding)
            .replace(/-/g, "+")
            .replace(/_/g, "/");

    const rawData = atob(base64);

    return Uint8Array.from(
        [...rawData].map(char => char.charCodeAt(0))
    );

}
