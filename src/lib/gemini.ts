import {
  normalizeProposal,
  proposalFieldNames,
  type UpdateProposal,
} from "@/lib/update-proposal";

/**
 * The model used by everything that is not an iPhone new enough to sort an
 * update on its own.
 *
 * Kept behind one function so the key never travels further than this module,
 * and so a bad day at Google is a degraded feature rather than a failed save:
 * every path out of here is a result, not a thrown error.
 */

const endpoint =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** The same shape as `UpdateProposal`, in the dialect the API wants. */
const responseSchema = {
  type: "OBJECT",
  properties: {
    notes: {
      type: "ARRAY",
      maxItems: 6,
      items: {
        type: "OBJECT",
        properties: { heading: { type: "STRING" }, text: { type: "STRING" } },
        required: ["heading", "text"],
      },
    },
    fields: {
      type: "ARRAY",
      maxItems: 8,
      items: {
        type: "OBJECT",
        properties: {
          // Built from the same list the app validates against, so the two
          // cannot drift into disagreeing about what may be written.
          field: { type: "STRING", enum: [...proposalFieldNames] },
          value: { type: "STRING" },
        },
        required: ["field", "value"],
      },
    },
    reminders: {
      type: "ARRAY",
      maxItems: 4,
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          dueInDays: { type: "INTEGER" },
          // The date the note named, copied as written. Repeating a date is
          // something a model can do; counting the days to it is not.
          dueOn: { type: "STRING" },
        },
        required: ["text", "dueInDays", "dueOn"],
      },
    },
    classes: {
      type: "ARRAY",
      maxItems: 8,
      items: { type: "STRING" },
    },
    leftover: { type: "STRING" },
  },
  required: ["notes", "fields", "reminders", "classes", "leftover"],
};

/**
 * Plain lines rather than a structure: three suggestions, one per line.
 * Anything at all going wrong comes back as an empty list, so a caller can
 * treat "no model" and "a bad day at Google" the same way.
 */
export async function writeWithGemini({
  instructions,
  prompt,
  lines = 3,
}: {
  instructions: string;
  prompt: string;
  lines?: number;
}): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: instructions }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return (payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
      .split(/\r?\n/)
      // Models like to number a list even when told not to.
      .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
      .filter(Boolean)
      .slice(0, lines);
  } catch {
    return [];
  }
}

export type GeminiResult =
  | { proposal: UpdateProposal }
  | { proposal: null; reason: "unavailable" | "rate-limited" | "failed" };

export async function sortUpdateWithGemini({
  instructions,
  context,
  text,
}: {
  instructions: string;
  context: string;
  text: string;
}): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { proposal: null, reason: "unavailable" };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // In the header rather than the query string, where it would be
        // written into every access log between here and Google.
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: instructions }] },
        contents: [{ parts: [{ text: `${context}\n\nThe note:\n${text}` }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0,
          maxOutputTokens: 900,
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (response.status === 429) return { proposal: null, reason: "rate-limited" };
    if (!response.ok) return { proposal: null, reason: "failed" };

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const body = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!body) return { proposal: null, reason: "failed" };

    const proposal = normalizeProposal(JSON.parse(body));
    return proposal ? { proposal } : { proposal: null, reason: "failed" };
  } catch {
    // A timeout, a network error, or an answer that was not JSON after all.
    return { proposal: null, reason: "failed" };
  }
}
