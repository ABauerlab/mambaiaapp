/* Mambaia App - Service Worker com diagnóstico para iOS */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** Log local de diagnostico do push. */
async function logToBackend(msg) {
  // Log apenas local: o endpoint publico de log foi removido por seguranca.
  console.log("[sw]", msg);
}

self.addEventListener("push", (event) => {
  // O iOS exige que o SW mostre uma notificação real para cada push recebido.
  // Usamos event.waitUntil para garantir que o SW não seja encerrado antes disso.
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        // Tenta ler o JSON do payload
        data = event.data ? event.data.json() : {};
        await logToBackend(`Payload lido: ${data.title || "Sem título"}`);
      } catch (err) {
        // Se falhar o parsing (ex: erro de descriptografia/VAPID/encoding)
        const rawText = event.data ? event.data.text() : "Sem dados";
        await logToBackend(`Erro no parsing: ${err.message}. Raw: ${rawText.slice(0, 20)}`);
        
        // Mostra notificação de fallback para não quebrar a regra do iOS
        return self.registration.showNotification("Mambaia (Erro)", {
          body: "Recebi um push, mas não consegui ler os dados. Tente reinstalar o PWA.",
          icon: "/icon-192.png",
          tag: "push-error"
        });
      }

      const title = data.title || "Mambaia";
      const options = {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: data.url || "/" },
        tag: data.tag || "mambaia-alerta",
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
      };

      return self.registration.showNotification(title, options);
    })()
  );
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