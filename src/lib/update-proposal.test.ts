import { describe, expect, it } from "vitest";
import {
  appendToNoteBody,
  buildProposalContext,
  buildProposalItems,
  coerceFieldValue,
  describeItem,
  dueAtFromDays,
  normalizeProposal,
  parseWrittenDate,
  reminderDueAt,
  planFromItems,
  planSize,
  proposalFieldNames,
  type UpdateProposal,
} from "@/lib/update-proposal";

const person = {
  fullName: "Alara Martin",
  hometown: null,
  university: "Berkeley",
};

const emptyProposal: UpdateProposal = {
  notes: [],
  fields: [],
  reminders: [],
  classes: [],
  leftover: "",
};

const now = new Date("2026-08-08T12:00:00.000Z");

describe("normalizeProposal", () => {
  it("keeps a well formed proposal", () => {
    const result = normalizeProposal({
      notes: [{ heading: "Interests", text: "likes snowboarding" }],
      fields: [{ field: "hometown", value: "Boulder" }],
      reminders: [{ text: "robotics comp", dueInDays: 8 }],
      classes: [],
      leftover: "",
    });

    expect(result).toEqual({
      notes: [{ heading: "Interests", text: "likes snowboarding" }],
      fields: [{ field: "hometown", value: "Boulder" }],
      reminders: [{ text: "robotics comp", dueInDays: 8 }],
      classes: [],
      leftover: "",
    });
  });

  it("drops a field name that is not one we allow", () => {
    const result = normalizeProposal({
      fields: [
        { field: "relationshipStrength", value: "5" },
        { field: "notes", value: "anything" },
        { field: "hometown", value: "Boulder" },
      ],
    });

    expect(result?.fields).toEqual([{ field: "hometown", value: "Boulder" }]);
  });

  it("keeps only the first value when a field is named twice", () => {
    const result = normalizeProposal({
      fields: [
        { field: "hometown", value: "Boulder" },
        { field: "hometown", value: "Denver" },
      ],
    });

    expect(result?.fields).toEqual([{ field: "hometown", value: "Boulder" }]);
  });

  it("turns down a reminder in the past or absurdly far out", () => {
    const result = normalizeProposal({
      reminders: [
        { text: "yesterday", dueInDays: -1 },
        { text: "the far future", dueInDays: 99999 },
        { text: "next week", dueInDays: 7 },
      ],
    });

    expect(result?.reminders).toEqual([{ text: "next week", dueInDays: 7 }]);
  });

  it("fills in what a model left out rather than failing", () => {
    expect(normalizeProposal({ leftover: "saw him" })).toEqual({
      ...emptyProposal,
      leftover: "saw him",
    });
  });

  it("refuses anything that is not an object", () => {
    expect(normalizeProposal(null)).toBeNull();
    expect(normalizeProposal("notes")).toBeNull();
  });
});

describe("coerceFieldValue", () => {
  it("reads a graduation year however it was written", () => {
    expect(coerceFieldValue("graduationYear", "class of '27")).toEqual({ ok: true, value: 2027 });
    expect(coerceFieldValue("graduationYear", "2027")).toEqual({ ok: true, value: 2027 });
    expect(coerceFieldValue("graduationYear", "mech e")).toEqual({ ok: false });
  });

  it("will not invent the year of a birthday", () => {
    // "June 3" is a date, but not one that can be stored without guessing a
    // year, and a guessed year shows a wrong age forever.
    expect(coerceFieldValue("birthday", "June 3")).toEqual({ ok: false });
    expect(coerceFieldValue("birthday", "2004-06-03")).toEqual({ ok: true, value: "2004-06-03" });
    expect(coerceFieldValue("birthday", "3 June 2004")).toEqual({ ok: true, value: "2004-06-03" });
  });

  it("turns down contact details that are not usable", () => {
    expect(coerceFieldValue("email", "not an email")).toEqual({ ok: false });
    expect(coerceFieldValue("email", "Bob@Example.com")).toEqual({
      ok: true,
      value: "bob@example.com",
    });
    expect(coerceFieldValue("phone", "12")).toEqual({ ok: false });
  });

  it("keeps a university inside the column", () => {
    const result = coerceFieldValue("university", "x".repeat(400));
    expect(result.ok && String(result.value)).toHaveLength(120);
  });
});

