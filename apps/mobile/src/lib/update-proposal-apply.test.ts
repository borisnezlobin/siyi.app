import {
  applyResultMessage,
  applyUpdateProposal,
  type UpdateProposalClient,
} from "@/lib/update-proposal-apply";
import type { ProposalPlan } from "@/lib/update-proposal";

function recordingClient(overrides: Partial<UpdateProposalClient> = {}) {
  const calls: string[] = [];
  const client: UpdateProposalClient = {
    createUpdate: async () => void calls.push("update"),
    saveFields: async () => void calls.push("fields"),
    appendToNote: async () => void calls.push("append"),
    createNote: async () => void calls.push("create-note"),
    createReminder: async () => void calls.push("reminder"),
    ...overrides,
  };
  return { calls, client };
}

const plan: ProposalPlan = {
  noteAppends: [{ noteId: "note-1", heading: "Interests", text: "snowboarding" }],
  noteCreates: [{ heading: "Food", text: "hates cilantro" }],
  fields: [{ field: "hometown", value: "Boulder" }],
  reminders: [{ text: "robotics comp", dueAt: "2026-08-16T09:00:00.000Z" }],
};

describe("applyUpdateProposal", () => {
  it("writes the typed sentence before anything derived from it", async () => {
    const { calls, client } = recordingClient();

    await applyUpdateProposal(client, { text: "is from boulder", plan });

    expect(calls[0]).toBe("update");
    expect(calls).toEqual(["update", "fields", "append", "create-note", "reminder"]);
  });

  it("carries on when one part is refused, and names it", async () => {
    const { calls, client } = recordingClient({
      saveFields: async () => {
        throw new Error("no");
      },
    });

    const result = await applyUpdateProposal(client, { text: "x", plan });

    expect(result.failed).toEqual(["the profile details"]);
    expect(result.applied).toBe(3);
    // The reminder was approved too; a bad field must not take it down.
    expect(calls).toContain("reminder");
  });

  it("stops when the words themselves could not be saved", async () => {
    const { calls, client } = recordingClient({
      createUpdate: async () => {
        throw new Error("offline");
      },
    });

    const result = await applyUpdateProposal(client, { text: "x", plan });

    expect(result).toEqual({ applied: 0, failed: ["the update itself"] });
    expect(calls).toEqual([]);
  });

  it("writes nothing but the parts when there is no sentence left over", async () => {
    const createUpdate = jest.fn();
    const { client } = recordingClient({ createUpdate });

    await applyUpdateProposal(client, { text: "   ", plan });

    expect(createUpdate).not.toHaveBeenCalled();
  });
});

describe("applyResultMessage", () => {
  it("says nothing when everything landed", () => {
    expect(applyResultMessage({ applied: 4, failed: [] })).toBeNull();
  });

  it("names one failure, and lists several", () => {
    expect(applyResultMessage({ applied: 1, failed: ["the reminder"] })).toBe(
      "Saved, except the reminder.",
    );
    expect(applyResultMessage({ applied: 1, failed: ["Interests", "the reminder"] })).toBe(
      "Saved, except Interests and the reminder.",
    );
  });

  it("does not repeat the same failure twice", () => {
    expect(applyResultMessage({ applied: 0, failed: ["Interests", "Interests"] })).toBe(
      "Saved, except Interests.",
    );
  });
});
