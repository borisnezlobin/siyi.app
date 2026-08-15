import { searchEverything } from "@/lib/search-data";
import type { SearchResultRow } from "@/lib/search";

const mockIsOnline = jest.fn(async () => true);
const mockRpc = jest.fn();

jest.mock("@/lib/offline-store", () => ({
  isOnline: () => mockIsOnline(),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

type RpcResult = { data: SearchResultRow[] | null; error: { code?: string; message: string } | null };

function answers(result: RpcResult) {
  mockRpc.mockResolvedValue(result);
}

const row: SearchResultRow = {
  kind: "note",
  record_id: "note-1",
  person_ids: ["person-1"],
  title: "Coffee at Blue Bottle",
  snippet: "She is moving to Lisbon in the spring.",
  occurred_at: "2026-03-02T18:00:00.000Z",
  rank: 0.61,
};

beforeEach(() => {
  mockIsOnline.mockClear();
  mockIsOnline.mockResolvedValue(true);
  mockRpc.mockReset();
  answers({ data: [], error: null });
});

describe("what searchEverything asks the database", () => {
  it("answers a blank query itself rather than asking the database for nothing", async () => {
    expect(await searchEverything("")).toEqual({ status: "ready", results: [] });
    expect(await searchEverything("   \n\t ")).toEqual({ status: "ready", results: [] });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("sends the trimmed query and the limit it was given", async () => {
    answers({ data: [row], error: null });

    await searchEverything("  lisbon  ", 12);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls[0]).toEqual([
      "search_everything",
      { search_query: "lisbon", result_limit: 12 },
    ]);
  });

  it("returns the rows named the way the rest of the app reads them", async () => {
    answers({ data: [row], error: null });

    expect(await searchEverything("lisbon")).toEqual({
      status: "ready",
      results: [
        {
          kind: "note",
          recordId: "note-1",
          personIds: ["person-1"],
          title: "Coffee at Blue Bottle",
          snippet: "She is moving to Lisbon in the spring.",
          occurredAt: "2026-03-02T18:00:00.000Z",
          rank: 0.61,
        },
      ],
    });
  });

  it("drops a row of a kind this version of the app cannot open", async () => {
    answers({
      data: [row, { ...row, kind: "podcast", record_id: "podcast-1" }],
      error: null,
    });

    const outcome = await searchEverything("lisbon");

    expect(outcome).toEqual({
      status: "ready",
      results: [expect.objectContaining({ kind: "note", recordId: "note-1" })],
    });
  });
});

describe("what searchEverything does when it cannot search", () => {
  it("says it is offline without spending a request to find out", async () => {
    mockIsOnline.mockResolvedValue(false);

    expect(await searchEverything("lisbon")).toEqual({ status: "offline" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("treats a missing database function as the feature not being switched on", async () => {
    answers({ data: null, error: { code: "42883", message: "function search_everything does not exist" } });

    expect(await searchEverything("lisbon")).toEqual({ status: "unavailable" });
  });

  it("treats PostgREST not finding the function in its schema cache the same way", async () => {
    answers({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });

    expect(await searchEverything("lisbon")).toEqual({ status: "unavailable" });
  });

  it("throws anything else, rather than hiding a real failure as an empty result", async () => {
    answers({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } });

    await expect(searchEverything("lisbon")).rejects.toThrow(
      "duplicate key value violates unique constraint",
    );
  });
});
