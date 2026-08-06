import {
  contactDraftsOf,
  draftsFromContactMethods,
  initialContactDrafts,
  normalizeContactDrafts,
  resolveContactDrafts,
  withPrimaryAt,
  withoutDraftAt,
  type ContactMethod,
  type ContactMethodDraft,
} from "@/lib/contact-methods";

function draft(
  overrides: Partial<ContactMethodDraft> &
    Pick<ContactMethodDraft, "kind" | "value">,
): ContactMethodDraft {
  return { label: null, isPrimary: false, ...overrides };
}

const noContactColumns = {
  phoneNumber: null,
  email: null,
  instagramUsername: null,
};

describe("one primary per kind", () => {
  it("promotes the first row when nobody is marked", () => {
    const drafts = normalizeContactDrafts([
      draft({ kind: "phone", value: "(555) 555-0123" }),
      draft({ kind: "phone", value: "(555) 555-0124" }),
    ]);

    expect(drafts.map((entry) => entry.isPrimary)).toEqual([true, false]);
  });

  it("keeps exactly one primary when several claim it", () => {
    const drafts = normalizeContactDrafts([
      draft({ kind: "email", value: "a@example.edu", isPrimary: true }),
      draft({ kind: "email", value: "b@example.edu", isPrimary: true }),
      draft({ kind: "phone", value: "(555) 555-0123", isPrimary: true }),
    ]);

    expect(
      drafts.filter((entry) => entry.kind === "email" && entry.isPrimary),
    ).toHaveLength(1);
    expect(
      drafts.filter((entry) => entry.kind === "phone" && entry.isPrimary),
    ).toHaveLength(1);
  });

  it("drops blanks and normalises handles before deciding", () => {
    const drafts = normalizeContactDrafts([
      draft({ kind: "instagram", value: "   " }),
      draft({ kind: "instagram", value: "@Jordan.Lee" }),
    ]);

    expect(drafts).toEqual([
      { kind: "instagram", value: "jordan.lee", label: null, isPrimary: true },
    ]);
  });

  it("moves the primary without disturbing the other kinds", () => {
    const drafts = [
      draft({ kind: "phone", value: "one", isPrimary: true }),
      draft({ kind: "phone", value: "two" }),
      draft({ kind: "email", value: "a@example.edu", isPrimary: true }),
    ];

    const moved = withPrimaryAt(drafts, 1);
    expect(moved.map((entry) => entry.isPrimary)).toEqual([false, true, true]);
  });
});

describe("removing a row", () => {
  it("hands the badge to the next row of that kind", () => {
    const drafts = [
      draft({ kind: "phone", value: "one", isPrimary: true }),
      draft({ kind: "phone", value: "two" }),
      draft({ kind: "phone", value: "three" }),
    ];

    const remaining = withoutDraftAt(drafts, 0);
    expect(remaining.map((entry) => [entry.value, entry.isPrimary])).toEqual([
      ["two", true],
      ["three", false],
    ]);
  });

  it("leaves the primary alone when a different row goes", () => {
    const drafts = [
      draft({ kind: "phone", value: "one", isPrimary: true }),
      draft({ kind: "phone", value: "two" }),
    ];

    expect(withoutDraftAt(drafts, 1)).toEqual([
      draft({ kind: "phone", value: "one", isPrimary: true }),
    ]);
  });

  it("never promotes a row of another kind", () => {
    const drafts = [
      draft({ kind: "phone", value: "one", isPrimary: true }),
      draft({ kind: "email", value: "a@example.edu", isPrimary: true }),
    ];

    expect(withoutDraftAt(drafts, 0)).toEqual([
      draft({ kind: "email", value: "a@example.edu", isPrimary: true }),
    ]);
  });
});

describe("before migration 0013 has run", () => {
  it("falls back to the single phone, email and handle on the person", () => {
    expect(
      resolveContactDrafts({
        phoneNumber: "(555) 555-0123",
        email: "jordan@example.edu",
        instagramUsername: "jordan.lee",
      }),
    ).toEqual([
      {
        kind: "phone",
        value: "(555) 555-0123",
        label: null,
        isPrimary: true,
      },
      {
        kind: "email",
        value: "jordan@example.edu",
        label: null,
        isPrimary: true,
      },
      { kind: "instagram", value: "jordan.lee", label: null, isPrimary: true },
    ]);
  });

  it("gives the form one blank box per kind, exactly as it looks today", () => {
    const drafts = initialContactDrafts({
      ...noContactColumns,
      phoneNumber: "5555550123",
    });

    expect(drafts).toHaveLength(4);
    expect(drafts.filter((entry) => entry.kind === "phone")).toHaveLength(1);
    expect(drafts.filter((entry) => entry.kind === "discord")).toHaveLength(1);
    expect(drafts.every((entry) => entry.isPrimary)).toBe(true);
  });

  it("keeps a value written straight to the person by an older client", () => {
    const stored: ContactMethod[] = [
      {
        id: "method-1",
        personId: "person-1",
        userId: "user-1",
        kind: "phone",
        value: "(555) 555-0124",
        label: "work",
        position: 0,
        isPrimary: true,
        createdAt: "2026-08-01T12:00:00.000Z",
        updatedAt: "2026-08-01T12:00:00.000Z",
      },
    ];

    const drafts = resolveContactDrafts(
      { ...noContactColumns, phoneNumber: "(555) 555-0123" },
      { available: true, methods: stored },
    );

    expect(drafts.map((entry) => entry.value)).toEqual([
      "(555) 555-0124",
      "(555) 555-0123",
    ]);
    expect(drafts.filter((entry) => entry.isPrimary)).toHaveLength(1);
  });

  it("reads a person with no list at all", () => {
    expect(contactDraftsOf({ ...noContactColumns })).toEqual([]);
  });
});

describe("reading rows back from the table", () => {
  it("keeps saved order and one primary", () => {
    const drafts = draftsFromContactMethods([
      {
        id: "b",
        personId: "person-1",
        userId: "user-1",
        kind: "phone",
        value: "second",
        label: null,
        position: 1,
        isPrimary: false,
        createdAt: "2026-08-01T12:00:00.000Z",
        updatedAt: "2026-08-01T12:00:00.000Z",
      },
      {
        id: "a",
        personId: "person-1",
        userId: "user-1",
        kind: "phone",
        value: "first",
        label: "work",
        position: 0,
        isPrimary: true,
        createdAt: "2026-08-01T12:00:00.000Z",
        updatedAt: "2026-08-01T12:00:00.000Z",
      },
    ]);

    expect(drafts.map((entry) => entry.value)).toEqual(["first", "second"]);
    expect(drafts.filter((entry) => entry.isPrimary)).toHaveLength(1);
  });
});
