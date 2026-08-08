import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geminiConfigured, sortUpdateWithGemini } from "@/lib/gemini";

const request = { instructions: "sort it", context: "today is x", text: "is from boulder" };

function answering(body: unknown, init: { status?: number } = {}) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function candidate(text: unknown) {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(text) }] } }] };
}

describe("sortUpdateWithGemini", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    vi.unstubAllGlobals();
  });

  it("reports itself unavailable rather than failing when there is no key", async () => {
    delete process.env.GEMINI_API_KEY;
    expect(geminiConfigured()).toBe(false);
    expect(await sortUpdateWithGemini(request)).toEqual({
      proposal: null,
      reason: "unavailable",
    });
  });

  it("sends the key in the header, never in the address", async () => {
    const fetchMock = answering(candidate({ notes: [], fields: [], reminders: [], leftover: "" }));
    vi.stubGlobal("fetch", fetchMock);

    await sortUpdateWithGemini(request);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("test-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
  });

  it("returns the proposal it was given", async () => {
    vi.stubGlobal(
      "fetch",
      answering(
        candidate({
          notes: [{ heading: "Interests", text: "snowboarding" }],
          fields: [{ field: "hometown", value: "Boulder" }],
          reminders: [],
          leftover: "",
        }),
      ),
    );

    const result = await sortUpdateWithGemini(request);

    expect(result.proposal?.fields).toEqual([{ field: "hometown", value: "Boulder" }]);
  });

  it("drops a field the model was not allowed to name", async () => {
    vi.stubGlobal(
      "fetch",
      answering(
        candidate({
          notes: [],
          fields: [{ field: "relationshipStrength", value: "5" }],
          reminders: [],
          leftover: "",
        }),
      ),
    );

    const result = await sortUpdateWithGemini(request);

    expect(result.proposal?.fields).toEqual([]);
  });

  it("tells a rate limit apart from a failure, so the caller can say so", async () => {
    vi.stubGlobal("fetch", answering({}, { status: 429 }));
    expect(await sortUpdateWithGemini(request)).toEqual({
      proposal: null,
      reason: "rate-limited",
    });
  });

  it("degrades rather than throwing when the answer is not usable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json at all", { status: 200 })),
    );
    expect(await sortUpdateWithGemini(request)).toEqual({ proposal: null, reason: "failed" });
  });

  it("degrades when the network does", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await sortUpdateWithGemini(request)).toEqual({ proposal: null, reason: "failed" });
  });
});
