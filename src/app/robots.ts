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
        "/reminders",
        "/notifications",
        "/settings",
        "/onboarding",
        // Shared contact cards. They are noindex on the page too; this keeps a
        // crawler from ever requesting one.
        "/s/",
      ],
    },
    sitemap: "https://www.siyi.app/sitemap.xml",
  };
}
