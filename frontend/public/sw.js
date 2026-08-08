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

                for (const client of clientList) {

                    if ("focus" in client) {

                        client.navigate(
                            event.notification.data.url
                        );

                        return client.focus();

                    }

                }

                return clients.openWindow(
                    event.notification.data.url
                );

            })

    );

});