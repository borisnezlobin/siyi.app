import { describe, expect, it } from "vitest";
import { personInputSchema } from "@/lib/validation";

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
});
