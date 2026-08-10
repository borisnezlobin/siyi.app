import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";
import { publicPages } from "@/lib/public-pages";

/**
 * A page a stranger can open, that nothing points a crawler at, may as well not
 * exist. These keep the three lists that decide that — the pages themselves,
 * the sitemap, and robots — from drifting apart again.
 */
describe("what crawlers are told about", () => {
  const paths = sitemap().map((entry) => entry.url);
  // Taken from the output rather than written down again: the base changes with
  // NEXT_PUBLIC_APP_URL, and these are about which pages are listed, not where.
  // The home entry carries no path, so it is the shortest of them.
  const baseUrl = paths.reduce((shortest, url) =>
    url.length < shortest.length ? url : shortest,
  );

  it("lists every public page except the sign-in screen", () => {
    for (const [key, page] of Object.entries(publicPages)) {
      const expected = `${baseUrl}${page.path === "/" ? "" : page.path}`;
      if (key === "auth") {
        expect(paths).not.toContain(expected);
      } else {
        expect(paths, `${page.path} is missing from the sitemap`).toContain(
          expected,
        );
      }
    }
  });

  it("gives the home page the top priority and one entry each", () => {
    const entries = sitemap();
    expect(new Set(paths).size).toBe(entries.length);
    expect(entries.find((entry) => entry.url === baseUrl)?.priority).toBe(1);
  });

  it("does not disallow anything it also asks to have indexed", () => {
    const rules = robots().rules;
    const disallowed = (Array.isArray(rules) ? rules : [rules]).flatMap((rule) =>
      [rule.disallow ?? []].flat(),
    );

    for (const url of paths) {
      const path = url.replace(baseUrl, "") || "/";
      for (const blocked of disallowed) {
        expect(
          path === blocked || (blocked !== "/" && path.startsWith(blocked)),
          `${path} is in the sitemap but blocked by ${blocked}`,
        ).toBe(false);
      }
    }
  });

  it("points crawlers at the sitemap from robots", () => {
    expect(robots().sitemap).toBe("https://www.siyi.app/sitemap.xml");
  });
});
