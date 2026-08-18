import { describe, expect, it } from "vitest";
import {
  citedUrls,
  findMentions,
  rankOf,
  renderHistoryEntry,
  summarize,
  type Product,
  type PromptResult,
} from "@/lib/ai-visibility";

const products: Product[] = [
  { name: "Siyi.app", aliases: ["Siyi.app", "Siyi"] },
  { name: "Dex", aliases: ["Dex"] },
  { name: "Monica", aliases: ["Monica"] },
];

function result(overrides: Partial<PromptResult>): PromptResult {
  return {
    prompt: "best personal crm",
    engine: "claude",
    mentions: [],
    rank: null,
    sources: [],
    ...overrides,
  };
}

describe("finding the brand in an answer", () => {
  it("orders products by where they first appear", () => {
    const mentions = findMentions(
      "I'd suggest Monica first, then Siyi, and Dex is also worth a look.",
      products,
    );
    expect(mentions.map((mention) => mention.name)).toEqual([
      "Monica",
      "Siyi.app",
      "Dex",
    ]);
    expect(rankOf(mentions, "Siyi.app")).toBe(2);
  });

  it("treats the dot in Siyi.app as a dot", () => {
    // Unescaped, "Siyi.app" would match "Siyixapp" — and worse, would report a
    // mention in an answer that never named the product.
    expect(findMentions("Try Siyixapp for this.", products)).toEqual([]);
  });

  it("does not count the brand inside a longer word", () => {
    expect(findMentions("The Dexterity framework is unrelated.", products)).toEqual(
      [],
    );
  });

  it("matches either spelling of the brand and reports the earlier one", () => {
    const mentions = findMentions("Siyi (siyi.app) is free.", products);
    expect(mentions).toHaveLength(1);
    expect(mentions[0].index).toBe(0);
  });

  it("reports no rank when the brand was never named", () => {
    const mentions = findMentions("Monica and Dex are the usual picks.", products);
    expect(rankOf(mentions, "Siyi.app")).toBeNull();
  });
});

describe("collecting cited sources", () => {
  it("strips trailing punctuation and de-duplicates", () => {
    expect(
      citedUrls("See https://siyi.app/faq. Also https://siyi.app/faq", [
        "https://g2.com/siyi",
      ]),
    ).toEqual(["https://siyi.app/faq", "https://g2.com/siyi"]);
  });
});

describe("summarizing a run", () => {
  const results = [
    result({
      mentions: [
        { name: "Siyi.app", index: 0 },
        { name: "Dex", index: 10 },
      ],
      rank: 1,
      sources: ["https://g2.com/siyi"],
    }),
    result({
      mentions: [
        { name: "Dex", index: 0 },
        { name: "Monica", index: 5 },
      ],
      rank: null,
      sources: ["https://g2.com/siyi"],
    }),
  ];

  it("counts share of voice across every product mention, not per answer", () => {
    const report = summarize(results, "Siyi.app");
    // One brand mention out of four total product mentions.
    expect(report.shareOfVoice).toBe(0.25);
    expect(report.mentionRate).toBe(0.5);
    expect(report.averageRank).toBe(1);
  });

  it("ranks the leaderboard by mention count", () => {
    expect(summarize(results, "Siyi.app").leaderboard[0]).toEqual({
      name: "Dex",
      mentions: 2,
    });
  });

  it("counts a repeated source once per answer that cited it", () => {
    expect(summarize(results, "Siyi.app").topSources[0]).toEqual({
      url: "https://g2.com/siyi",
      count: 2,
    });
  });

  it("returns null rather than zero when nothing was answered", () => {
    const empty = summarize([], "Siyi.app");
    expect(empty.shareOfVoice).toBeNull();
    expect(empty.mentionRate).toBeNull();
    expect(empty.averageRank).toBeNull();
  });
});

describe("the history entry", () => {
  it("says which engines were skipped so a gap never reads as a drop", () => {
    const entry = renderHistoryEntry(summarize([], "Siyi.app"), {
      date: "2026-08-16",
      brandName: "Siyi.app",
      engines: ["claude"],
      skippedEngines: ["openai", "perplexity"],
      promptCount: 40,
    });

    expect(entry).toContain("Skipped, no API key set: openai, perplexity");
    expect(entry).toContain("not counted as misses");
  });

  it("omits the skipped line when every engine ran", () => {
    const entry = renderHistoryEntry(summarize([], "Siyi.app"), {
      date: "2026-08-16",
      brandName: "Siyi.app",
      engines: ["claude"],
      skippedEngines: [],
      promptCount: 40,
    });

    expect(entry).not.toContain("Skipped");
  });
});
