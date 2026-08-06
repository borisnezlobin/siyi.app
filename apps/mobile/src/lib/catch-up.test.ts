import {
  chooseCatchUpPerson,
  fallbackConversationStarters,
} from "@/lib/catch-up";
import type { Person } from "@/lib/types";

function person(overrides: Partial<Person>): Person {
  return {
    id: "person",
    userId: "user",
    fullName: "Jordan Lee",
    preferredName: null,
    profilePhotoUrl: null,
    profilePhotoPath: null,
    instagramUsername: null,
    phoneNumber: null,
    email: null,
    birthday: null,
    hometown: null,
    dormOrResidence: null,
    major: null,
    graduationYear: null,
    relationshipStrength: 2,
    relationshipLabel: null,
    remindersEnabled: true,
    reminderIntervalDays: null,
    status: "active",
    firstMetAt: "2026-01-01T12:00:00.000Z",
    firstMetLocation: null,
    generalNotes: null,
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
    lastInteractionAt: null,
    tags: [],
    ...overrides,
  };
}

describe("chooseCatchUpPerson", () => {
  it("prefers the active person contacted least recently", () => {
    const result = chooseCatchUpPerson(
      [
        person({
          id: "recent",
          lastInteractionAt: "2026-07-30T12:00:00.000Z",
        }),
        person({
          id: "older",
          lastInteractionAt: "2026-03-01T12:00:00.000Z",
        }),
        person({ id: "archived", status: "archived" }),
      ],
      new Date("2026-08-04T12:00:00.000Z"),
    );

    expect(result?.id).toBe("older");
  });

  it("avoids people met in the last day when alternatives exist", () => {
    const result = chooseCatchUpPerson(
      [
        person({
          id: "new",
          firstMetAt: "2026-08-04T08:00:00.000Z",
        }),
        person({ id: "established" }),
      ],
      new Date("2026-08-04T12:00:00.000Z"),
    );

    expect(result?.id).toBe("established");
  });
});

describe("fallbackConversationStarters", () => {
  it("uses useful saved context without requiring a language model", () => {
    const starters = fallbackConversationStarters(
      person({
        preferredName: "Jordan",
        major: "Architecture",
        generalNotes: "Training for a half marathon. Loves early morning runs.",
      }),
    );

    expect(starters).toEqual([
      "Follow up on “Training for a half marathon”",
      "Ask how Architecture is going lately",
      "Ask what Jordan has been excited about recently",
    ]);
  });
});
