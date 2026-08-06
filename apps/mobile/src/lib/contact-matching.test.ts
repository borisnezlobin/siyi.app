import {
  findContactMatch,
  normalizePersonName,
  normalizePhoneNumber,
  planContactSync,
  type DeviceContact,
} from "@/lib/contact-matching";
import type { Person } from "@/lib/types";

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: "p1",
    userId: "u1",
    fullName: "Maya Chen",
    preferredName: null,
    profilePhotoUrl: null,
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
    firstMetAt: "2026-01-01",
    firstMetLocation: null,
    generalNotes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Person;
}

function contact(overrides: Partial<DeviceContact> = {}): DeviceContact {
  return {
    id: "c1",
    name: "Maya Chen",
    phoneNumbers: [],
    emails: [],
    ...overrides,
  };
}

describe("phone normalization", () => {
  it("treats the same number written different ways as one number", () => {
    expect(normalizePhoneNumber("+1 (415) 555-0134")).toBe("4155550134");
    expect(normalizePhoneNumber("4155550134")).toBe("4155550134");
    expect(normalizePhoneNumber("415.555.0134")).toBe("4155550134");
  });

  it("ignores values too short to identify anyone", () => {
    expect(normalizePhoneNumber("911")).toBeNull();
    expect(normalizePhoneNumber("")).toBeNull();
    expect(normalizePhoneNumber(null)).toBeNull();
  });
});

describe("name normalization", () => {
  it("ignores case, accents, and punctuation", () => {
    expect(normalizePersonName("José  O'Neill")).toBe(
      normalizePersonName("jose oneill"),
    );
  });
});

describe("finding an existing contact", () => {
  it("matches on phone even when the saved name differs", () => {
    const match = findContactMatch(
      person({ fullName: "Maya Chen", phoneNumber: "+1 415 555 0134" }),
      [contact({ id: "c9", name: "Maya (studio)", phoneNumbers: ["4155550134"] })],
    );
    expect(match).toEqual({
      contact: expect.objectContaining({ id: "c9" }),
      matchedOn: "phone",
    });
  });

  it("falls back to an unambiguous name match", () => {
    const match = findContactMatch(person(), [contact({ id: "c2" })]);
    expect(match?.matchedOn).toBe("name");
  });

  it("refuses to guess when two contacts share a name", () => {
    const match = findContactMatch(person(), [
      contact({ id: "a", name: "Maya Chen" }),
      contact({ id: "b", name: "maya  chen" }),
    ]);
    expect(match).toBeNull();
  });

  it("returns nothing when there is no plausible match", () => {
    const match = findContactMatch(person(), [contact({ name: "Luis Ortega" })]);
    expect(match).toBeNull();
  });

  it("matches on any of their numbers, not only the primary", () => {
    const match = findContactMatch(
      person({
        fullName: "Maya Chen",
        phoneNumber: "4155550134",
        contactMethods: [
          { kind: "phone", value: "4155550134", label: null, isPrimary: true },
          { kind: "phone", value: "2125559999", label: "old", isPrimary: false },
        ],
      }),
      [contact({ id: "c7", name: "M", phoneNumbers: ["+1 212 555 9999"] })],
    );
    expect(match).toEqual({
      contact: expect.objectContaining({ id: "c7" }),
      matchedOn: "phone",
    });
  });

  it("refuses to guess when two contacts hold different numbers of theirs", () => {
    const match = findContactMatch(
      person({
        phoneNumber: "4155550134",
        contactMethods: [
          { kind: "phone", value: "4155550134", label: null, isPrimary: true },
          { kind: "phone", value: "2125559999", label: "old", isPrimary: false },
        ],
      }),
      [
        contact({ id: "a", name: "Maya C", phoneNumbers: ["4155550134"] }),
        contact({ id: "b", name: "Maya Chen", phoneNumbers: ["2125559999"] }),
      ],
    );
    expect(match).toBeNull();
  });

  it("refuses to guess when two contacts hold different emails of theirs", () => {
    const match = findContactMatch(
      person({
        email: "maya@example.edu",
        contactMethods: [
          {
            kind: "email",
            value: "maya@example.edu",
            label: null,
            isPrimary: true,
          },
          {
            kind: "email",
            value: "maya@work.com",
            label: "work",
            isPrimary: false,
          },
        ],
      }),
      [
        contact({ id: "a", name: "Maya C", emails: ["maya@example.edu"] }),
        contact({ id: "b", name: "M Chen", emails: ["maya@work.com"] }),
      ],
    );
    expect(match).toBeNull();
  });

  it("still matches when one contact holds two of their numbers", () => {
    const match = findContactMatch(
      person({
        phoneNumber: "4155550134",
        contactMethods: [
          { kind: "phone", value: "4155550134", label: null, isPrimary: true },
          { kind: "phone", value: "2125559999", label: "old", isPrimary: false },
        ],
      }),
      [
        contact({
          id: "only",
          name: "Maya C",
          phoneNumbers: ["4155550134", "2125559999"],
        }),
      ],
    );
    expect(match?.contact.id).toBe("only");
  });
});

