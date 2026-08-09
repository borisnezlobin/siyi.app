import { classifyUpdate, sourceLabel } from "@/lib/update-classifier";
import type { UpdateProposal } from "@/lib/update-proposal";

const proposal: UpdateProposal = {
  notes: [{ heading: "Interests", text: "snowboarding" }],
  fields: [],
  reminders: [],
  classes: [],
  leftover: "",
};

const input = { context: "today is x", text: "likes snowboarding" };

describe("classifyUpdate", () => {
  it("uses the phone's own model and never asks the server", async () => {
    const onServer = jest.fn(async () => proposal);

    const result = await classifyUpdate({
      ...input,
      onDevice: async () => proposal,
      onServer,
    });

    expect(result).toEqual({ proposal, source: "device" });
    expect(onServer).not.toHaveBeenCalled();
  });

  it("falls back to the server when there is no model on the phone", async () => {
    const result = await classifyUpdate({
      ...input,
      onDevice: async () => null,
      onServer: async () => proposal,
    });

    expect(result).toEqual({ proposal, source: "server" });
  });

  it("falls back when the phone's model throws rather than declining", async () => {
    const result = await classifyUpdate({
      ...input,
      onDevice: async () => {
        throw new Error("guardrail");
      },
      onServer: async () => proposal,
    });

    expect(result.source).toBe("server");
  });

  it("gives up quietly when there is no server to ask", async () => {
    const result = await classifyUpdate({
      ...input,
      onDevice: async () => null,
      onServer: null,
    });

    expect(result).toEqual({ proposal: null, source: "none" });
  });

  it("gives up quietly when the server cannot be reached", async () => {
    const result = await classifyUpdate({
      ...input,
      onDevice: async () => null,
      onServer: async () => {
        throw new Error("offline");
      },
    });

    expect(result).toEqual({ proposal: null, source: "none" });
  });
});

describe("sourceLabel", () => {
  it("says where the sorting happened, and nothing when it did not", () => {
    expect(sourceLabel("device")).toBe("Sorted on your phone");
    expect(sourceLabel("server")).toBe("Sorted by Siyi");
    expect(sourceLabel("none")).toBeNull();
  });
});
