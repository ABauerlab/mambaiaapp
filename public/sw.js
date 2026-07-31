/* Mambaia App - Service Worker para push notifications */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Mambaia", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Mambaia App";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png", // Logotipo Mambaia
    badge: "/icon-192.png", // Ícone para barra de status (Android)
    image: data.image || null,
    data: { url: data.url || "/" },
    tag: data.tag || "mambaia-alerta",
    renotify: true, // Vibra/avisa mesmo se for a mesma tag
    requireInteraction: true,
    silent: false, // Força som padrão do sistema
    vibrate: [200, 100, 200, 100, 200], // Padrão de vibração
    actions: [{ action: "abrir", title: "Abrir no app" }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});