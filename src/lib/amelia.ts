/**
 * Client for the Amelia conversation-capture service. Amelia runs as its own
 * long-lived process (WebSocket audio ingest, MongoDB Atlas voiceprints), so
 * siyi talks to its HTTP API rather than importing any of it. Types mirror
 * Amelia's shared/contracts.ts. Server-side only: AMELIA_API_URL must never
 * reach the browser.
 *
 * One Amelia instance belongs to one siyi user. Amelia has no tenant concept —
 * its /people and /conversations are the whole database — so pointing several
 * siyi accounts at the same instance would let each of them read all of it.
 * AMELIA_API_KEY, when set, is sent as a bearer token for the day Amelia
 * checks one.
 */

const AMELIA_TIMEOUT_MS = 10_000;
const UPDATE_TEXT_LIMIT = 2000;

export type AmeliaPerson = {
  _id: string;
  name: string;
  relationship?: string;
  is_owner?: boolean;
  created_at: string;
  updated_at: string;
};

export type AmeliaConversation = {
  _id: string;
  started_at: string;
  ended_at?: string;
  title?: string;
  participant_ids: string[];
};

export type AmeliaUtterance = {
  _id: string;
  conversation_id: string;
  person_id?: string;
  text: string;
  start_ms: number;
  end_ms: number;
  is_final: boolean;
};

export type AmeliaConversationSummary = {
  conversation: AmeliaConversation;
  utterances: AmeliaUtterance[];
  participants: AmeliaPerson[];
};

export function ameliaConfigured() {
  return Boolean(process.env.AMELIA_API_URL);
}

async function ameliaRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = process.env.AMELIA_API_URL;
  if (!baseUrl) throw new Error("Amelia is not configured.");

  const apiKey = process.env.AMELIA_API_KEY;
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      ...init?.headers,
    },
    signal: AbortSignal.timeout(AMELIA_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Amelia request failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

export function getAmeliaPeople() {
  return ameliaRequest<AmeliaPerson[]>("/people");
}

export function getAmeliaConversations() {
  return ameliaRequest<AmeliaConversation[]>("/conversations");
}

export function getAmeliaConversation(id: string) {
  return ameliaRequest<AmeliaConversationSummary>(
    `/conversations/${encodeURIComponent(id)}`,
  );
}

/**
 * Push a siyi name back to Amelia. Amelia re-files every past utterance under
 * the new name, which is exactly what linking an "Unknown" speaker should do.
 */
export function nameAmeliaPerson(id: string, name: string) {
  return ameliaRequest<AmeliaPerson>(
    `/people/${encodeURIComponent(id)}/name`,
    { method: "POST", body: JSON.stringify({ name }) },
  );
}

/**
 * A conversation becomes one person update shared by every linked speaker.
 * person_updates.text is capped at 2000 characters, so the transcript is a
 * digest, not an archive — Amelia keeps the full record.
 */
export function buildConversationUpdateText(
  summary: AmeliaConversationSummary,
): string {
  const nameById = new Map(
    summary.participants.map((participant) => [participant._id, participant.name]),
  );
  const heading = summary.conversation.title?.trim() || "Conversation";
  const lines = [`Amelia captured: ${heading}`];

  for (const utterance of summary.utterances) {
    if (!utterance.is_final) continue;
    const text = utterance.text.trim();
    if (!text) continue;
    const speaker =
      (utterance.person_id && nameById.get(utterance.person_id)) ||
      "Unknown speaker";
    lines.push(`${speaker}: ${text}`);
  }

  const full = lines.join("\n");
  if (full.length <= UPDATE_TEXT_LIMIT) return full;
  // Cutting between the halves of a surrogate pair would store a lone
  // surrogate, so the cut moves in front of the pair.
  let cut = UPDATE_TEXT_LIMIT - 1;
  const beforeCut = full.charCodeAt(cut - 1);
  if (beforeCut >= 0xd800 && beforeCut <= 0xdbff) cut -= 1;
  return `${full.slice(0, cut)}…`;
}
