import { mkdir, appendFile, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  citedUrls,
  findMentions,
  rankOf,
  renderHistoryEntry,
  summarize,
  type Product,
  type PromptResult,
} from "../../src/lib/ai-visibility";
import { allEngines, partitionByCredentials, type Engine } from "./engines";

/**
 * The scoreboard. Asks every engine the same version-controlled set of buyer
 * questions and records whether Siyi got named, where it placed, and which
 * sources the answer leaned on.
 *
 * Run it weekly. Run-to-run variance is real, so a daily cadence buys noise
 * rather than resolution — and a baseline taken before any content ships is
 * what makes the later numbers mean something.
 *
 *   npm run visibility
 */

const OUTPUT_DIR = join(process.cwd(), "visibility");
// Concurrency is deliberately low: these are rate-limited APIs, and the run has
// all week to finish.
const CONCURRENCY = 3;

type PromptSet = {
  brand: Product;
  competitors: Product[];
  prompts: string[];
};

async function loadPromptSet(): Promise<PromptSet> {
  const raw = await readFile(
    join(import.meta.dirname, "prompts.json"),
    "utf8",
  );
  return JSON.parse(raw) as PromptSet;
}

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function drain() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, drain),
  );
  return results;
}

type Job = { engine: Engine; prompt: string };

async function runJob(
  job: Job,
  products: Product[],
  brandName: string,
): Promise<(PromptResult & { answer: string }) | null> {
  try {
    const answer = await job.engine.ask(job.prompt);
    const mentions = findMentions(answer.text, products);
    return {
      prompt: job.prompt,
      engine: job.engine.name,
      mentions,
      rank: rankOf(mentions, brandName),
      sources: citedUrls(answer.text, answer.sources),
      answer: answer.text,
    };
  } catch (error) {
    // A failed call is not a zero. Report it and leave it out of the denominator.
    console.error(
      `  ! ${job.engine.name} failed on "${job.prompt}": ${(error as Error).message}`,
    );
    return null;
  }
}

async function main() {
  const { brand, competitors, prompts } = await loadPromptSet();
  const products = [brand, ...competitors];
  const { available, skipped } = partitionByCredentials(allEngines);

  if (available.length === 0) {
    console.error(
      "No engine API keys are set. Set at least one of: " +
        allEngines.map((engine) => engine.envVar).join(", "),
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Asking ${prompts.length} prompts across ${available.length} engines (${available
      .map((engine) => engine.name)
      .join(", ")}).`,
  );
  if (skipped.length) {
    console.log(
      `Skipping ${skipped.map((engine) => `${engine.name} (${engine.envVar} unset)`).join(", ")}.`,
    );
  }

  const jobs: Job[] = available.flatMap((engine) =>
    prompts.map((prompt) => ({ engine, prompt })),
  );

  let done = 0;
  const settled = await mapWithLimit(jobs, CONCURRENCY, async (job) => {
    const outcome = await runJob(job, products, brand.name);
    done += 1;
    if (done % 10 === 0) console.log(`  ${done}/${jobs.length}`);
    return outcome;
  });

  const answers = settled.filter(
    (entry): entry is PromptResult & { answer: string } => entry !== null,
  );
  const failed = settled.length - answers.length;
  const report = summarize(answers, brand.name);

  // Stamped here rather than inside the report so the pure scoring code stays
  // free of the clock.
  const date = new Date().toISOString().slice(0, 10);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    join(OUTPUT_DIR, `${date}.json`),
    JSON.stringify({ date, report, answers, failed }, null, 2),
  );
  await appendFile(
    join(OUTPUT_DIR, "history.md"),
    renderHistoryEntry(report, {
      date,
      brandName: brand.name,
      engines: available.map((engine) => engine.name),
      skippedEngines: skipped.map((engine) => engine.name),
      promptCount: prompts.length,
    }) + "\n",
  );

  console.log("");
  console.log(`Answers naming ${brand.name}: ${report.named}/${report.answered}`);
  console.log(
    `Share of voice: ${report.shareOfVoice === null ? "—" : `${(report.shareOfVoice * 100).toFixed(1)}%`}`,
  );
  console.log(
    `Average rank when named: ${report.averageRank?.toFixed(2) ?? "—"}`,
  );
  if (failed) console.log(`${failed} call(s) failed and were left uncounted.`);
  console.log(`\nWrote visibility/${date}.json and appended visibility/history.md`);
}

main();