describe("buildProposalItems", () => {
  it("matches a heading the person already has, whatever its case", () => {
    const items = buildProposalItems({
      proposal: { ...emptyProposal, notes: [{ heading: "interests", text: "snowboarding" }] },
      person,
      sections: [{ id: "note-1", heading: "Interests", body: "climbing" }],
      now,
    });

    expect(items).toEqual([
      { id: "note:0", kind: "note", heading: "Interests", text: "snowboarding", noteId: "note-1" },
    ]);
  });

  it("opens a new section when nothing matches", () => {
    const items = buildProposalItems({
      proposal: { ...emptyProposal, notes: [{ heading: "Food", text: "hates cilantro" }] },
      person,
      sections: [{ id: "note-1", heading: "Interests", body: "" }],
      now,
    });

    expect(items[0]).toMatchObject({ kind: "note", heading: "Food", noteId: null });
  });

  it("flags a field that would replace something, and leaves an empty one alone", () => {
    const items = buildProposalItems({
      proposal: {
        ...emptyProposal,
        fields: [
          { field: "hometown", value: "Boulder" },
          { field: "university", value: "Stanford" },
        ],
      },
      person,
      sections: [],
      now,
    });

    expect(items).toMatchObject([
      { field: "hometown", conflict: false, current: null },
      { field: "university", conflict: true, current: "Berkeley" },
    ]);
  });

  it("says nothing about a value the person already has", () => {
    const items = buildProposalItems({
      proposal: { ...emptyProposal, fields: [{ field: "university", value: "berkeley" }] },
      person,
      sections: [],
      now,
    });

    expect(items).toEqual([]);
  });

  it("adds a second email rather than replacing the first", () => {
    const items = buildProposalItems({
      proposal: { ...emptyProposal, fields: [{ field: "email", value: "new@example.com" }] },
      person,
      sections: [],
      contact: { email: ["old@example.com"] },
      now,
    });

    // A second email is kept beside the first, not instead of it, so there is
    // nothing to choose between.
    expect(items[0]).toMatchObject({ conflict: false, adds: true });
  });

  it("does not say the same thing as both a note and a reminder", () => {
    const items = buildProposalItems({
      proposal: {
        ...emptyProposal,
        notes: [{ heading: "Future", text: "robotics comp" }],
        reminders: [{ text: "robotics comp is on", dueInDays: 8 }],
      },
      person,
      sections: [],
      now,
    });

    expect(items.filter((item) => item.kind === "note")).toEqual([]);
    expect(items).toHaveLength(1);
  });
});

describe("planFromItems", () => {
  const items = buildProposalItems({
    proposal: {
      notes: [{ heading: "Interests", text: "snowboarding" }],
      fields: [{ field: "university", value: "Stanford" }],
      reminders: [{ text: "robotics comp", dueInDays: 8 }],
      classes: [],
      leftover: "",
    },
    person,
    sections: [],
    now,
  });

  it("takes everything when nothing was touched", () => {
    expect(planSize(planFromItems(items, {}))).toBe(3);
  });

  it("leaves out what was removed", () => {
    const plan = planFromItems(items, { "reminder:0": { removed: true } });
    expect(plan.reminders).toEqual([]);
    expect(planSize(plan)).toBe(2);
  });

  it("keeping the existing value drops only that field", () => {
    const plan = planFromItems(items, { "field:university": { keepExisting: true } });
    expect(plan.fields).toEqual([]);
    expect(plan.noteCreates).toHaveLength(1);
    expect(plan.reminders).toHaveLength(1);
  });
});

describe("what the model is told", () => {
  it("never carries a contact detail or the words inside a note", () => {
    const context = buildProposalContext({
      person: { ...person, hometown: "Denver" },
      sections: [{ id: "note-1", heading: "Interests", body: "his number is 555 123 4567" }],
      now,
    });

    expect(context).toContain("Interests");
    expect(context).not.toContain("555");
    expect(context).toContain("Hometown");
    // Which fields are filled, never what they hold.
    expect(context).not.toContain("Denver");
  });
});

