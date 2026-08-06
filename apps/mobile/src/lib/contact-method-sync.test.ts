import {
  planContactMethodRows,
  type StoredContactMethodRow,
} from "@/lib/contact-method-sync";
import type { ContactMethodDraft } from "@/lib/contact-methods";

function row(
  overrides: Partial<StoredContactMethodRow> &
    Pick<StoredContactMethodRow, "id" | "kind" | "value">,
): StoredContactMethodRow {
  return {
    label: null,
    position: 0,
    is_primary: false,
    ...overrides,
  };
}

function plan({
  drafts,
  knownIds = [],
  knownValues,
  existingRows = [],
}: {
  drafts: ContactMethodDraft[];
  knownIds?: string[];
  knownValues?: { kind: ContactMethodDraft["kind"]; value: string }[];
  existingRows?: StoredContactMethodRow[];
}) {
  let minted = 0;
  return planContactMethodRows({
    userId: "user-1",
    personId: "person-1",
    drafts,
    knownIds,
    knownValues,
    existingRows,
    newId: () => `new-${(minted += 1)}`,
  });
}

describe("writing contact rows when a phone edit reaches the server", () => {
  it("numbers rows from zero within each kind and marks one primary", () => {
    const { upserts, deleteIds } = plan({
      drafts: [
        { kind: "phone", value: "one", label: null, isPrimary: false },
        { kind: "phone", value: "two", label: "work", isPrimary: true },
        { kind: "email", value: "a@example.edu", label: null, isPrimary: false },
      ],
    });

    expect(deleteIds).toEqual([]);
    expect(
      upserts.map(({ kind, value, position, is_primary }) => ({
        kind,
        value,
        position,
        is_primary,
      })),
    ).toEqual([
      { kind: "phone", value: "one", position: 0, is_primary: false },
      { kind: "phone", value: "two", position: 1, is_primary: true },
      { kind: "email", value: "a@example.edu", position: 0, is_primary: true },
    ]);
  });

  it("reuses the id of a row that is still there, so it keeps its place", () => {
    const { upserts } = plan({
      drafts: [
        { id: "method-1", kind: "phone", value: "one", label: null, isPrimary: true },
      ],
      knownIds: ["method-1"],
      existingRows: [row({ id: "method-1", kind: "phone", value: "old" })],
    });

    expect(upserts).toHaveLength(1);
    expect(upserts[0].id).toBe("method-1");
    expect(upserts[0].value).toBe("one");
  });

  it("mints an id for a row whose original has since gone", () => {
    const { upserts } = plan({
      drafts: [
        { id: "method-1", kind: "phone", value: "one", label: null, isPrimary: true },
      ],
      knownIds: ["method-1"],
    });

    expect(upserts[0].id).toBe("new-1");
  });

  it("deletes only the rows the person actually removed", () => {
    const { deleteIds } = plan({
      drafts: [
        { id: "method-1", kind: "phone", value: "one", label: null, isPrimary: true },
      ],
      knownIds: ["method-1", "method-2"],
      existingRows: [
        row({ id: "method-1", kind: "phone", value: "one", is_primary: true }),
        row({ id: "method-2", kind: "phone", value: "two", position: 1 }),
      ],
    });

    expect(deleteIds).toEqual(["method-2"]);
  });

  it("keeps a number added on the web while the phone edit waited", () => {
    const { upserts, deleteIds } = plan({
      drafts: [
        { id: "method-1", kind: "phone", value: "one", label: null, isPrimary: true },
      ],
      knownIds: ["method-1"],
      existingRows: [
        row({ id: "method-1", kind: "phone", value: "one", is_primary: true }),
        row({ id: "web-row", kind: "phone", value: "added on the web" }),
      ],
    });

    expect(deleteIds).toEqual([]);
    expect(upserts.map(({ id, position }) => [id, position])).toEqual([
      ["method-1", 0],
      ["web-row", 1],
    ]);
    expect(upserts.filter((entry) => entry.is_primary)).toHaveLength(1);
  });

  it("makes a kept row the primary when the phone cleared that kind", () => {
    const { upserts } = plan({
      drafts: [],
      knownIds: ["method-1"],
      existingRows: [
        row({ id: "web-row", kind: "email", value: "added@example.edu" }),
      ],
    });

    expect(upserts).toEqual([
      expect.objectContaining({
        id: "web-row",
        kind: "email",
        position: 0,
        is_primary: true,
      }),
    ]);
  });

  it("drops an unknown row that only repeats a value this edit already carries", () => {
    const { upserts, deleteIds } = plan({
      drafts: [
        { kind: "email", value: "Jordan@example.edu", label: null, isPrimary: true },
      ],
      existingRows: [
        row({ id: "web-row", kind: "email", value: "jordan@example.edu" }),
      ],
    });

    expect(deleteIds).toEqual(["web-row"]);
    expect(upserts.map((entry) => entry.value)).toEqual(["Jordan@example.edu"]);
  });

  it("does not hand back a number the person deleted before migration 0013 ran", () => {
    // The form had no row ids to remember, and the backfill has since copied
    // the old number across from the person.
    const { upserts, deleteIds } = plan({
      drafts: [
        { kind: "phone", value: "(555) 555-0124", label: null, isPrimary: true },
      ],
      knownValues: [{ kind: "phone", value: "(555) 555-0123" }],
      existingRows: [
        row({
          id: "backfilled",
          kind: "phone",
          value: "(555) 555-0123",
          is_primary: true,
        }),
      ],
    });

    expect(deleteIds).toEqual(["backfilled"]);
    expect(upserts.map((entry) => entry.value)).toEqual(["(555) 555-0124"]);
  });

  it("never deletes rows it was not told about", () => {
    const { deleteIds } = plan({
      drafts: [],
      existingRows: [
        row({ id: "web-row", kind: "phone", value: "added on the web" }),
      ],
    });

    expect(deleteIds).toEqual([]);
  });
});
