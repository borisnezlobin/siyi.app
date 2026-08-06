import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contactDraftsOf,
  contactFormValues,
  contactValuesOfKind,
  initialContactDrafts,
  draftsFromContactMethods,
  legacyColumnsFromDrafts,
  normalizeContactDrafts,
  parseContactDraftsJson,
  primaryContactValue,
  resolveContactDrafts,
  unavailableContactMethods,
  withPrimaryAt,
  withoutDraftAt,
  type ContactMethod,
  type ContactMethodDraft,
} from "@/lib/contact-methods";

function draft(
  overrides: Partial<ContactMethodDraft> & Pick<ContactMethodDraft, "kind" | "value">,
): ContactMethodDraft {
  return { label: null, isPrimary: false, ...overrides };
}

function primariesOf(drafts: ContactMethodDraft[], kind: "phone" | "email") {
  return drafts.filter((entry) => entry.kind === kind && entry.isPrimary);
}

describe("choosing a primary", () => {
  it("gives every kind that has rows exactly one primary", () => {
    const normalized = normalizeContactDrafts([
      draft({ kind: "phone", value: "4155550134" }),
      draft({ kind: "phone", value: "2125559999" }),
      draft({ kind: "email", value: "maya@example.edu" }),
    ]);

    expect(primariesOf(normalized, "phone")).toHaveLength(1);
    expect(primariesOf(normalized, "email")).toHaveLength(1);
    expect(primaryContactValue(normalized, "phone")).toBe("4155550134");
    expect(primaryContactValue(normalized, "instagram")).toBeNull();
  });

  it("keeps only the first row marked primary when several claim it", () => {
    const normalized = normalizeContactDrafts([
      draft({ kind: "phone", value: "4155550134" }),
      draft({ kind: "phone", value: "2125559999", isPrimary: true }),
      draft({ kind: "phone", value: "6175551212", isPrimary: true }),
    ]);

    expect(primariesOf(normalized, "phone")).toHaveLength(1);
    expect(primaryContactValue(normalized, "phone")).toBe("2125559999");
  });

  it("moves the primary between rows of the same kind only", () => {
    const drafts = normalizeContactDrafts([
      draft({ kind: "phone", value: "4155550134" }),
      draft({ kind: "phone", value: "2125559999" }),
      draft({ kind: "email", value: "maya@example.edu" }),
    ]);

    const moved = withPrimaryAt(drafts, 1);
    expect(primaryContactValue(moved, "phone")).toBe("2125559999");
    expect(primaryContactValue(moved, "email")).toBe("maya@example.edu");
  });

  it("hands the primary to the next row when the primary is deleted", () => {
    const drafts = normalizeContactDrafts([
      draft({ kind: "phone", value: "4155550134", isPrimary: true }),
      draft({ kind: "phone", value: "2125559999" }),
      draft({ kind: "email", value: "maya@example.edu", isPrimary: true }),
    ]);

    const remaining = withoutDraftAt(drafts, 0);
    expect(primariesOf(remaining, "phone")).toHaveLength(1);
    expect(primaryContactValue(remaining, "phone")).toBe("2125559999");
    expect(primaryContactValue(remaining, "email")).toBe("maya@example.edu");
  });

  it("leaves the kind with no primary once its last row is gone", () => {
    const drafts = normalizeContactDrafts([
      draft({ kind: "phone", value: "4155550134", isPrimary: true }),
    ]);

    expect(withoutDraftAt(drafts, 0)).toEqual([]);
    expect(primaryContactValue(withoutDraftAt(drafts, 0), "phone")).toBeNull();
  });

  it("drops blank rows and normalises what is left", () => {
    const normalized = normalizeContactDrafts([
      draft({ kind: "instagram", value: "  " }),
      draft({ kind: "instagram", value: "https://instagram.com/MayaMakes" }),
      draft({ kind: "email", value: "  maya@example.edu " }),
    ]);

    expect(normalized).toHaveLength(2);
    expect(primaryContactValue(normalized, "instagram")).toBe("mayamakes");
    expect(primaryContactValue(normalized, "email")).toBe("maya@example.edu");
  });

  it("lists a kind primary first", () => {
    const drafts = normalizeContactDrafts([
      draft({ kind: "phone", value: "4155550134" }),
      draft({ kind: "phone", value: "2125559999", isPrimary: true }),
    ]);

    expect(contactValuesOfKind(drafts, "phone").map((row) => row.value)).toEqual([
      "2125559999",
      "4155550134",
    ]);
  });

  it("mirrors the primary of each kind back to the single columns", () => {
    const drafts = normalizeContactDrafts([
      draft({ kind: "phone", value: "4155550134" }),
      draft({ kind: "phone", value: "2125559999" }),
      draft({ kind: "instagram", value: "@mayamakes" }),
    ]);

    expect(legacyColumnsFromDrafts(drafts)).toEqual({
      phoneNumber: "4155550134",
      email: null,
      instagramUsername: "mayamakes",
    });
  });
});

