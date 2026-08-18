import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";
import { sitemapPaths } from "./sitemap";

/**
 * Everything behind sign-in is private. Those routes already require a session,
 * but keeping them out of crawlers avoids surfacing the URLs at all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Derived, so a new public page is crawlable the moment it is added
      // rather than the day someone notices it is not.
      allow: sitemapPaths,
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
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
