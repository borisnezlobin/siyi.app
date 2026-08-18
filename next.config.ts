import type { NextConfig } from "next";

/**
 * One identifier per build, for the service worker to name its caches after.
 *
 * Vercel supplies the commit; anywhere else — a self-host, a container, a
 * preview built off-platform — there is nothing stable to read, so the build
 * stamps its own. Evaluated once while the config loads, so every route in a
 * build agrees on it. Without this the fallback was the literal string "dev",
 * which meant the cache name never changed off Vercel and the stale-half-a-build
 * failure the versioning exists to prevent came back silently.
 */
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_BUILD_ID ??
  Date.now().toString(36);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  poweredByHeader: false,
  devIndicators: false,
  // Next 15 holds a dynamic route in the client router cache for zero seconds,
  // so returning to a tab you were just on re-fetched it and showed the loading
  // skeleton again. That, rather than a slow server, is what made moving around
  // the app feel like it was always loading. This is memory only and dies with
  // the tab.
  //
  // `static` is the window for prefetched payloads, and it used to be the real
  // staleness budget for the whole app: the nav links asked for full prefetches
  // of force-dynamic routes, which made every tab reusable for three minutes.
  // The links now prefetch only as far as the loading skeleton, so `static`
  // covers skeletons and genuinely static segments, and `dynamic` is the number
  // that describes how old a page you were just looking at may be.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  distDir:
    process.env.NEXT_DIST_DIR ??
    (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
  // A folder named @something is a parallel route slot in the App Router, not a
  // path, so the readable address is rewritten onto a normal segment.
  async rewrites() {
    return [{ source: "/@:slug", destination: "/u/:slug" }];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