describe("appendToNoteBody", () => {
  it("adds a line rather than replacing what is there", () => {
    expect(appendToNoteBody("climbing", "snowboarding")).toBe("climbing\nsnowboarding");
  });

  it("does not say it twice when the same update is saved again", () => {
    expect(appendToNoteBody("likes snowboarding", "likes snowboarding")).toBe(
      "likes snowboarding",
    );
  });
});

describe("dueAtFromDays", () => {
  it("counts whole days from today and lands in the morning", () => {
    const due = new Date(dueAtFromDays(8, now));
    expect(due.getDate()).toBe(16);
    expect(due.getHours()).toBe(9);
  });
});

describe("describeItem", () => {
  it("marks a section that does not exist yet", () => {
    expect(
      describeItem({ id: "note:0", kind: "note", heading: "Food", text: "x", noteId: null }).title,
    ).toBe("Food · new section");
  });
});

describe("the field allow-list", () => {
  it("cannot name a column that is not meant to be written", () => {
    for (const forbidden of ["fullName", "id", "userId", "status", "relationshipStrength"]) {
      expect(proposalFieldNames).not.toContain(forbidden);
    }
  });
});

describe("parseWrittenDate", () => {
  const today = new Date(2026, 7, 9, 20, 0, 0);

  it("reads a date the way somebody would write one", () => {
    for (const written of ["august 23rd", "August 23", "23 august", "2026-08-23"]) {
      const parsed = parseWrittenDate(written, today);
      expect(parsed?.getMonth()).toBe(7);
      expect(parsed?.getDate()).toBe(23);
      expect(parsed?.getFullYear()).toBe(2026);
    }
  });

  it("takes a date with no year to mean the next one to come around", () => {
    const parsed = parseWrittenDate("february 3rd", today);
    expect(parsed?.getFullYear()).toBe(2027);
    expect(parsed?.getMonth()).toBe(1);
  });

  it("turns down what is not a date", () => {
    expect(parseWrittenDate("in three weeks", today)).toBeNull();
    expect(parseWrittenDate("", today)).toBeNull();
    expect(parseWrittenDate("february 31st", today)).toBeNull();
  });
});

describe("reminderDueAt", () => {
  const today = new Date(2026, 7, 9, 20, 0, 0);

  it("uses the date the note named, not the model's arithmetic", () => {
    // A model counting to 23 August said 15 days, which is one too many. The
    // date it copied out is not something it can be wrong about.
    const due = new Date(reminderDueAt({ dueInDays: 15, dueOn: "august 23rd" }, today));

    expect(due.getDate()).toBe(23);
    expect(due.getMonth()).toBe(7);
  });

  it("counts days when the note only said something relative", () => {
    const due = new Date(reminderDueAt({ dueInDays: 21 }, today));

    expect(due.getMonth()).toBe(7);
    expect(due.getDate()).toBe(30);
  });
});

describe("how far away a reminder is", () => {
  it("is worked out from the date, so what is shown is what is saved", () => {
    const today = new Date(2026, 7, 9, 20, 0, 0);
    const items = buildProposalItems({
      proposal: {
        ...emptyProposal,
        reminders: [{ text: "anniversary", dueInDays: 15, dueOn: "august 23rd" }],
      },
      person,
      sections: [],
      now: today,
    });

    const reminder = items[0];
    expect(reminder.kind === "reminder" && reminder.dueInDays).toBe(14);
    // Named by its date rather than "in 14 days", which nobody can check.
    const detail = describeItem(reminder).detail;
    expect(detail).toContain("August");
    expect(detail).toContain("23");
  });
});

