import { beforeEach, describe, expect, it, vi } from "vitest";

const queryResult = { data: null as unknown, error: null as unknown };

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        limit: () => builder,
        order: () => builder,
        then: (resolve: (value: unknown) => unknown) => resolve(queryResult),
      };
      return builder;
    },
  }),
}));

const { getPersonNoteSections, getUsedNoteHeadings } = await import("@/lib/data");

beforeEach(() => {
  queryResult.data = null;
  queryResult.error = null;
});

describe("named note sections before migration 0010 has run", () => {
  it("reports the feature as unavailable instead of throwing", async () => {
    queryResult.error = { code: "42P01", message: "relation does not exist" };
    await expect(getPersonNoteSections("person-1")).resolves.toEqual({
      available: false,
      sections: [],
    });
  });

  it("suggests nothing rather than failing the page", async () => {
    queryResult.error = { code: "PGRST205", message: "unknown table" };
    await expect(getUsedNoteHeadings()).resolves.toEqual([]);
  });

  it("still surfaces real database problems", async () => {
    queryResult.error = { code: "23505", message: "duplicate key" };
    await expect(getPersonNoteSections("person-1")).rejects.toThrow(
      "duplicate key",
    );
  });
});

describe("named note sections once the table exists", () => {
  it("returns sections in saved order", async () => {
    queryResult.data = [
      {
        id: "second",
        person_id: "person-1",
        user_id: "user-1",
        heading: "Things mentioned",
        body: null,
        position: 1,
        created_at: "2026-01-02T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "first",
        person_id: "person-1",
        user_id: "user-1",
        heading: "Interests",
        body: "Climbing",
        position: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ];

    const result = await getPersonNoteSections("person-1");
    expect(result.available).toBe(true);
    expect(result.sections.map((section) => section.id)).toEqual([
      "first",
      "second",
    ]);
    expect(result.sections[1].body).toBe("");
  });

  it("collects each heading once, newest first", async () => {
    queryResult.data = [
      { heading: "Interests", updated_at: "2026-03-01T00:00:00.000Z" },
      { heading: "interests", updated_at: "2026-02-01T00:00:00.000Z" },
      { heading: "  ", updated_at: "2026-01-03T00:00:00.000Z" },
      { heading: "Things mentioned", updated_at: "2026-01-02T00:00:00.000Z" },
    ];

    await expect(getUsedNoteHeadings()).resolves.toEqual([
      "Interests",
      "Things mentioned",
    ]);
  });
});
