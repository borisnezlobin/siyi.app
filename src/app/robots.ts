import type { MetadataRoute } from "next";

/**
 * Everything behind sign-in is private. Those routes already require a session,
 * but keeping them out of crawlers avoids surfacing the URLs at all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms", "/support"],
      disallow: [
        "/api/",
        "/auth/",
        "/today",
        "/people",
        "/follow-ups",
        "/notifications",
        "/settings",
        "/onboarding",
      ],
    },
    sitemap: "https://siyi.app/sitemap.xml",
  };
}