describe("more than one of the same kind of contact", () => {
  it("keeps every address the note gave", () => {
    const result = normalizeProposal({
      fields: [
        { field: "email", value: "mcmilk855@gmail.com" },
        { field: "email", value: "ohasramupadhyay@gmail.com" },
      ],
    });

    expect(result?.fields).toHaveLength(2);
  });

  it("still allows a person only one hometown", () => {
    const result = normalizeProposal({
      fields: [
        { field: "hometown", value: "Boulder" },
        { field: "hometown", value: "Denver" },
      ],
    });

    expect(result?.fields).toEqual([{ field: "hometown", value: "Boulder" }]);
  });

  it("offers both as additions, and says nothing about one already held", () => {
    const items = buildProposalItems({
      proposal: {
        ...emptyProposal,
        fields: [
          { field: "email", value: "mcmilk855@gmail.com" },
          { field: "email", value: "ohasramupadhyay@gmail.com" },
        ],
      },
      person,
      sections: [],
      contact: { email: ["mcmilk855@gmail.com"] },
      now,
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ display: "ohasramupadhyay@gmail.com", adds: true });
  });

  it("puts contacts on the plan as additions, apart from the fields it sets", () => {
    const items = buildProposalItems({
      proposal: {
        ...emptyProposal,
        fields: [
          { field: "email", value: "a@example.com" },
          { field: "hometown", value: "Boulder" },
        ],
      },
      person,
      sections: [],
      now,
    });
    const plan = planFromItems(items, {});

    expect(plan.contacts).toEqual([{ kind: "email", value: "a@example.com" }]);
    expect(plan.fields).toEqual([{ field: "hometown", value: "Boulder" }]);
  });
});

describe("classes", () => {
  it("offers each course the note named", () => {
    const items = buildProposalItems({
      proposal: {
        ...emptyProposal,
        classes: ["math 53", "middle eastern studies", "chem 4a"],
      },
      person,
      sections: [],
      now,
    });

    expect(items.map((item) => item.kind === "class" && item.course)).toEqual([
      "MATH 53",
      "middle eastern studies",
      "CHEM 4A",
    ]);
  });

  it("says nothing about a course they are already down for", () => {
    const items = buildProposalItems({
      proposal: { ...emptyProposal, classes: ["MATH53", "chem 4a"] },
      person,
      sections: [],
      classes: ["math 53"],
      now,
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "class", course: "CHEM 4A" });
  });
});

describe("a value the parser cannot read", () => {
  it("keeps it as words instead of dropping it silently", () => {
    const items = buildProposalItems({
      proposal: {
        ...emptyProposal,
        // No year, so it cannot become a date column value.
        fields: [{ field: "birthday", value: "june 3" }],
      },
      person,
      sections: [],
      now,
    });

    expect(items).toEqual([
      expect.objectContaining({ kind: "note", text: "Birthday: june 3" }),
    ]);
  });

  it("files it under a heading the person already has", () => {
    const items = buildProposalItems({
      proposal: {
        ...emptyProposal,
        fields: [{ field: "graduationYear", value: "sometime soon" }],
      },
      person,
      sections: [{ id: "s-1", heading: "Facts", body: "" }],
      now,
    });

    expect(items[0]).toMatchObject({
      kind: "note",
      heading: "Facts",
      noteId: "s-1",
      text: "Graduation year: sometime soon",
    });
  });

  it("still writes a value it can read", () => {
    const items = buildProposalItems({
      proposal: {
        ...emptyProposal,
        fields: [{ field: "birthday", value: "2007-12-29" }],
      },
      person,
      sections: [],
      now,
    });

    expect(items).toEqual([
      expect.objectContaining({ kind: "field", value: "2007-12-29" }),
    ]);
  });
});

describe("several days of the same errand", () => {
  it("keeps every day rather than cutting the list short", () => {
    const proposal = {
      ...emptyProposal,
      reminders: [
        { text: "feed her cat", dueInDays: 0, dueOn: "2026-08-09" },
        { text: "feed her cat", dueInDays: 0, dueOn: "2026-08-10" },
        { text: "feed her cat", dueInDays: 0, dueOn: "2026-08-11" },
        { text: "feed her cat", dueInDays: 0, dueOn: "2026-08-12" },
        { text: "dance recital", dueInDays: 0, dueOn: "2026-08-14" },
      ],
    };
    const items = buildProposalItems({
      proposal,
      person,
      sections: [],
      now,
    });

    expect(items.filter((item) => item.kind === "reminder")).toHaveLength(5);
  });

  it("survives normalisation, which used to cut it to four", () => {
    const raw = {
      notes: [],
      fields: [],
      classes: [],
      leftover: "",
      reminders: Array.from({ length: 6 }, (unused, day) => ({
        text: "feed her cat",
        dueInDays: day,
      })),
    };
    expect(normalizeProposal(raw)?.reminders).toHaveLength(6);
  });
});
