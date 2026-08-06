import { beforeEach, describe, expect, it, vi } from "vitest";

const lookups: { column: string; value: string }[] = [];
let queryResult: { data: unknown; error: { code: string } | null } = {
  data: null,
  error: null,
};

// Reading a person also reads their contact rows; only the lookup against
// `people` is what these tests are about.
let currentTable = "people";

const queryBuilder = {
  select: () => queryBuilder,
  order: () => queryBuilder,
  limit: () => queryBuilder,
  eq: (column: string, value: string) => {
    if (currentTable === "people") lookups.push({ column, value });
    return queryBuilder;
  },
  single: async () => queryResult,
};

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      currentTable = table;
      return queryBuilder;
    },
  }),
}));

vi.mock("@/lib/avatar-urls", () => ({
  resolveAvatarUrls: async () => new Map<string, string>(),
  resolvedAvatarUrl: (reference: string | null) => reference,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { getPerson } = await import("@/lib/data");

const personId = "3f2b6a1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";

function personRow(overrides: Record<string, unknown> = {}) {
  return {
    id: personId,
    user_id: "user",
    full_name: "Boris Nezlobin",
    preferred_name: null,
    profile_photo_url: null,
    instagram_username: null,
    phone_number: null,
    email: null,
    birthday: null,
    hometown: null,
    dorm_or_residence: null,
    major: null,
    graduation_year: null,
    relationship_strength: 2,
    relationship_label: null,
    reminders_enabled: true,
    reminder_interval_days: null,
    status: "active",
    first_met_at: "2026-01-01T00:00:00.000Z",
    first_met_location: null,
    general_notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  lookups.length = 0;
  queryResult = { data: null, error: null };
});

describe("getPerson", () => {
  it("looks a uuid up by id", async () => {
    queryResult = {
      data: personRow({ slug: "boris-nezlobin-7fk2" }),
      error: null,
    };
    const person = await getPerson(personId);

    expect(lookups).toEqual([{ column: "id", value: personId }]);
    expect(person.slug).toBe("boris-nezlobin-7fk2");
  });

  it("looks anything else up by slug", async () => {
    queryResult = {
      data: personRow({ slug: "boris-nezlobin-7fk2" }),
      error: null,
    };
    await getPerson("boris-nezlobin-7fk2");

    expect(lookups).toEqual([
      { column: "slug", value: "boris-nezlobin-7fk2" },
    ]);
  });

  it("still resolves a uuid when migration 0012 has not run", async () => {
    queryResult = { data: personRow(), error: null };
    const person = await getPerson(personId);

    expect(lookups).toEqual([{ column: "id", value: personId }]);
    expect(person.slug).toBeNull();
    expect(person.id).toBe(personId);
  });

  it("404s rather than throwing when the slug column is missing", async () => {
    queryResult = { data: null, error: { code: "42703" } };
    await expect(getPerson("boris-nezlobin-7fk2")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});
