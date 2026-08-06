import {
  followUpInputSchema,
  importPreviewSchema,
  personInputSchema,
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

  it("rejects an invalid follow-up date", () => {
    const result = followUpInputSchema.safeParse({
      personId: "11111111-1111-4111-8111-111111111111",
      text: "Send the notes",
      dueAt: "tomorrow",
    });

    expect(result.success).toBe(false);
  });

  it("validates and counts only versioned import payloads", () => {
    const result = importPreviewSchema.safeParse({
      version: 1,
      exportedAt: "2026-08-04T12:00:00.000Z",
      people: [{ fullName: "Jordan Lee" }],
      interactions: [],
      followUps: [],
      tags: [],
    });

    expect(result.success).toBe(true);
  });
});
