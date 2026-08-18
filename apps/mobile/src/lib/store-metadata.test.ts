import appStore from "../../store/app-store/en-US.json";
import playStore from "../../store/play-store/en-US.json";

/**
 * App Store Connect rejects a submission whose fields are over length, and it
 * does it at the end of a release, not at the start. These are the limits, kept
 * here so a copy change fails in a test run instead of in a submission.
 *
 * The keyword rules are the other half. Apple indexes the name and subtitle
 * already, so a keyword repeated from either buys nothing and spends characters
 * out of a field that only has a hundred of them.
 */

const APP_STORE_LIMITS = {
  name: 30,
  subtitle: 30,
  promotionalText: 170,
  keywords: 100,
  description: 4000,
} as const;

const PLAY_STORE_LIMITS = {
  title: 30,
  shortDescription: 80,
  fullDescription: 4000,
} as const;

describe("app store metadata", () => {
  it.each(Object.entries(APP_STORE_LIMITS))(
    "keeps %s within %i characters",
    (field, limit) => {
      const value = appStore[field as keyof typeof APP_STORE_LIMITS];
      expect(value.length).toBeGreaterThan(0);
      expect(value.length).toBeLessThanOrEqual(limit as number);
    },
  );

  it("spends no keyword on a word the name or subtitle already indexes", () => {
    const indexed = `${appStore.name} ${appStore.subtitle}`.toLowerCase();
    const wasted = appStore.keywords
      .split(",")
      .filter((keyword) => indexed.includes(keyword.toLowerCase()));

    expect(wasted).toEqual([]);
  });

  it("uses no spaces in the keyword field", () => {
    // Apple splits on spaces as well as commas, so a space is a wasted
    // character rather than a phrase.
    expect(appStore.keywords).not.toContain(" ");
  });

  it("leads with the brand name on both stores", () => {
    expect(appStore.name.startsWith("Siyi.app")).toBe(true);
    expect(playStore.title.startsWith("Siyi.app")).toBe(true);
  });
});

describe("play store metadata", () => {
  it.each(Object.entries(PLAY_STORE_LIMITS))(
    "keeps %s within %i characters",
    (field, limit) => {
      const value = playStore[field as keyof typeof PLAY_STORE_LIMITS];
      expect(value.length).toBeGreaterThan(0);
      expect(value.length).toBeLessThanOrEqual(limit as number);
    },
  );
});
