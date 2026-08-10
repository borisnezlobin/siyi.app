import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://www.siyi.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/terms", "/support", "/team"].map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.5,
  }));
}
