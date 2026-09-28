// Service Worker for Web Push Notifications
// אליאל ביוטי - מערכת התראות לתורים

self.addEventListener("install", (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "אליאל ביוטי",
    body: "יש לך הודעה חדשה לגבי התור שלך.",
    url: "/my-bookings",
    type: "appointment_notification",
    appointmentId: null,
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    vibrate: [100, 50, 100],
    dir: "rtl",
    lang: "he",
    data: {
      url: data.url || "/my-bookings",
      appointmentId: data.appointmentId,
      type: data.type,
    },
    actions: [
      {
        action: "view",
        title: "צפייה בתור",
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/my-bookings";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (const client of windowClients) {
        if ("focus" in client) {
          if (client.url.includes(targetUrl)) {
            return client.focus();
          }
          return client.focus().then(() => client.navigate(targetUrl));
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
