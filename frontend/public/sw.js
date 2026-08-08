self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    clients.claim();
});

self.addEventListener("push", (event) => {

    const data = event.data
        ? event.data.json()
        : {};

    event.waitUntil(

        self.registration.showNotification(
            data.title || "CampusCraves",
            {
                body: data.body || "",

                icon: "/CampusCraves-Logo.png",

                badge: "/CampusCraves-Logo.png",

                tag: data.data?.orderId || "campuscraves",

                renotify: true,

                requireInteraction: false,

                vibrate: [200, 100, 200],

                data: {
                    url:
                        data.data?.actionUrl ||
                        "/notifications",
                },
            }
        )

    );

});

self.addEventListener("notificationclick", (event) => {

    event.notification.close();

    event.waitUntil(

        clients.matchAll({
            type: "window",
            includeUncontrolled: true,
        })

        .then((clientList) => {

            const rawUrl =
                event.notification.data?.url ||
                "/notifications";

            const targetUrl =
                new URL(
                    rawUrl,
                    self.location.origin
                ).href;

            // Existing CampusCraves tab
            for (const client of clientList) {

                if (
                    client.url.startsWith(
                        self.location.origin
                    ) &&
                    "focus" in client
                ) {

                    client.navigate(targetUrl);

                    return client.focus();
                }

            }

            // No existing CampusCraves tab
            return clients.openWindow(targetUrl);

        })

    );

});