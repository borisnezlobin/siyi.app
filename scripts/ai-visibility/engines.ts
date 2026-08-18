import Anthropic from "@anthropic-ai/sdk";

/**
 * One adapter per assistant a student might actually ask. Each returns the
 * answer text plus any sources the engine reported separately, so the scorer
 * can see citations the prose never spelled out.
 *
 * An engine whose key is missing is *skipped*, never scored as a miss. A run
 * that silently dropped an engine would read as a fall in visibility rather
 * than a hole in the measurement, which is the failure this whole tool exists
 * to avoid making.
 */

export type EngineAnswer = { text: string; sources: string[] };

export type Engine = {
  name: string;
  envVar: string;
  ask: (prompt: string) => Promise<EngineAnswer>;
};

/**
 * Every engine is asked to answer as if a real person asked it — no framing
 * about being measured, no product list. A prompt that mentions Siyi would
 * measure whether the model can read, not whether it recommends us.
 */
const SYSTEM =
  "You are helping a college student who asked this question. Answer the way you normally would, naming specific apps or tools where that is useful.";

const MAX_TOKENS = 1200;

function anthropicEngine(): Engine {
  return {
    name: "claude",
    envVar: "ANTHROPIC_API_KEY",
    async ask(prompt) {
      const client = new Anthropic();
      const response = await client.messages.create({
        model: "claude-opus-5",
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        // Web search is what makes this measure today's answer rather than the
        // training cutoff's. Without it a new product can never appear.
        tools: [{ type: "web_search_20260209", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      const sources: string[] = [];
      for (const block of response.content) {
        if (block.type !== "web_search_tool_result") continue;
        // On an error the content is a single object, not a list of results.
        if (!Array.isArray(block.content)) continue;
        for (const result of block.content) {
          if (result.type === "web_search_result") sources.push(result.url);
        }
      }

      return { text, sources };
    },
  };
}

/** OpenAI's Responses API with its own web-search tool. */
function openAiEngine(): Engine {
  return {
    name: "openai",
    envVar: "OPENAI_API_KEY",
    async ask(prompt) {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? "gpt-5",
          instructions: SYSTEM,
          input: prompt,
          tools: [{ type: "web_search" }],
        }),
      });

      if (!response.ok) {
        throw new Error(`openai ${response.status}: ${await response.text()}`);
      }

      const body = await response.json();
      const text: string =
        body.output_text ??
        (body.output ?? [])
          .flatMap((item: { content?: { text?: string }[] }) => item.content ?? [])
          .map((part: { text?: string }) => part.text ?? "")
          .join("\n");

      return { text, sources: [] };
    },
  };
}

/** Perplexity always searches, and returns its citations as a flat list. */
function perplexityEngine(): Engine {
  return {
    name: "perplexity",
    envVar: "PERPLEXITY_API_KEY",
    async ask(prompt) {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.PERPLEXITY_MODEL ?? "sonar",
          max_tokens: MAX_TOKENS,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`perplexity ${response.status}: ${await response.text()}`);
      }

      const body = await response.json();
      return {
        text: body.choices?.[0]?.message?.content ?? "",
        sources: body.citations ?? [],
      };
    },
  };
}

/** Gemini, with Google Search grounding so it reflects the live index. */
function geminiEngine(): Engine {
  return {
    name: "gemini",
    envVar: "GEMINI_API_KEY",
    async ask(prompt) {
      const model = process.env.GEMINI_MODEL ?? "gemini-2.5-pro";
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`gemini ${response.status}: ${await response.text()}`);
      }

      const body = await response.json();
      const candidate = body.candidates?.[0];
      const text = (candidate?.content?.parts ?? [])
        .map((part: { text?: string }) => part.text ?? "")
        .join("\n");
      const sources: string[] = (
        candidate?.groundingMetadata?.groundingChunks ?? []
      )
        .map((chunk: { web?: { uri?: string } }) => chunk.web?.uri)
        .filter((uri: string | undefined): uri is string => Boolean(uri));

      return { text, sources };
    },
  };
}

export const allEngines: Engine[] = [
  anthropicEngine(),
  openAiEngine(),
  perplexityEngine(),
  geminiEngine(),
];

export function partitionByCredentials(engines: Engine[]) {
  const available = engines.filter((engine) => process.env[engine.envVar]);
  const skipped = engines.filter((engine) => !process.env[engine.envVar]);
  return { available, skipped };
}
