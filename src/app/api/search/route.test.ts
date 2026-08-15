import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchResultRow } from "@/lib/search";

const authState = {
  supabase: null as unknown,
  throws: null as Error | null,
};

const configState = { configured: true };

vi.mock("@/lib/api-auth", () => ({
  requireAuthenticatedRequest: async () => {
    if (authState.throws) throw authState.throws;
    return {
      user: { id: "owner-1" },
      supabase: authState.supabase,
      accessToken: null,
    };
  },
}));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => configState.configured,
}));

const { GET } = await import("@/app/api/search/route");

type RpcCall = { name: string; args: Record<string, unknown> };
type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

function supabaseReturning(result: RpcResult) {
  const calls: RpcCall[] = [];

  return {
    calls,
    client: {
      rpc: (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return Promise.resolve(result);
      },
    },
  };
}

function createRequest(search: string) {
  return new NextRequest(`http://localhost/api/search${search}`);
}

const maya = "30000000-0000-4000-8000-000000000001";
const noah = "30000000-0000-4000-8000-000000000002";

function row(overrides: Partial<SearchResultRow> = {}): SearchResultRow {
  return {
    kind: "update",
    record_id: "update-1",
    person_ids: [maya],
    title: "Climbing at the gym",
    snippet: "we went climbing on tuesday",
    occurred_at: "2026-05-01T20:00:00.000Z",
    rank: 0.8,
    ...overrides,
  };
}

beforeEach(() => {
  authState.supabase = null;
  authState.throws = null;
  configState.configured = true;
});

describe("answering a search", () => {
  it("returns the mapped rows and says search is available", async () => {
    const { client } = supabaseReturning({
      data: [
        row(),
        row({
          kind: "person",
          record_id: maya,
          person_ids: [maya, noah],
          title: "Maya Chen",
          snippet: null,
          occurred_at: null,
          rank: 0.5,
        }),
      ],
      error: null,
    });
    authState.supabase = client;

    const response = await GET(createRequest("?q=climbing"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.available).toBe(true);
    expect(body.results).toEqual([
      {
        kind: "update",
        recordId: "update-1",
        personIds: [maya],
        title: "Climbing at the gym",
        snippet: "we went climbing on tuesday",
        occurredAt: "2026-05-01T20:00:00.000Z",
        rank: 0.8,
      },
      {
        kind: "person",
        recordId: maya,
        personIds: [maya, noah],
        title: "Maya Chen",
        snippet: null,
        occurredAt: null,
        rank: 0.5,
      },
    ]);
  });

  it("asks the database for the trimmed query and the default limit", async () => {
    const { client, calls } = supabaseReturning({ data: [], error: null });
    authState.supabase = client;

    await GET(createRequest("?q=%20%20climbing%20%20"));

    expect(calls).toEqual([
      { name: "search_everything", args: { search_query: "climbing", result_limit: 40 } },
    ]);
  });

  it("drops rows whose kind this version of the client does not know", async () => {
    const { client } = supabaseReturning({
      data: [
        row(),
        row({ kind: "podcast", record_id: "podcast-1" }),
        row({ kind: null, record_id: "mystery-1" }),
        row({ record_id: null }),
      ],
      error: null,
    });
    authState.supabase = client;

    const body = await (await GET(createRequest("?q=climbing"))).json();

    expect(body.available).toBe(true);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].recordId).toBe("update-1");
  });
});

describe("a query with nothing in it", () => {
  it("returns an empty available result without touching the database", async () => {
    const { client, calls } = supabaseReturning({ data: [row()], error: null });
    authState.supabase = client;

    const body = await (await GET(createRequest(""))).json();

    expect(body).toEqual({ results: [], available: true });
    expect(calls).toEqual([]);
  });

  it("treats a whitespace-only query the same as no query at all", async () => {
    const { client, calls } = supabaseReturning({ data: [row()], error: null });
    authState.supabase = client;

    const response = await GET(createRequest("?q=%20%20%20"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [], available: true });
    expect(calls).toEqual([]);
  });
});

describe("choosing how many results to ask for", () => {
  async function limitFor(search: string) {
    const { client, calls } = supabaseReturning({ data: [], error: null });
    authState.supabase = client;

    await GET(createRequest(search));

    return calls[0]?.args.result_limit;
  }

  it("passes a limit inside the allowed range through unchanged", async () => {
    expect(await limitFor("?q=climbing&limit=12")).toBe(12);
  });

  it("raises a limit below one up to one", async () => {
    expect(await limitFor("?q=climbing&limit=0")).toBe(1);
    expect(await limitFor("?q=climbing&limit=-25")).toBe(1);
  });

  it("caps a limit above two hundred at two hundred", async () => {
    expect(await limitFor("?q=climbing&limit=5000")).toBe(200);
  });

  it("falls back to forty when the limit is not a number", async () => {
    expect(await limitFor("?q=climbing&limit=lots")).toBe(40);
    expect(await limitFor("?q=climbing&limit=")).toBe(40);
  });
});

describe("when the database cannot answer", () => {
  it("tells the caller search is unavailable when the migration has not run", async () => {
    const { client } = supabaseReturning({
      data: null,
      error: { code: "42883", message: "function search_everything does not exist" },
    });
    authState.supabase = client;

    const response = await GET(createRequest("?q=climbing"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [], available: false });
  });

  it("tells the caller search is unavailable when postgrest cannot find the function", async () => {
    const { client } = supabaseReturning({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function in the schema cache" },
    });
    authState.supabase = client;

    const response = await GET(createRequest("?q=climbing"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [], available: false });
  });

  it("reports an unrelated database failure as a bad request with its message", async () => {
    const { client } = supabaseReturning({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    authState.supabase = client;

    const response = await GET(createRequest("?q=climbing"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "duplicate key value violates unique constraint",
    });
  });
});

describe("before there is anyone to search for", () => {
  it("rejects a request that is not signed in", async () => {
    const { client, calls } = supabaseReturning({ data: [row()], error: null });
    authState.supabase = client;
    authState.throws = new Error("Not authenticated.");

    const response = await GET(createRequest("?q=climbing"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated." });
    expect(calls).toEqual([]);
  });

  it("says search is unavailable when there is no database configured", async () => {
    configState.configured = false;
    const { client, calls } = supabaseReturning({ data: [row()], error: null });
    authState.supabase = client;
    authState.throws = new Error("this should never be reached");

    const response = await GET(createRequest("?q=climbing"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [], available: false });
    expect(calls).toEqual([]);
  });
});