describe("planning a contact write", () => {
  it("creates a contact when the phone book has nobody like them", () => {
    const plan = planContactSync(
      person({ phoneNumber: "4155550134", email: "maya@example.edu" }),
      null,
    );
    expect(plan).toEqual({
      action: "create",
      fields: {
        name: "Maya Chen",
        phoneNumber: "4155550134",
        phoneNumbers: ["4155550134"],
        email: "maya@example.edu",
        emails: ["maya@example.edu"],
      },
    });
  });

  it("fills only the gaps on a contact that already exists", () => {
    const plan = planContactSync(
      person({ phoneNumber: "4155550134", email: "maya@example.edu" }),
      {
        contact: contact({ phoneNumbers: ["4155550134"], emails: [] }),
        matchedOn: "phone",
      },
    );
    expect(plan).toMatchObject({
      action: "update",
      fields: { email: "maya@example.edu" },
    });
    expect(plan).not.toHaveProperty("fields.phoneNumber");
  });

  it("never overwrites a number the user already had, and reports the clash", () => {
    const plan = planContactSync(person({ phoneNumber: "4155550134" }), {
      contact: contact({ phoneNumbers: ["2125559999"] }),
      matchedOn: "name",
    });
    expect(plan.action).toBe("none");
  });

  it("reports a conflict rather than silently replacing a value", () => {
    const plan = planContactSync(
      person({ phoneNumber: "4155550134", email: "new@example.edu" }),
      {
        contact: contact({ phoneNumbers: ["2125559999"], emails: [] }),
        matchedOn: "name",
      },
    );
    expect(plan).toMatchObject({ action: "update" });
    if (plan.action !== "update") throw new Error("expected an update");
    expect(plan.fields.email).toBe("new@example.edu");
    expect(plan.skipped).toEqual([
      {
        field: "phoneNumber",
        existing: "2125559999",
        incoming: "4155550134",
      },
    ]);
  });

  it("offers every number the device has never seen", () => {
    const plan = planContactSync(
      person({
        phoneNumber: "4155550134",
        contactMethods: [
          { kind: "phone", value: "4155550134", label: null, isPrimary: true },
          { kind: "phone", value: "2125559999", label: "work", isPrimary: false },
        ],
      }),
      null,
    );
    expect(plan).toMatchObject({
      action: "create",
      fields: { phoneNumbers: ["4155550134", "2125559999"] },
    });
  });

  it("never overwrites the device's number, however many they have", () => {
    const plan = planContactSync(
      person({
        phoneNumber: "4155550134",
        contactMethods: [
          { kind: "phone", value: "4155550134", label: null, isPrimary: true },
          { kind: "phone", value: "2125559999", label: "work", isPrimary: false },
        ],
      }),
      {
        contact: contact({ phoneNumbers: ["6175551212"], emails: [] }),
        matchedOn: "name",
      },
    );
    expect(plan.action).toBe("none");
  });

  it("does nothing when there is nothing new to add", () => {
    const plan = planContactSync(person({ phoneNumber: "4155550134" }), {
      contact: contact({ phoneNumbers: ["+1 415 555 0134"] }),
      matchedOn: "phone",
    });
    expect(plan).toEqual({ action: "none", reason: "no-changes" });
  });
});
