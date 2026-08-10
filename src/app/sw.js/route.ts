import { brand } from "@/config/brand";

const cacheName = `${brand.slug}-shell-v2`;
const pagesCacheName = `${brand.slug}-pages-v1`;
const notificationTag = `${brand.slug}-reminder`;

/**
 * The pages cache holds signed-in HTML, which the shell cache never did, so
 * every rule about emptying it lives in one place below: a sign out, a reply
 * that bounced to /auth, and a different account opening the same browser all
 * drop it on the floor.
 */
const serviceWorkerSource = `
const CACHE_NAME = ${JSON.stringify(cacheName)};
const PAGES_CACHE = ${JSON.stringify(pagesCacheName)};
const CACHE_OWNER_KEY = "/__siyi-cache-owner";

/** Routes worth showing instantly from the last visit. */
const CACHEABLE_PAGES = [
  "/today",
  "/people",
  "/reminders",
  "/birthdays",
  "/classes",
  "/map",
  "/check-in",
  "/notifications",
  "/settings",
];

function isCacheablePage(pathname) {
  return CACHEABLE_PAGES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

function forgetPages() {
  return caches.delete(PAGES_CACHE);
}

/**
 * Stored without the response headers it arrived with. A cached page must never
 * carry a rotated Supabase auth cookie back out of the cache later on.
 */
async function storePage(request, response) {
  const body = await response.clone().blob();
  const cache = await caches.open(PAGES_CACHE);
  await cache.put(
    request,
    new Response(body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "text/html; charset=utf-8",
      },
    }),
  );
}

async function servePage(event) {
  const cache = await caches.open(PAGES_CACHE);
  const cached = await cache.match(event.request);

  const fromNetwork = fetch(event.request)
    .then(async (response) => {
      // Following a redirect to /auth means the session is gone. Anything kept
      // from the previous one has to go with it.
      if (response.redirected && new URL(response.url).pathname.startsWith("/auth")) {
        await forgetPages();
        return response;
      }
      if (response.ok) await storePage(event.request, response);
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(
      fromNetwork.then(async (response) => {
        if (!response || !response.ok || response.redirected) return;
        const client = event.clientId && (await self.clients.get(event.clientId));
        // The page on screen came from the last visit, so ask it to pull the
        // current data in behind what the reader is already looking at.
        if (client) client.postMessage({ type: "siyi-page-revalidated" });
      }),
    );
    return cached;
  }

  const response = await fromNetwork;
  return response || (await caches.match("/offline"));
}

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
            .filter((name) => name !== CACHE_NAME && name !== PAGES_CACHE)
            .map((name) => caches.delete(name)),
        ),
      ),
  );
  self.clients.claim();
});

/**
 * The signed-in app reports who it belongs to on every load. A different answer
 * than last time means someone else is using this browser, and the pages kept
 * for the previous account are deleted before anything can be served from them.
 */
self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "siyi-cache-owner") return;

  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      const stored = await cache.match(CACHE_OWNER_KEY);
      const previous = stored ? await stored.text() : null;
      if (previous === message.owner) return;

      await forgetPages();
      const replacement = await caches.open(PAGES_CACHE);
      await replacement.put(CACHE_OWNER_KEY, new Response(message.owner));
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Signing out is a form post that navigates away, so the page has no reliable
  // moment to clear anything itself. The worker sees the request and does it.
  if (
    event.request.method === "POST" &&
    requestUrl.origin === self.location.origin &&
    requestUrl.pathname === "/auth/signout"
  ) {
    event.waitUntil(forgetPages());
    return;
  }

  if (event.request.method !== "GET") return;
  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  if (event.request.mode === "navigate") {
    if (isCacheablePage(requestUrl.pathname)) {
      event.respondWith(servePage(event));
      return;
    }
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
