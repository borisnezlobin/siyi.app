import {
  reminderInputSchema,
  maxUniversityLength,
  importPreviewSchema,
  interactionEditSchema,
  personInputSchema,
  personUpdateEditSchema,
  personUpdateInputSchema,
} from "@/lib/validation";

describe("mobile validation", () => {
  it("normalizes an Instagram profile URL while parsing a person", () => {
    const person = personInputSchema.parse({
      fullName: "Jordan Lee",
      instagramUsername: "https://instagram.com/Jordan.Lee/",
      relationshipStrength: 2,
    });

    expect(person.instagramUsername).toBe("jordan.lee");
  });

  it("trims a university and rejects one past the length limit", () => {
    expect(
      personInputSchema.parse({
        fullName: "Jordan Lee",
        relationshipStrength: 2,
        university: "  Westmont University  ",
      }).university,
    ).toBe("Westmont University");
    expect(
      personInputSchema.parse({
        fullName: "Jordan Lee",
        relationshipStrength: 2,
        university: "",
      }).university,
    ).toBeNull();
    expect(
      personInputSchema.safeParse({
        fullName: "Jordan Lee",
        relationshipStrength: 2,
        university: "u".repeat(maxUniversityLength),
      }).success,
    ).toBe(true);
    expect(
      personInputSchema.safeParse({
        fullName: "Jordan Lee",
        relationshipStrength: 2,
        university: "u".repeat(maxUniversityLength + 1),
      }).success,
    ).toBe(false);
  });

  it("keeps a backdated first met date and rejects a future one", () => {
    const met = new Date(Date.now() - 86_400_000).toISOString();
    const person = personInputSchema.parse({
      fullName: "Jordan Lee",
      relationshipStrength: 2,
      firstMetAt: met,
    });

    expect(person.firstMetAt).toBe(met);
    expect(
      personInputSchema.safeParse({
        fullName: "Jordan Lee",
        relationshipStrength: 2,
        firstMetAt: new Date(Date.now() + 86_400_000).toISOString(),
      }).success,
    ).toBe(false);
  });

  it("round-trips a custom relationship label and defaults reminders on", () => {
    const person = personInputSchema.parse({
      fullName: "Jordan Lee",
      relationshipStrength: 4,
      relationshipLabel: "  more than very close brochacho  ",
    });

    expect(person.relationshipLabel).toBe("more than very close brochacho");
    expect(person.remindersEnabled).toBe(true);
  });

  it("accepts reminders switched off and rejects an overlong label", () => {
    expect(
      personInputSchema.parse({
        fullName: "Jordan Lee",
        relationshipStrength: 2,
        remindersEnabled: false,
      }).remindersEnabled,
    ).toBe(false);
    expect(
      personInputSchema.safeParse({
        fullName: "Jordan Lee",
        relationshipStrength: 2,
        relationshipLabel: "x".repeat(41),
      }).success,
    ).toBe(false);
  });

  it("rejects an update recorded in the future", () => {
    const result = personUpdateInputSchema.safeParse({
      personIds: ["11111111-1111-4111-8111-111111111111"],
      text: "Grabbed coffee",
      recordedAt: new Date(Date.now() + 86_400_000).toISOString(),
      isInteraction: true,
      interactionLabel: "Coffee",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid reminder date", () => {
    const result = reminderInputSchema.safeParse({
      personId: "11111111-1111-4111-8111-111111111111",
      text: "Send the notes",
      dueAt: "tomorrow",
    });

    expect(result.success).toBe(false);
  });

  it("keeps an icon from the app's own set", () => {
    const edit = personUpdateEditSchema.parse({
      text: "Went bouldering after class",
      recordedAt: new Date(Date.now() - 3_600_000).toISOString(),
      type: "other",
      customLabel: "Bouldering",
      customIcon: "climb",
    });

    expect(edit.customIcon).toBe("climb");
  });

  it("drops an icon that is not one of the app's own", () => {
    const edit = personUpdateEditSchema.parse({
      text: "Went bouldering after class",
      recordedAt: new Date(Date.now() - 3_600_000).toISOString(),
      type: "other",
      customLabel: "Bouldering",
      customIcon: "skull-and-crossbones",
    });

    expect(edit.customIcon).toBeNull();
  });

  it("clears the user's own name once the type is no longer Other", () => {
    const edit = interactionEditSchema.parse({
      type: "coffee",
      occurredAt: new Date(Date.now() - 3_600_000).toISOString(),
      note: "Flat white at the corner place",
      customLabel: "Bouldering",
      customIcon: "climb",
    });

    expect(edit.customLabel).toBeNull();
    expect(edit.customIcon).toBeNull();
  });

  it("validates and counts only versioned import payloads", () => {
    const result = importPreviewSchema.safeParse({
      version: 1,
      exportedAt: "2026-08-04T12:00:00.000Z",
      people: [{ fullName: "Jordan Lee" }],
      interactions: [],
      reminders: [],
      tags: [],
    });

    expect(result.success).toBe(true);
  });
});
