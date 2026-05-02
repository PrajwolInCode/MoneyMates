const CACHE_NAME = "moneymates-v20260503-budgeting";
const CACHE_PREFIX = "moneymates-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function shouldBypassCache(request) {
  const url = new URL(request.url);
  return (
    request.method !== "GET" ||
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/.netlify/functions/") ||
    url.pathname === "/index.html" ||
    url.pathname === "/service-worker.js"
  );
}

function isNavigationRequest(request) {
  return request.mode === "navigate" || request.headers.get("accept")?.includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (shouldBypassCache(request)) {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(
        () =>
          new Response("MoneyMates is offline. Reconnect and refresh the app.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }),
      ),
    );
    return;
  }

  const url = new URL(request.url);
  if (!url.pathname.startsWith("/icons/")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "MoneyMates", body: event.data.text() };
    }
  }

  const title = payload.title || "MoneyMates";
  const options = {
    body: payload.body || "You have a new household notification.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: {
      url: payload.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.endsWith(targetUrl) || client.url === self.location.origin + targetUrl);
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});
