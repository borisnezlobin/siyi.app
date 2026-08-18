/**
 * Scoring for the "are we #1?" tracker: given what an AI assistant answered
 * when asked a question a real student would ask, work out whether Siyi was
 * named, how prominently, and who else was in the room.
 *
 * Pure on purpose. The engines that produce the answers need network access and
 * API keys; this file needs neither, so the part that decides what the number
 * means is the part that can be tested.
 */

export type Product = {
  /** What the report calls it. */
  name: string;
  /** Every spelling a model might use. Matched whole-word, case-insensitively. */
  aliases: string[];
};

export type Mention = {
  name: string;
  /** Where in the answer it first appeared. Position is the proxy for rank. */
  index: number;
};

/**
 * Escaped so a product name containing regex punctuation — "Siyi.app" has a
 * dot, which would otherwise match any character — means itself.
 */
function aliasPattern(alias: string) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // \b does not fire after a dot, so "Siyi.app" needs a non-word-char or
  // end-of-string lookahead rather than a trailing word boundary.
  return new RegExp(`(?<![\\w.])${escaped}(?![\\w.])`, "i");
}

export function findMentions(answer: string, products: Product[]): Mention[] {
  const found: Mention[] = [];

  for (const product of products) {
    let earliest = -1;
    for (const alias of product.aliases) {
      const match = aliasPattern(alias).exec(answer);
      if (match && (earliest === -1 || match.index < earliest)) {
        earliest = match.index;
      }
    }
    if (earliest !== -1) found.push({ name: product.name, index: earliest });
  }

  return found.sort((a, b) => a.index - b.index);
}

/**
 * Where the brand placed among the products named, or null if it was not named
 * at all. First mentioned is first: models write recommendations in order of
 * preference far more often than they number them.
 */
export function rankOf(mentions: Mention[], brandName: string) {
  const position = mentions.findIndex((mention) => mention.name === brandName);
  return position === -1 ? null : position + 1;
}

/**
 * Every URL the answer pointed at. This is the actionable column of the whole
 * report: it names the pages that decide what the model says, which is where
 * the next week of work goes.
 */
export function citedUrls(answer: string, extraSources: string[] = []) {
  const fromText = answer.match(/https?:\/\/[^\s)<>\]"']+/g) ?? [];
  const cleaned = [...fromText, ...extraSources].map((url) =>
    url.replace(/[.,;:]+$/, ""),
  );
  return [...new Set(cleaned)];
}

export type PromptResult = {
  prompt: string;
  engine: string;
  mentions: Mention[];
  rank: number | null;
  sources: string[];
};

export type VisibilityReport = {
  /** Answers that actually came back. A skipped engine is not a zero. */
  answered: number;
  /** How many of those named the brand. */
  named: number;
  /** named / answered, or null when nothing was answered. */
  mentionRate: number | null;
  /**
   * Brand mentions as a share of all product mentions. This is the number that
   * answers "are we #1" — 1.0 would mean no competitor was ever named beside us.
   */
  shareOfVoice: number | null;
  /** Mean rank across the answers that named the brand. Null if never named. */
  averageRank: number | null;
  /** Every product seen, most-mentioned first. The brand is in here too. */
  leaderboard: { name: string; mentions: number }[];
  /** Most-cited sources first. Where to go get mentioned. */
  topSources: { url: string; count: number }[];
};

export function summarize(
  results: PromptResult[],
  brandName: string,
): VisibilityReport {
  const answered = results.length;
  const counts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  let brandMentions = 0;
  let totalMentions = 0;
  const ranks: number[] = [];

  for (const result of results) {
    for (const mention of result.mentions) {
      counts.set(mention.name, (counts.get(mention.name) ?? 0) + 1);
      totalMentions += 1;
      if (mention.name === brandName) brandMentions += 1;
    }
    if (result.rank !== null) ranks.push(result.rank);
    for (const url of result.sources) {
      sourceCounts.set(url, (sourceCounts.get(url) ?? 0) + 1);
    }
  }

  return {
    answered,
    named: ranks.length,
    mentionRate: answered === 0 ? null : ranks.length / answered,
    shareOfVoice: totalMentions === 0 ? null : brandMentions / totalMentions,
    averageRank:
      ranks.length === 0
        ? null
        : ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length,
    leaderboard: [...counts.entries()]
      .map(([name, mentions]) => ({ name, mentions }))
      .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name)),
    topSources: [...sourceCounts.entries()]
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count || a.url.localeCompare(b.url)),
  };
}

function percent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

/**
 * One dated block appended to visibility/history.md. Written as a table rather
 * than prose so a run six months from now sits next to this one and the trend
 * is readable without a tool.
 */
export function renderHistoryEntry(
  report: VisibilityReport,
  context: {
    date: string;
    brandName: string;
    engines: string[];
    skippedEngines: string[];
    promptCount: number;
  },
) {
  const lines = [
    `## ${context.date}`,
    "",
    `${context.promptCount} prompts across ${context.engines.length} engines (${context.engines.join(", ")}).`,
  ];

  // Named explicitly: a run that quietly covered half the engines would
  // otherwise read as a drop in visibility rather than a gap in measurement.
  if (context.skippedEngines.length) {
    lines.push(
      "",
      `Skipped, no API key set: ${context.skippedEngines.join(", ")}. These are not counted as misses.`,
    );
  }

  lines.push(
    "",
    `- Answers naming ${context.brandName}: ${report.named}/${report.answered} (${percent(report.mentionRate)})`,
    `- Share of voice: ${percent(report.shareOfVoice)}`,
    `- Average rank when named: ${report.averageRank === null ? "—" : report.averageRank.toFixed(2)}`,
    "",
    "| Product | Mentions |",
    "| --- | --- |",
  );

  for (const entry of report.leaderboard.slice(0, 12)) {
    const marker = entry.name === context.brandName ? "**" : "";
    lines.push(`| ${marker}${entry.name}${marker} | ${entry.mentions} |`);
  }

  if (report.topSources.length) {
    lines.push("", "Most-cited sources:", "");
    for (const source of report.topSources.slice(0, 10)) {
      lines.push(`- ${source.count}× ${source.url}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
