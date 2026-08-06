import { describe, expect, it } from "vitest";
import {
  buildVCard,
  contactCardFileName,
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
    instagramUsername: "mayamakes",
    phoneNumber: "+1 415 555 0134",
    email: "maya@example.edu",
    birthday: "2004-05-12",
    hometown: "Portland",
    dormOrResidence: null,
    major: "Ceramics",
    graduationYear: 2027,
    relationshipStrength: 3,
    reminderIntervalDays: null,
    status: "active",
    firstMetAt: "2026-01-01",
    firstMetLocation: null,
    generalNotes: "Going through a rough breakup; do not bring it up.",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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
    major: true,
    notes: true,
    bio: true,
  };
}

describe("contact card defaults", () => {
  it("keeps contact details and private notes off until chosen", () => {
    expect(defaultContactShareSelection.phoneNumber).toBe(false);
    expect(defaultContactShareSelection.email).toBe(false);
    expect(defaultContactShareSelection.notes).toBe(false);
    expect(defaultContactShareSelection.bio).toBe(false);
  });

  it("omits everything unselected from the card", () => {
    const card = buildVCard(person(), defaultContactShareSelection);
    expect(card).not.toContain("555");
    expect(card).not.toContain("maya@example.edu");
    expect(card).not.toContain("breakup");
    expect(card).toContain("FN:Maya Chen");
  });
});

describe("building a vCard", () => {
  it("includes each selected field in its proper property", () => {
    const card = buildVCard(person(), selectAll(), { bio: "Ceramics student." });
    expect(card).toContain("VERSION:3.0");
    expect(card).toContain("N:Chen;Maya;;;");
    expect(card).toContain("NICKNAME:May");
    expect(card).toContain("TEL;TYPE=CELL:+1 415 555 0134");
    expect(card).toContain("EMAIL;TYPE=INTERNET:maya@example.edu");
    expect(card).toContain("BDAY:2004-05-12");
    expect(card).toContain("TITLE:Ceramics");
    expect(card).toContain("instagram.com/mayamakes");
    expect(card).toMatch(/^BEGIN:VCARD/);
    expect(card.trimEnd()).toMatch(/END:VCARD$/);
  });

  it("escapes characters that would otherwise break the format", () => {
    const card = buildVCard(
      person({ fullName: "Ana Ruiz; Jr.", generalNotes: "Likes, a lot" }),
      selectAll(),
    );
    expect(card).toContain("FN:Ana Ruiz\\; Jr.");
    expect(card).toContain("Likes\\, a lot");
  });

  it("puts the generated bio ahead of private notes when both are shared", () => {
    const card = buildVCard(person(), selectAll(), { bio: "A short bio." });
    const note = card.split("\r\n").find((line) => line.startsWith("NOTE:"));
    expect(note).toBeDefined();
    expect(note?.indexOf("A short bio.")).toBeLessThan(
      note?.indexOf("rough breakup") ?? 0,
    );
  });

  it("leaves out the note entirely when neither bio nor notes are shared", () => {
    const card = buildVCard(person(), defaultContactShareSelection);
    expect(card).not.toContain("NOTE:");
  });

  it("folds long lines so readers do not choke on them", () => {
    const card = buildVCard(
      person({ generalNotes: "x".repeat(300) }),
      selectAll(),
    );
    for (const line of card.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });
});

describe("file naming", () => {
  it("turns a name into a safe file name", () => {
    expect(contactCardFileName(person())).toBe("maya-chen.vcf");
    expect(contactCardFileName(person({ fullName: "Ana  Ruiz; Jr." }))).toBe(
      "ana-ruiz-jr.vcf",
    );
  });
});
