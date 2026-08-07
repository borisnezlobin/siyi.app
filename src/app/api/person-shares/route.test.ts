import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = { supabase: null as unknown };

vi.mock("@/lib/api-auth", () => ({
  requireAuthenticatedRequest: async () => ({
    user: { id: "owner-1" },
    supabase: authState.supabase,
    accessToken: null,
  }),
}));

const { POST } = await import("@/app/api/person-shares/route");

type Result = { data: unknown; error: { code?: string; message?: string } | null };

function supabaseReturning(result: Result) {
  const inserted: Record<string, unknown>[] = [];

  const chain = {
    eq: () => chain,
    is: () => chain,
    order: () => chain,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: Result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };

  // The route reads the person first, for the name in the link.
  const personChain = {
    eq: () => personChain,
    maybeSingle: () => Promise.resolve({ data: { full_name: "Wei Zhang" }, error: null }),
  };

  return {
    inserted,
    client: {
      from: (table: string) => ({
        select: () => (table === "people" ? personChain : chain),
        insert: (row: Record<string, unknown>) => {
          inserted.push(row);
          return { select: () => chain };
        },
      }),
    },
  };
}

function createRequest(body: unknown) {
  return new NextRequest("http://localhost/api/person-shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const personId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  authState.supabase = null;
});

describe("creating a share link once the table exists", () => {
  it("stores a fresh token, the selection and a thirty day expiry", async () => {
    const created = {
      id: "share-1",
      person_id: personId,
      token: "a".repeat(32),
      fields: { hometown: true },
      expires_at: "2026-09-05T00:00:00.000Z",
      revoked_at: null,
      last_viewed_at: null,
      view_count: 0,
      created_at: "2026-08-06T00:00:00.000Z",
    };
    const { client, inserted } = supabaseReturning({
      data: created,
      error: null,
    });
    authState.supabase = client;

    const response = await POST(
      createRequest({ personId, selection: { hometown: true, bio: true } }),
    );

    expect(response.status).toBe(201);
    expect(inserted[0].token).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(inserted[0].fields).toEqual({
      preferredName: false,
      phoneNumber: false,
      email: false,
      instagram: false,
      birthday: false,
      hometown: true,
      university: false,
      major: false,
      notes: false,
      bio: false,
    });

    const expiresAt = Date.parse(String(inserted[0].expires_at));
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(expiresAt - Date.now()).toBeGreaterThan(thirtyDays - 60_000);
    expect(expiresAt - Date.now()).toBeLessThan(thirtyDays + 60_000);
  });

  it("mints a different token every time", async () => {
    const { client, inserted } = supabaseReturning({
      data: {
        id: "share-1",
        person_id: personId,
        token: "a".repeat(32),
        fields: {},
        expires_at: null,
        revoked_at: null,
        last_viewed_at: null,
        view_count: 0,
        created_at: "2026-08-06T00:00:00.000Z",
      },
      error: null,
    });
    authState.supabase = client;

    await POST(createRequest({ personId }));
    await POST(createRequest({ personId }));

    expect(inserted[0].token).not.toBe(inserted[1].token);
  });

  it("rejects a body without a person", async () => {
    const { client } = supabaseReturning({ data: null, error: null });
    authState.supabase = client;

    expect((await POST(createRequest({}))).status).toBe(400);
  });
});
