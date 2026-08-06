import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { defaultContactShareSelection } from "@/lib/contact-card";
import {
  buildShareUrl,
  createShareToken,
  defaultShareExpiryChoiceId,
  isMissingPersonSharesSchema,
  isValidShareToken,
  mapPersonShare,
  normalizeShareSelection,
  redactedSharePerson,
  shareExpiryFromChoice,
  shareIsLive,
  sharedFieldRows,
  shareTokenByteLength,
  shareTokenLength,
} from "@/lib/person-share";
import type { Person } from "@/lib/types";

const secureRandomBytes = (size: number) => new Uint8Array(randomBytes(size));

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: "p1",
    slug: null,
    userId: "u1",
    fullName: "Maya Chen",
    preferredName: "May",
    profilePhotoUrl: null,
    instagramUsername: "mayamakes",
    phoneNumber: "+1 415 555 0134",
    email: "maya@example.edu",
    birthday: "2004-05-12",
    hometown: "Portland",
    dormOrResidence: "Unit 3",
    university: "Berkeley",
    major: "Ceramics",
    graduationYear: 2027,
    relationshipStrength: 3,
    relationshipLabel: "Studio friend",
    remindersEnabled: true,
    reminderIntervalDays: null,
    status: "active",
    firstMetAt: "2026-01-01",
    firstMetLocation: "Wheeler Hall",
    generalNotes: "Going through a rough breakup; do not bring it up.",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Person;
}

describe("share tokens", () => {
  it("is 32 URL-safe characters carrying 192 bits of randomness", () => {
    const token = createShareToken(secureRandomBytes);

    expect(shareTokenByteLength * 8).toBeGreaterThanOrEqual(128);
    expect(token).toHaveLength(shareTokenLength);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(token).not.toContain("=");
    expect(isValidShareToken(token)).toBe(true);
  });

  it("never repeats across many draws", () => {
    const tokens = new Set(
      Array.from({ length: 5_000 }, () => createShareToken(secureRandomBytes)),
    );
    expect(tokens.size).toBe(5_000);
  });

  it("uses every position of the alphabet rather than a fixed prefix", () => {
    const firstCharacters = new Set(
      Array.from(
        { length: 500 },
        () => createShareToken(secureRandomBytes)[0],
      ),
    );
    expect(firstCharacters.size).toBeGreaterThan(20);
  });

  it("refuses anything that is not exactly the token shape", () => {
    expect(isValidShareToken("")).toBe(false);
    expect(isValidShareToken("short")).toBe(false);
    expect(isValidShareToken("a".repeat(31))).toBe(false);
    expect(isValidShareToken("a".repeat(33))).toBe(false);
    expect(isValidShareToken(`${"a".repeat(30)}/=`)).toBe(false);
    expect(isValidShareToken(`${"a".repeat(31)}'`)).toBe(false);
    expect(isValidShareToken(null)).toBe(false);
    expect(isValidShareToken(12345)).toBe(false);
  });

  it("refuses a random source that returns the wrong number of bytes", () => {
    expect(() => createShareToken(() => new Uint8Array(4))).toThrow();
  });
});

describe("expiry", () => {
  const now = new Date("2026-08-06T00:00:00.000Z");

  it("defaults to thirty days", () => {
    expect(defaultShareExpiryChoiceId).toBe("30d");
    expect(shareExpiryFromChoice(defaultShareExpiryChoiceId, now)).toBe(
      "2026-09-05T00:00:00.000Z",
    );
  });

  it("honours a shorter life and an explicit no-expiry", () => {
    expect(shareExpiryFromChoice("1d", now)).toBe("2026-08-07T00:00:00.000Z");
    expect(shareExpiryFromChoice("7d", now)).toBe("2026-08-13T00:00:00.000Z");
    expect(shareExpiryFromChoice("never", now)).toBeNull();
  });

  it("falls back to thirty days rather than to forever", () => {
    expect(shareExpiryFromChoice("forever", now)).toBe(
      "2026-09-05T00:00:00.000Z",
    );
    expect(shareExpiryFromChoice(undefined, now)).toBe(
      "2026-09-05T00:00:00.000Z",
    );
  });
});

