import { describe, expect, it } from "vitest";
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