const legacyPerson = {
  phoneNumber: "4155550134",
  email: "maya@example.edu",
  instagramUsername: "mayamakes",
};

function storedMethod(
  overrides: Partial<ContactMethod> & Pick<ContactMethod, "kind" | "value">,
): ContactMethod {
  return {
    id: `m-${overrides.value}`,
    personId: "p1",
    userId: "u1",
    label: null,
    position: 0,
    isPrimary: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("before migration 0013 has run", () => {
  it("shows exactly the single phone, email and handle it always has", () => {
    const drafts = resolveContactDrafts(legacyPerson, unavailableContactMethods);

    expect(drafts).toEqual([
      { kind: "phone", value: "4155550134", label: null, isPrimary: true },
      { kind: "email", value: "maya@example.edu", label: null, isPrimary: true },
      { kind: "instagram", value: "mayamakes", label: null, isPrimary: true },
    ]);
    expect(legacyColumnsFromDrafts(drafts)).toEqual(legacyPerson);
  });

  it("shows nothing at all for a person with nothing saved", () => {
    expect(
      resolveContactDrafts({
        phoneNumber: null,
        email: null,
        instagramUsername: null,
      }),
    ).toEqual([]);
  });

  it("falls back for a person the table has no rows for", () => {
    const drafts = resolveContactDrafts(legacyPerson, {
      available: true,
      methods: [],
    });
    expect(legacyColumnsFromDrafts(drafts)).toEqual(legacyPerson);
  });

  it("reads the child table once it is there", () => {
    const drafts = resolveContactDrafts(legacyPerson, {
      available: true,
      methods: [
        storedMethod({ kind: "phone", value: "4155550134", isPrimary: true }),
        storedMethod({ kind: "phone", value: "2125559999", position: 1 }),
        storedMethod({ kind: "email", value: "maya@example.edu", isPrimary: true }),
        storedMethod({ kind: "instagram", value: "mayamakes", isPrimary: true }),
      ],
    });

    expect(drafts.filter((row) => row.kind === "phone")).toHaveLength(2);
    expect(legacyColumnsFromDrafts(drafts)).toEqual(legacyPerson);
  });

  it("keeps a value an older client wrote straight to the person row", () => {
    const drafts = resolveContactDrafts(
      { ...legacyPerson, phoneNumber: "6175551212" },
      {
        available: true,
        methods: [
          storedMethod({ kind: "phone", value: "4155550134", isPrimary: true }),
        ],
      },
    );

    expect(
      drafts.filter((row) => row.kind === "phone").map((row) => row.value),
    ).toEqual(["4155550134", "6175551212"]);
  });

  it("reads a person that carries no list at all", () => {
    expect(contactDraftsOf(legacyPerson)).toHaveLength(3);
    expect(contactDraftsOf({ ...legacyPerson, contactMethods: [] })).toHaveLength(
      3,
    );
  });
});

describe("reading back what the form sent", () => {
  it("keeps ids, labels and the chosen primary", () => {
    const parsed = parseContactDraftsJson(
      JSON.stringify([
        {
          id: "3f2b6a1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
          kind: "phone",
          value: "4155550134",
          label: "work",
          isPrimary: false,
        },
        { kind: "phone", value: "2125559999", label: null, isPrimary: true },
      ]),
    );

    expect(parsed).toHaveLength(2);
    expect(primaryContactValue(parsed, "phone")).toBe("2125559999");
    expect(parsed[0].label).toBe("work");
  });

  it("treats anything unreadable as nothing rather than throwing", () => {
    expect(parseContactDraftsJson("not json")).toEqual([]);
    expect(parseContactDraftsJson(null)).toEqual([]);
    expect(parseContactDraftsJson("")).toEqual([]);
    expect(parseContactDraftsJson('[{"kind":"fax","value":"x"}]')).toEqual([]);
  });

  it("orders stored rows by position", () => {
    const drafts = draftsFromContactMethods([
      storedMethod({ kind: "phone", value: "second", position: 1 }),
      storedMethod({ kind: "phone", value: "first", position: 0, isPrimary: true }),
    ]);
    expect(drafts.map((row) => row.value)).toEqual(["first", "second"]);
  });
});

describe("what the form starts with and hands back", () => {
  it("offers one empty box per kind for a brand new person", () => {
    const drafts = initialContactDrafts({
      phoneNumber: null,
      email: null,
      instagramUsername: null,
    });

    expect(drafts.map((row) => row.kind)).toEqual([
      "phone",
      "email",
      "instagram",
      "discord",
    ]);
    expect(drafts.every((row) => row.value === "")).toBe(true);
  });

  it("sends exactly today's three values when nothing else is saved", () => {
    const values = contactFormValues(initialContactDrafts(legacyPerson));

    expect(values.phoneNumber).toBe("(415) 555-0134");
    expect(values.email).toBe("maya@example.edu");
    expect(values.instagramUsername).toBe("mayamakes");
    expect(JSON.parse(values.contactMethods)).toHaveLength(3);
  });

  it("sends the primary of each kind under the field name it always had", () => {
    const values = contactFormValues([
      { kind: "phone", value: "(212) 555-9999", label: "work", isPrimary: false },
      { kind: "phone", value: "(415) 555-0134", label: null, isPrimary: true },
      { kind: "email", value: "", label: null, isPrimary: true },
    ]);

    expect(values.phoneNumber).toBe("(415) 555-0134");
    expect(values.email).toBe("");
    expect(JSON.parse(values.contactMethods)).toHaveLength(2);
  });

  it("round-trips through the hidden field without losing the primary", () => {
    const parsed = parseContactDraftsJson(
      contactFormValues(initialContactDrafts(legacyPerson)).contactMethods,
    );
    expect(legacyColumnsFromDrafts(parsed)).toEqual({
      ...legacyPerson,
      phoneNumber: "(415) 555-0134",
    });
  });
});

describe("migration 0013", () => {
  const sql = readFileSync("supabase/migrations/0013_contact_methods.sql", "utf8");

  it("backfills each kind behind a guard, so running it twice adds nothing", () => {
    for (const kind of ["phone", "email", "instagram"]) {
      const insert = sql
        .split("insert into public.person_contact_methods")
        .slice(1)
        .find((block) => block.includes(`'${kind}',`));
      expect(insert, `no backfill for ${kind}`).toBeDefined();
      expect(insert).toContain("not exists");
      expect(insert).toContain("existing.person_id = people.id");
      expect(insert).toContain(`existing.kind = '${kind}'`);
    }
  });

  it("never drops or alters the columns the rest of the app still reads", () => {
    expect(sql).not.toMatch(/drop column/i);
    expect(sql).not.toMatch(/alter table public\.people/i);
    expect(sql).not.toMatch(/delete from public\.people/i);
  });

  it("is owner-only, like every other table", () => {
    expect(sql).toContain("enable row level security");
    expect(sql.match(/auth\.uid\(\) = user_id/g)?.length).toBeGreaterThanOrEqual(
      4,
    );
  });
});
