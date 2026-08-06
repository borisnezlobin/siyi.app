import {
  buildVCard,
  defaultContactShareSelection,
  type ContactShareSelection,
} from "@/lib/contact-card";
import type { Person } from "@/lib/types";

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: "p1",
    userId: "u1",
    fullName: "Maya Chen",
    preferredName: "May",
    profilePhotoUrl: null,
    profilePhotoPath: null,
    instagramUsername: "mayamakes",
    phoneNumber: "+1 415 555 0134",
    email: "maya@example.edu",
    birthday: "2004-05-12",
    hometown: "Portland",
    dormOrResidence: null,
    university: null,
    major: "Ceramics",
    graduationYear: 2027,
    relationshipStrength: 3,
    relationshipLabel: null,
    remindersEnabled: true,
    reminderIntervalDays: null,
    status: "active",
    firstMetAt: "2026-01-01",
    firstMetLocation: null,
    generalNotes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastInteractionAt: null,
    tags: [],
    ...overrides,
  } as Person;
}

function selectAll(): ContactShareSelection {
  return {
    preferredName: true,
    phoneNumber: true,
    email: true,
    instagram: true,
    birthday: true,
    hometown: true,
    university: true,
    major: true,
    notes: true,
    bio: true,
  };
}

describe("sharing a card from the phone", () => {
  it("emits every number and address they have", () => {
    const card = buildVCard(
      person({
        contactMethods: [
          {
            kind: "phone",
            value: "+1 415 555 0134",
            label: null,
            isPrimary: true,
          },
          {
            kind: "phone",
            value: "+1 212 555 9999",
            label: "work",
            isPrimary: false,
          },
          {
            kind: "email",
            value: "maya@example.edu",
            label: null,
            isPrimary: true,
          },
          {
            kind: "email",
            value: "maya@studio.com",
            label: "work",
            isPrimary: false,
          },
        ],
      }),
      selectAll(),
    );
    const lines = card.split("\r\n");

    expect(lines.filter((line) => line.startsWith("TEL"))).toEqual([
      "TEL;TYPE=CELL,PREF:+1 415 555 0134",
      "TEL;TYPE=CELL:+1 212 555 9999",
    ]);
    expect(lines.filter((line) => line.startsWith("EMAIL"))).toEqual([
      "EMAIL;TYPE=INTERNET,PREF:maya@example.edu",
      "EMAIL;TYPE=INTERNET:maya@studio.com",
    ]);
  });

  it("emits the single saved value when migration 0013 has not run", () => {
    const lines = buildVCard(person(), selectAll()).split("\r\n");

    expect(lines.filter((line) => line.startsWith("TEL"))).toEqual([
      "TEL;TYPE=CELL,PREF:+1 415 555 0134",
    ]);
    expect(lines.filter((line) => line.startsWith("EMAIL"))).toEqual([
      "EMAIL;TYPE=INTERNET,PREF:maya@example.edu",
    ]);
  });

  it("keeps phone, email, notes and bio off by default", () => {
    expect(defaultContactShareSelection.phoneNumber).toBe(false);
    expect(defaultContactShareSelection.email).toBe(false);
    expect(defaultContactShareSelection.notes).toBe(false);
    expect(defaultContactShareSelection.bio).toBe(false);

    const card = buildVCard(person(), defaultContactShareSelection);
    expect(card).not.toContain("TEL");
    expect(card).not.toContain("EMAIL");
  });
});
