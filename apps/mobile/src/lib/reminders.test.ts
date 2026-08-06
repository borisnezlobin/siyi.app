import { relationshipLabelFor } from "@/lib/relationship-labels";
import {
  daysUntilBirthday,
  nextReminderDate,
  overdueDays,
  reminderDueDate,
} from "@/lib/reminders";
import type { Person } from "@/lib/types";

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: null,
    userId: "22222222-2222-4222-8222-222222222222",
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
    university: null,
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
    lastInteractionAt: "2026-06-01T12:00:00.000Z",
    tags: [],
    ...overrides,
  };
}

describe("reminders", () => {
  it("uses a person-specific interval before the relationship default", () => {
    const due = reminderDueDate(
      person({ reminderIntervalDays: 7 }),
      { 1: 90, 2: 45, 3: 30, 4: 14 },
    );

    expect(due.toISOString()).toBe("2026-06-08T12:00:00.000Z");
  });

  it("does not mark muted or archived people overdue", () => {
    const now = new Date("2026-08-01T12:00:00.000Z");

    expect(overdueDays(person({ status: "muted" }), now)).toBe(0);
    expect(overdueDays(person({ status: "archived" }), now)).toBe(0);
  });

  it("stops nudging a person who switched reminders off", () => {
    const now = new Date("2027-01-01T12:00:00.000Z");
    const optedOut = person({ remindersEnabled: false });

    expect(overdueDays(optedOut, now)).toBe(0);
    expect(nextReminderDate(optedOut)).toBeNull();
  });

  it("still counts birthdays when reminders are off", () => {
    const now = new Date(2026, 11, 30, 12);
    const optedOut = person({
      remindersEnabled: false,
      birthday: "2004-01-02",
    });

    expect(daysUntilBirthday(optedOut.birthday, now)).toBe(3);
  });

  it("counts birthday days across a year boundary", () => {
    const now = new Date(2026, 11, 30, 12);

    expect(daysUntilBirthday("2004-01-02", now)).toBe(3);
  });
});

describe("relationship labels", () => {
  it("falls back to the tier default when no label is set", () => {
    expect(relationshipLabelFor(person())).toBe("Getting to know");
  });

  it("prefers the person's own words", () => {
    expect(
      relationshipLabelFor(
        person({ relationshipLabel: "more than very close brochacho" }),
      ),
    ).toBe("more than very close brochacho");
  });
});
