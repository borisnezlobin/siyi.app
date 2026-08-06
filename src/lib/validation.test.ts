import { describe, expect, it } from "vitest";
import { relationshipLabelFor } from "@/lib/relationship-labels";
import { interactionInputSchema, personInputSchema } from "@/lib/validation";

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
