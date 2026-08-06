import { describe, expect, it } from "vitest";
import { relationshipLabelFor } from "@/lib/relationship-labels";
import {
  interactionEditSchema,
  interactionInputSchema,
  maxUniversityLength,
  personInputSchema,
  personUpdateEditSchema,
} from "@/lib/validation";

const personId = "11111111-1111-4111-8111-111111111111";

describe("interactionInputSchema", () => {
  it("accepts a backdated update", () => {
    const result = interactionInputSchema.safeParse({
      personId,
      type: "texted",
      occurredAt: new Date(Date.now() - 86_400_000).toISOString(),
    });

    expect(result.success).toBe(true);
  });

  it("rejects an update dated in the future", () => {
    const result = interactionInputSchema.safeParse({
      personId,
      type: "texted",
      occurredAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    expect(result.success).toBe(false);
  });
});

describe("personInputSchema", () => {
  it("normalizes fast-capture input", () => {
    const result = personInputSchema.parse({
      fullName: "  Maya Chen ",
      instagramUsername: "https://instagram.com/Maya.Makes/",
      phoneNumber: "",
      email: "",
      birthday: "",
      graduationYear: null,
      relationshipStrength: 2,
      reminderIntervalDays: null,
      status: "active",
      firstMetLocation: " Design club ",
      generalNotes: "",
    });

    expect(result).toMatchObject({
      fullName: "Maya Chen",
      instagramUsername: "maya.makes",
      phoneNumber: null,
      email: null,
      birthday: null,
      firstMetLocation: "Design club",
      generalNotes: null,
    });
  });

  it("keeps a custom relationship label and defaults reminders on", () => {
    const result = personInputSchema.parse({
      fullName: "Maya Chen",
      relationshipStrength: 4,
      relationshipLabel: "  more than very close brochacho  ",
      reminderIntervalDays: null,
      graduationYear: null,
    });

    expect(result.relationshipLabel).toBe("more than very close brochacho");
    expect(result.remindersEnabled).toBe(true);
  });

  it("accepts reminders switched off", () => {
    const result = personInputSchema.parse({
      fullName: "Maya Chen",
      relationshipStrength: 2,
      remindersEnabled: false,
      reminderIntervalDays: null,
      graduationYear: null,
    });

    expect(result.remindersEnabled).toBe(false);
  });

  it("rejects a relationship label longer than forty characters", () => {
    const result = personInputSchema.safeParse({
      fullName: "Maya Chen",
      relationshipStrength: 2,
      relationshipLabel: "x".repeat(41),
      reminderIntervalDays: null,
      graduationYear: null,
    });

    expect(result.success).toBe(false);
  });

  it("trims a university and drops an empty one", () => {
    const result = personInputSchema.parse({
      fullName: "Maya Chen",
      relationshipStrength: 2,
      reminderIntervalDays: null,
      graduationYear: null,
      university: "  Westmont University  ",
    });

    expect(result.university).toBe("Westmont University");
    expect(
      personInputSchema.parse({
        fullName: "Maya Chen",
        relationshipStrength: 2,
        reminderIntervalDays: null,
        graduationYear: null,
        university: "",
      }).university,
    ).toBeNull();
  });

  it("accepts a university at the limit and rejects one past it", () => {
    const atLimit = {
      fullName: "Maya Chen",
      relationshipStrength: 2,
      reminderIntervalDays: null,
      graduationYear: null,
      university: "u".repeat(maxUniversityLength),
    };

    expect(personInputSchema.safeParse(atLimit).success).toBe(true);
    expect(
      personInputSchema.safeParse({
        ...atLimit,
        university: "u".repeat(maxUniversityLength + 1),
      }).success,
    ).toBe(false);
  });

  it("leaves the university out entirely when it is not sent", () => {
    const result = personInputSchema.parse({
      fullName: "Maya Chen",
      relationshipStrength: 2,
      reminderIntervalDays: null,
      graduationYear: null,
    });

    expect(result.university).toBeNull();
  });

  it("rejects invalid relationship strengths", () => {
    const result = personInputSchema.safeParse({
      fullName: "Maya Chen",
      relationshipStrength: 5,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a postgres timestamptz with a numeric offset", () => {
    const result = personInputSchema.safeParse({
      fullName: "Amelia Chen",
      relationshipStrength: 2,
      firstMetAt: "2026-01-02T03:04:05.678+00:00",
    });

    expect(result.success).toBe(true);
  });

  it("still accepts a plain UTC timestamp", () => {
    const result = personInputSchema.safeParse({
      fullName: "Amelia Chen",
      relationshipStrength: 2,
      firstMetAt: "2026-01-02T03:04:05.678Z",
    });

    expect(result.success).toBe(true);
  });
});

describe("relationshipLabelFor", () => {
  it("falls back to the tier default when no label is set", () => {
    expect(
      relationshipLabelFor({ relationshipStrength: 3, relationshipLabel: null }),
    ).toBe("Close");
  });

  it("prefers the person's own words", () => {
    expect(
      relationshipLabelFor({
        relationshipStrength: 1,
        relationshipLabel: "more than very close brochacho",
      }),
    ).toBe("more than very close brochacho");
  });
});

describe("editing an update that already exists", () => {
  it("accepts the timestamptz Postgres hands back", () => {
    expect(
      personUpdateEditSchema.safeParse({
        text: "Caught up after class",
        recordedAt: "2026-01-02T03:04:05.678+00:00",
        type: "coffee",
      }).success,
    ).toBe(true);
  });

  it("refuses to move an update into the future", () => {
    expect(
      personUpdateEditSchema.safeParse({
        text: "Caught up after class",
        recordedAt: "2099-01-02T03:04:05.678Z",
        type: "coffee",
      }).success,
    ).toBe(false);
  });

  it("needs the update to still say something", () => {
    expect(
      personUpdateEditSchema.safeParse({
        text: "   ",
        recordedAt: "2026-01-02T03:04:05.678Z",
        type: "coffee",
      }).success,
    ).toBe(false);
  });

  it("edits a standalone interaction without naming the person again", () => {
    const result = interactionEditSchema.safeParse({
      type: "meal",
      occurredAt: "2026-01-02T03:04:05.678+00:00",
      note: "",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.note).toBeNull();
  });
});

describe("naming an update in your own words", () => {
  it("keeps the label and icon when the type is Other", () => {
    const result = interactionInputSchema.safeParse({
      personId,
      type: "other",
      occurredAt: "2026-01-02T03:04:05.678Z",
      customLabel: "Went bouldering",
      customIcon: "climb",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customLabel).toBe("Went bouldering");
      expect(result.data.customIcon).toBe("climb");
    }
  });

  it("drops a leftover label when the type is not Other", () => {
    const result = interactionInputSchema.safeParse({
      personId,
      type: "coffee",
      occurredAt: "2026-01-02T03:04:05.678Z",
      customLabel: "Went bouldering",
      customIcon: "climb",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customLabel).toBeNull();
      expect(result.data.customIcon).toBeNull();
    }
  });

  it("treats a blank label as no label", () => {
    const result = interactionInputSchema.safeParse({
      personId,
      type: "other",
      occurredAt: "2026-01-02T03:04:05.678Z",
      customLabel: "   ",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.customLabel).toBeNull();
  });

  it("refuses a label too long to read in a timeline", () => {
    expect(
      interactionInputSchema.safeParse({
        personId,
        type: "other",
        occurredAt: "2026-01-02T03:04:05.678Z",
        customLabel: "a".repeat(41),
      }).success,
    ).toBe(false);
  });
});
