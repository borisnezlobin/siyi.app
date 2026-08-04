import { brand } from "@/config/brand";

const cacheName = `${brand.slug}-shell-v2`;
const notificationTag = `${brand.slug}-reminder`;

const serviceWorkerSource = `
const CACHE_NAME = ${JSON.stringify(cacheName)};
const APP_SHELL = [
  "/offline",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline")));
    return;
  }

  if (
    !requestUrl.pathname.startsWith("/_next/static/") &&
    !APP_SHELL.includes(requestUrl.pathname)
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok && response.type === "basic") {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
          }
          return response;
        }),
    ),
  );
});

self.addEventListener("push", (event) => {
  const fallback = {
    title: ${JSON.stringify(brand.name)},
    body: "You have a new reminder.",
    url: "/today",
    tag: ${JSON.stringify(notificationTag)},
  };
  let payload = fallback;

  try {
    payload = { ...fallback, ...event.data.json() };
  } catch {
    payload = fallback;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/today",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const matchingClient = clients.find((client) => client.url === targetUrl);
        if (matchingClient) return matchingClient.focus();
        return self.clients.openWindow(targetUrl);
      }),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  const subscriptionOptions = event.oldSubscription?.options;
  if (!subscriptionOptions?.applicationServerKey) return;

  event.waitUntil(
    self.registration.pushManager
      .subscribe(subscriptionOptions)
      .then((subscription) =>
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
          credentials: "include",
        }),
      ),
  );
});
`;

export function GET() {
  return new Response(serviceWorkerSource, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