describe("whether a link still works", () => {
  const now = new Date("2026-08-06T00:00:00.000Z");

  it("refuses an expired link", () => {
    expect(
      shareIsLive(
        { expiresAt: "2026-08-05T23:59:59.000Z", revokedAt: null },
        now,
      ),
    ).toBe(false);
  });

  it("refuses a revoked link even while it is still in date", () => {
    expect(
      shareIsLive(
        {
          expiresAt: "2027-01-01T00:00:00.000Z",
          revokedAt: "2026-08-05T00:00:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });

  it("allows a live link, with or without an expiry", () => {
    expect(
      shareIsLive({ expiresAt: "2026-09-05T00:00:00.000Z", revokedAt: null }, now),
    ).toBe(true);
    expect(shareIsLive({ expiresAt: null, revokedAt: null }, now)).toBe(true);
  });
});

describe("the stored selection", () => {
  it("leaves the picker defaults exactly as they were", () => {
    expect(defaultContactShareSelection).toEqual({
      preferredName: true,
      phoneNumber: false,
      email: false,
      instagram: true,
      birthday: false,
      hometown: true,
      university: true,
      major: true,
      notes: false,
      bio: false,
    });
  });

  it("treats anything missing or malformed as off", () => {
    expect(normalizeShareSelection(null)).toEqual({
      preferredName: false,
      phoneNumber: false,
      email: false,
      instagram: false,
      birthday: false,
      hometown: false,
      university: false,
      major: false,
      notes: false,
      bio: false,
    });
    expect(normalizeShareSelection({ phoneNumber: "yes" }).phoneNumber).toBe(
      false,
    );
    expect(normalizeShareSelection({ phoneNumber: 1 }).phoneNumber).toBe(false);
    expect(normalizeShareSelection({ phoneNumber: true }).phoneNumber).toBe(
      true,
    );
  });

  it("maps a stored row into the shape the app reads", () => {
    const share = mapPersonShare({
      id: "s1",
      person_id: "p1",
      token: "a".repeat(32),
      fields: { hometown: true },
      expires_at: null,
      revoked_at: null,
      last_viewed_at: null,
      view_count: null,
      created_at: "2026-08-06T00:00:00.000Z",
    });

    expect(share.selection.hometown).toBe(true);
    expect(share.selection.phoneNumber).toBe(false);
    expect(share.viewCount).toBe(0);
  });
});

describe("redacting a person down to the selection", () => {
  it("removes every field that was not ticked", () => {
    const redacted = redactedSharePerson(person(), {
      ...defaultContactShareSelection,
    });
    const serialized = JSON.stringify(redacted);

    expect(serialized).not.toContain("555 0134");
    expect(serialized).not.toContain("maya@example.edu");
    expect(serialized).not.toContain("rough breakup");
    expect(serialized).not.toContain("Unit 3");
    expect(serialized).not.toContain("Wheeler Hall");
    expect(serialized).not.toContain("Studio friend");
    expect(serialized).not.toContain("u1");

    expect(redacted.fullName).toBe("Maya Chen");
    expect(redacted.hometown).toBe("Portland");
    expect(redacted.instagramUsername).toBe("mayamakes");
  });

  it("keeps a field once the sharer turns it on", () => {
    const redacted = redactedSharePerson(person(), {
      ...defaultContactShareSelection,
      phoneNumber: true,
    });

    expect(JSON.stringify(redacted)).toContain("555 0134");
    expect(redacted.contactMethods?.some((entry) => entry.kind === "phone")).toBe(
      true,
    );
    expect(redacted.contactMethods?.some((entry) => entry.kind === "email")).toBe(
      false,
    );
  });

  it("drops deselected kinds out of the contact method list", () => {
    const redacted = redactedSharePerson(
      person({
        contactMethods: [
          { kind: "phone", value: "+1 415 555 0134", label: null, isPrimary: true },
          { kind: "email", value: "maya@example.edu", label: null, isPrimary: true },
        ],
      }),
      { ...defaultContactShareSelection },
    );

    expect(redacted.contactMethods).toEqual([]);
    expect(JSON.stringify(redacted)).not.toContain("555 0134");
  });
});

describe("the rows a viewer sees", () => {
  it("lists only selected fields", () => {
    const selection = { ...defaultContactShareSelection };
    const rows = sharedFieldRows(
      redactedSharePerson(person(), selection),
      selection,
    );
    const labels = rows.map((row) => row.label);

    expect(labels).toContain("Hometown");
    expect(labels).toContain("Instagram");
    expect(labels).not.toContain("Phone");
    expect(labels).not.toContain("Email");
    expect(labels).not.toContain("Notes");
  });
});

describe("links before migration 0015", () => {
  it("recognises every shape of a missing table or column", () => {
    for (const code of ["42P01", "42883", "42703", "PGRST202", "PGRST204", "PGRST205"]) {
      expect(isMissingPersonSharesSchema(code)).toBe(true);
    }
    expect(isMissingPersonSharesSchema("23505")).toBe(false);
    expect(isMissingPersonSharesSchema(undefined)).toBe(false);
  });
});

describe("the link itself", () => {
  it("is a short path on the app origin", () => {
    expect(buildShareUrl("https://www.siyi.app", "a".repeat(32))).toBe(
      `https://www.siyi.app/s/${"a".repeat(32)}`,
    );
    expect(buildShareUrl("https://www.siyi.app/", "b".repeat(32))).toBe(
      `https://www.siyi.app/s/${"b".repeat(32)}`,
    );
  });

  it("says nothing about the person it points to", () => {
    const token = createShareToken(secureRandomBytes);
    expect(token.toLowerCase()).not.toContain("maya");
    expect(token).not.toContain("p1");
  });
});

describe("a person field added later cannot leak by default", () => {
  /**
   * Written out in full rather than built from a helper: `Person` is a complete
   * literal here, so adding a field to the type breaks this file until someone
   * fills it in, and the assertion below then catches it if redaction forgot it.
   * Every value is a sentinel that must not survive an empty selection.
   */
  const everythingFilled: Person = {
    id: "sentinel-id",
    slug: "sentinel-slug",
    userId: "sentinel-user",
    fullName: "Amelia Chen",
    preferredName: "sentinel-preferred",
    profilePhotoUrl: "sentinel-photo",
    instagramUsername: "sentinelhandle",
    phoneNumber: "sentinel-phone",
    email: "sentinel-email",
    contactMethods: [
      { kind: "phone", value: "sentinel-method", label: null, isPrimary: true },
    ],
    birthday: "1904-03-18",
    hometown: "sentinel-hometown",
    dormOrResidence: "sentinel-dorm",
    university: "sentinel-university",
    major: "sentinel-major",
    graduationYear: 2027,
    relationshipStrength: 2,
    relationshipLabel: "sentinel-label",
    remindersEnabled: true,
    reminderIntervalDays: 42,
    status: "active",
    firstMetAt: "2026-01-02T03:04:05.678Z",
    firstMetLocation: "sentinel-location",
    generalNotes: "sentinel-notes",
    createdAt: "2026-01-02T03:04:05.678Z",
    updatedAt: "2026-01-02T03:04:05.678Z",
    lastInteractionAt: "2026-01-02T03:04:05.678Z",
    tags: [
      {
        id: "sentinel-tag-id",
        userId: "sentinel-user",
        name: "sentinel-tag",
        createdAt: "2026-01-02T03:04:05.678Z",
      },
    ],
  };

  it("keeps nothing a sharer did not tick", () => {
    const serialized = JSON.stringify(
      redactedSharePerson(everythingFilled, {
        ...defaultContactShareSelection,
        preferredName: false,
        instagram: false,
        hometown: false,
        university: false,
        major: false,
      }),
    );

    const leaked = Object.entries(everythingFilled)
      .filter(([, value]) => typeof value === "string")
      .filter(([, value]) => (value as string).startsWith("sentinel-"))
      .filter(([, value]) => serialized.includes(value as string))
      .map(([field]) => field);

    expect(leaked).toEqual([]);
    expect(serialized).not.toContain("sentinel-tag");
    expect(serialized).not.toContain("sentinel-method");
    expect(serialized).not.toContain("sentinelhandle");
  });
});
