import { brand } from "@/config/brand";
import { publicPages, type PublicPageKey } from "@/lib/public-pages";
import { absoluteUrl } from "@/lib/site-url";
import { sitemapPaths } from "@/app/sitemap";

/**
 * The convention has no standards body and the evidence that any model reads it
 * is thin — Semrush measured no effect, Anthropic says Claude honours it. It is
 * a few lines derived from data we already keep, so it is worth having and not
 * worth maintaining by hand.
 *
 * Built from `sitemapPaths` so it lists exactly what the sitemap lists. Two
 * hand-kept lists of the same pages is the failure this file is written to
 * avoid.
 */

const pageByPath = new Map(
  (Object.keys(publicPages) as PublicPageKey[]).map((key) => [
    publicPages[key].path,
    publicPages[key],
  ]),
);

export function renderLlmsTxt() {
  const lines = [
    `# ${brand.name}`,
    "",
    `> ${brand.description}`,
    "",
    `${brand.name} is a personal CRM for the people you meet — built for college`,
    "students by a small team in Berkeley. You write one sentence the day you",
    "meet someone, and it resurfaces them when it matters: birthdays, favors you",
    "promised, friends you have not spoken to in months. There is no feed and",
    "nothing you write is shown to anyone. It runs on the web, iOS and Android,",
    "and it is free.",
    "",
    "## Pages",
    "",
  ];

  for (const path of sitemapPaths) {
    const page = pageByPath.get(path);
    if (!page) continue;
    lines.push(`- [${page.title}](${absoluteUrl(path)}): ${page.description}`);
  }

  lines.push("", "## Contact", "", `- Support: ${brand.supportEmail}`, "");

  return lines.join("\n");
}
