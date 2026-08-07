import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authState: { userId: string | null; upserted: Record<string, unknown>[] } = {
  userId: "user-1",
  upserted: [],
};

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedUser: async () => {
    if (!authState.userId) throw new Error("Sign in first.");
    return { id: authState.userId };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      upsert: (row: Record<string, unknown>) => {
        authState.upserted.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

const { PATCH } = await import("./route");

function patch(body: unknown) {
  return new NextRequest("http://localhost/api/settings/own-card", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authState.upserted = [];
  authState.userId = "user-1";
});

describe("saving your own card", () => {
  it("accepts a card with only some fields filled in", async () => {
    const response = await PATCH(
      patch({
        card: {
          fullName: "Boris Nezlobin",
          email: "borisn@berkeley.edu",
          major: "Applied Mathematics, IEOR",
        },
        enabled: true,
      }),
    );

    expect(response.status).toBe(200);
    expect(authState.upserted[0].own_card).toEqual({
      fullName: "Boris Nezlobin",
      email: "borisn@berkeley.edu",
      major: "Applied Mathematics, IEOR",
    });
  });

  it("drops keys it does not recognise rather than refusing the save", async () => {
    const response = await PATCH(patch({ card: { email: "a@b.c", nickname: "x" } }));

    expect(response.status).toBe(200);
    expect(authState.upserted[0].own_card).toEqual({ email: "a@b.c" });
  });

  it("names the field when something is genuinely wrong", async () => {
    const response = await PATCH(patch({ card: { email: "a".repeat(201) } }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Email");
  });

  it("stores an empty card without complaint", async () => {
    const response = await PATCH(patch({ card: {} }));
    expect(response.status).toBe(200);
    expect(authState.upserted[0].own_card).toEqual({});
  });
});
