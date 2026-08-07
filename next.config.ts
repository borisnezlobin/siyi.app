import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  distDir:
    process.env.NEXT_DIST_DIR ??
    (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
  // Follow-ups became reminders. Old links live on in delivered notifications,
  // shared URLs and bookmarks, so they are pointed at the new page rather than
  // left to 404.
  async redirects() {
    return [
      { source: "/follow-ups", destination: "/reminders", permanent: true },
      { source: "/api/follow-ups", destination: "/api/reminders", permanent: false },
      {
        source: "/api/follow-ups/:id",
        destination: "/api/reminders/:id",
        permanent: false,
      },
    ];
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
