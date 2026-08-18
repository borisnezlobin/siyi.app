import { brand } from "@/config/brand";

/**
 * Everything the worker keeps is versioned by the build that served it. A Next
 * document, the chunks it names and the RSC payload inside it are one artifact:
 * mixing halves from two builds is what produced a "Something went wrong" on
 * cold open that no amount of retrying could clear, because the retry was
 * served the same stale document. A new build gets new cache names and the old
 * ones are deleted on activation.
 */
const buildVersion =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_BUILD_ID ??
  "dev";

const cacheName = `${brand.slug}-shell-${buildVersion}`;
const notificationTag = `${brand.slug}-reminder`;

const serviceWorkerSource = `
const CACHE_NAME = ${JSON.stringify(cacheName)};

/**
 * Static assets only. Every entry is either content-hashed by the build or a
 * file whose contents do not vary by who is asking, so none of it can be
 * personal and none of it can go stale against a newer build.
 */
const APP_SHELL = [
  "/offline",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
];

function isPrecacheable(pathname) {
  return pathname.startsWith("/_next/static/") || APP_SHELL.includes(pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll rejects as a unit, so one asset moving or 404ing used to leave
      // the worker unable to install at all. Each is allowed to fail alone.
      await Promise.allSettled(APP_SHELL.map((asset) => cache.add(asset)));
    })(),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Everything that is not this build's, which covers both the previous
      // build's shell and the page cache an older worker used to keep. That
      // cache held signed-in HTML: last visit's names shown as though they were
      // current, and one account's pages still on disk when the next signed in.
      // Nothing replaces it — a signed-in page is fetched or it is not shown.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

async function offlineFallback() {
  const cached = await caches.match("/offline");
  if (cached) return cached;
  // respondWith(undefined) is a network error and shows the browser's own
  // error page, so there is always something to hand back.
  return new Response(
    "<!doctype html><meta charset=utf-8><title>Offline</title><p>You are offline.",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith("/api/")) return;

  // A signed-in page always comes from the server. The only thing the worker
  // adds is somewhere to land when there is no network.
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => offlineFallback()));
    return;
  }

  if (!isPrecacheable(requestUrl.pathname)) return;

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
