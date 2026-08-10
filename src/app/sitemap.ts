import type { MetadataRoute } from "next";
import { publicPages, type PublicPageKey } from "@/lib/public-pages";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://www.siyi.app";

/**
 * Sign-in is public but not worth indexing, and robots disallows the rest of
 * /auth anyway. Everything else a stranger can open belongs in here.
 */
const notWorthIndexing: PublicPageKey[] = ["auth"];

/**
 * Derived from `publicPages` rather than listed again. As its own array this
 * went stale the moment a page was added — /team existed, was linked from every
 * footer, and was missing from here until someone noticed.
 */
export const sitemapPaths = (
  Object.keys(publicPages) as PublicPageKey[]
)
  .filter((key) => !notWorthIndexing.includes(key))
  .map((key) => publicPages[key].path);

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapPaths.map((path) => ({
    url: `${baseUrl}${path === "/" ? "" : path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
