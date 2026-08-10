import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  // Next 15 holds a dynamic route in the client router cache for zero seconds,
  // so returning to a tab you were just on re-fetched it and showed the loading
  // skeleton again. That, rather than a slow server, is what made moving around
  // the app feel like it was always loading. This is memory only and dies with
  // the tab; the service worker handles what survives a cold open.
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
