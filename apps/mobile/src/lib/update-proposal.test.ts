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
  leftover: "",
};

const now = new Date("2026-08-08T12:00:00.000Z");

describe("normalizeProposal", () => {
  it("keeps a well formed proposal", () => {
    const result = normalizeProposal({
      notes: [{ heading: "Interests", text: "likes snowboarding" }],
      fields: [{ field: "hometown", value: "Boulder" }],
      reminders: [{ text: "robotics comp", dueInDays: 8 }],
      leftover: "",
    });

    expect(result).toEqual({
      notes: [{ heading: "Interests", text: "likes snowboarding" }],
      fields: [{ field: "hometown", value: "Boulder" }],
      reminders: [{ text: "robotics comp", dueInDays: 8 }],
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

  it("compares a contact detail against what is stored, not against the profile", () => {
    const items = buildProposalItems({
      proposal: { ...emptyProposal, fields: [{ field: "email", value: "new@example.com" }] },
      person,
      sections: [],
      contact: { email: "old@example.com" },
      now,
    });

    expect(items[0]).toMatchObject({ conflict: true, current: "old@example.com" });
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
