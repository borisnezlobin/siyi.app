import { describe, expect, it } from "vitest";
import {
  buildConversationUpdateText,
  type AmeliaConversationSummary,
} from "@/lib/amelia";

function summaryWith(
  utterances: { text: string; personId?: string; isFinal?: boolean }[],
  title?: string,
): AmeliaConversationSummary {
  return {
    conversation: {
      _id: "c1",
      started_at: "2026-08-19T18:00:00Z",
      title,
      participant_ids: ["p1", "p2"],
    },
    participants: [
      {
        _id: "p1",
        name: "Maya",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      },
      {
        _id: "p2",
        name: "Sam",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      },
    ],
    utterances: utterances.map((utterance, index) => ({
      _id: `u${index}`,
      conversation_id: "c1",
      person_id: utterance.personId,
      text: utterance.text,
      start_ms: index * 1000,
      end_ms: index * 1000 + 900,
      is_final: utterance.isFinal ?? true,
    })),
  };
}

describe("buildConversationUpdateText", () => {
  it("attributes lines to participants and titles the digest", () => {
    const text = buildConversationUpdateText(
      summaryWith(
        [
          { text: "Hi there", personId: "p1" },
          { text: "Hey Maya", personId: "p2" },
        ],
        "Catching up",
      ),
    );
    expect(text).toBe(
      "Amelia captured: Catching up\nMaya: Hi there\nSam: Hey Maya",
    );
  });

  it("skips non-final and empty turns and names unknown speakers", () => {
    const text = buildConversationUpdateText(
      summaryWith([
        { text: "draft", isFinal: false },
        { text: "   " },
        { text: "Who said this" },
      ]),
    );
    expect(text).toBe(
      "Amelia captured: Conversation\nUnknown speaker: Who said this",
    );
  });

  it("stays within the person_updates limit without splitting a surrogate pair", () => {
    const text = buildConversationUpdateText(
      summaryWith([{ text: "🦜".repeat(1200), personId: "p1" }]),
    );
    expect(text.length).toBeLessThanOrEqual(2000);
    expect(text.endsWith("…")).toBe(true);
    // A lone surrogate round-trips as U+FFFD; a clean cut never contains one.
    expect(text.includes("�")).toBe(false);
    for (const character of text) void character;
    expect(() => encodeURIComponent(text)).not.toThrow();
  });
});
