import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { saveContactMethods } from "@/app/api/people/contact-methods";
import type { ContactMethodDraft } from "@/lib/contact-methods";

type Row = Record<string, unknown>;

function fakeSupabase(
  existing: { id: string }[],
  selectError: { code: string; message: string } | null = null,
) {
  const upserted: Row[][] = [];
  const deleted: string[][] = [];

  const client = {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: existing, error: selectError }),
      }),
      upsert: async (rows: Row[]) => {
        upserted.push(rows);
        return { error: null };
      },
      delete: () => ({
        eq: () => ({
          in: async (_column: string, ids: string[]) => {
            deleted.push(ids);
            return { error: null };
          },
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  return { client, upserted, deleted };
}

const drafts: ContactMethodDraft[] = [
  { kind: "phone", value: "4155550134", label: null, isPrimary: true },
  { kind: "phone", value: "2125559999", label: "work", isPrimary: false },
  { kind: "email", value: "maya@example.edu", label: null, isPrimary: false },
];

describe("saving someone's contact rows", () => {
  it("writes one row per value, numbered within its kind", async () => {
    const { client, upserted } = fakeSupabase([]);
    const result = await saveContactMethods(client, "u1", "p1", drafts);

    expect(result).toEqual({ available: true });
    expect(upserted).toHaveLength(1);
    expect(upserted[0]).toHaveLength(3);
    expect(
      upserted[0].map((row) => [row.kind, row.value, row.position, row.is_primary]),
    ).toEqual([
      ["phone", "4155550134", 0, true],
      ["phone", "2125559999", 1, false],
      ["email", "maya@example.edu", 0, true],
    ]);
    expect(upserted[0].every((row) => row.user_id === "u1")).toBe(true);
    expect(upserted[0].every((row) => row.person_id === "p1")).toBe(true);
  });

  it("keeps the id a row already had, and deletes the rows that went away", async () => {
    const { client, upserted, deleted } = fakeSupabase([
      { id: "kept" },
      { id: "removed" },
    ]);
    await saveContactMethods(client, "u1", "p1", [
      { id: "kept", kind: "phone", value: "4155550134", label: null, isPrimary: true },
    ]);

    expect(upserted[0][0].id).toBe("kept");
    expect(deleted).toEqual([["removed"]]);
  });

  it("changes nothing, and reports no failure, until migration 0013 has run", async () => {
    const { client, upserted, deleted } = fakeSupabase([], {
      code: "42P01",
      message: 'relation "person_contact_methods" does not exist',
    });

    const result = await saveContactMethods(client, "u1", "p1", drafts);

    expect(result).toEqual({ available: false });
    expect(upserted).toEqual([]);
    expect(deleted).toEqual([]);
  });

  it("passes a real failure back rather than swallowing it", async () => {
    const { client } = fakeSupabase([], { code: "42501", message: "denied" });
    const result = await saveContactMethods(client, "u1", "p1", drafts);
    expect(result).toEqual({ available: true, error: "denied" });
  });

  it("clears every row when the person removed them all", async () => {
    const { client, upserted, deleted } = fakeSupabase([{ id: "gone" }]);
    await saveContactMethods(client, "u1", "p1", []);

    expect(upserted).toEqual([]);
    expect(deleted).toEqual([["gone"]]);
  });
});
