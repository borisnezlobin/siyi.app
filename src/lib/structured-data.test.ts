import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { renderLlmsTxt } from "@/lib/llms-txt";
import { publicPages, publicPageMetadata, type PublicPageKey } from "@/lib/public-pages";
import { siteUrl } from "@/lib/site-url";
import {
  faqSchema,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "@/lib/structured-data";
import { sitemapPaths } from "@/app/sitemap";

const keys = Object.keys(publicPages) as PublicPageKey[];

describe("what a crawler is told this site is", () => {
  it("gives every public page one canonical URL on the real origin", () => {
    for (const key of keys) {
      const canonical = publicPageMetadata(key).alternates.canonical;
      expect(canonical.startsWith(siteUrl), `${key} is canonical elsewhere`).toBe(
        true,
      );
      // The home page is the origin itself, not the origin with a slash glued on.
      expect(canonical).not.toMatch(/[^:]\/\/|\/$/);
    }
  });

  it("says the brand name in the home page title", () => {
    // The bug this is written for: searching the brand returned /terms, because
    // the home page title never contained it.
    const title = publicPageMetadata("home").title;
    expect(typeof title === "object" && title.absolute).toContain(brand.name);
  });

  it("answers to the name people actually type", () => {
    for (const schema of [organizationSchema(), websiteSchema()]) {
      expect(schema.alternateName).toContain(`${brand.shortName} app`);
    }
  });

  it("describes the app the same way the home page does", () => {
    expect(softwareApplicationSchema().description).toBe(
      publicPages.home.description,
    );
  });

  it("lists exactly the sitemap's pages in llms.txt", () => {
    const body = renderLlmsTxt();
    for (const key of keys) {
      const url = publicPages[key].path === "/" ? siteUrl : `${siteUrl}${publicPages[key].path}`;
      const listed = body.includes(`(${url})`);
      expect(
        listed,
        `${publicPages[key].path} disagrees between llms.txt and the sitemap`,
      ).toBe(sitemapPaths.includes(publicPages[key].path));
    }
  });

  it("builds an FAQ node per entry", () => {
    const schema = faqSchema([{ question: "Is it free?", answer: "Yes." }]);
    expect(schema.mainEntity).toHaveLength(1);
    expect(schema.mainEntity[0].acceptedAnswer.text).toBe("Yes.");
  });
});
