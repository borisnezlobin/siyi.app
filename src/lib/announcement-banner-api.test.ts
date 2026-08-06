import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const requireAuthenticatedRequest = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAuthenticatedRequest: (request: NextRequest) =>
    requireAuthenticatedRequest(request),
}));

const { GET } = await import("@/app/api/announcements/route");

type QueryResult = { data: unknown; error: { code: string } | null; count?: number };

/**
 * A stand-in for the PostgREST builder: every filter returns itself and the
 * whole chain resolves to whatever the table was configured to answer.
 */
function stubSupabase(tables: Record<string, QueryResult>) {
  return {
    from(table: string) {
      const result = tables[table] ?? { data: [], error: null };
      const builder: Record<string, unknown> = {
        then: (resolve: (value: QueryResult) => unknown) => resolve(result),
      };
      for (const method of [
        "select",
        "eq",
        "lte",
        "gte",
        "is",
        "order",
        "limit",
        "maybeSingle",
      ]) {
        builder[method] = () => builder;
      }
      return builder;
    },
  };
}

const request = {} as NextRequest;

describe("the banner endpoint when migration 0011 has not run", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns no announcements instead of failing", async () => {
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: "user-1", email: "someone@example.com" },
      supabase: stubSupabase({
        announcements: { data: null, error: { code: "PGRST205" } },
      }),
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ announcements: [] });
  });

  it("returns no announcements for a signed-out visitor", async () => {
    requireAuthenticatedRequest.mockRejectedValue(
      new Error("Authentication required"),
    );

    const response = await GET(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ announcements: [] });
  });

  it("shows a live announcement only to a matching segment", async () => {
    const announcement = {
      id: "announcement-1",
      title: "Push is here",
      body: "Turn it on in Settings.",
      segment: "many-contacts",
      starts_at: "2026-01-01T00:00:00.000Z",
      ends_at: null,
    };

    async function visibleFor(contactCount: number) {
      requireAuthenticatedRequest.mockResolvedValue({
        user: { id: "user-1", email: "someone@example.com" },
        supabase: stubSupabase({
          announcements: { data: [announcement], error: null },
          announcement_dismissals: { data: [], error: null },
          people: { data: { created_at: null }, error: null, count: contactCount },
          interactions: { data: null, error: null },
          push_subscriptions: { data: null, error: null, count: 0 },
          native_push_subscriptions: {
            data: null,
            error: { code: "PGRST205" },
            count: 0,
          },
          user_profiles: {
            data: { created_at: "2026-01-01T00:00:00.000Z" },
            error: null,
          },
        }),
      });
      const payload = (await (await GET(request)).json()) as {
        announcements: { id: string }[];
      };
      return payload.announcements.map((item) => item.id);
    }

    await expect(visibleFor(150)).resolves.toEqual(["announcement-1"]);
    await expect(visibleFor(4)).resolves.toEqual([]);
  });
});
