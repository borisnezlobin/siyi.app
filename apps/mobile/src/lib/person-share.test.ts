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
  shareSlugFor,
} from "@/lib/person-share";
import type { Person } from "@/lib/types";

/**
 * Jest runs on Node, so `crypto.webcrypto` stands in for the expo-crypto
 * source the app uses. Both are CSPRNGs; the token shape is what is under test.
 */
const secureRandomBytes = (size: number) => {
  const bytes = new Uint8Array(size);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("crypto").webcrypto.getRandomValues(bytes);
  return bytes;
};

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: "p1",
    slug: null,
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
    lastInteractionAt: null,
    tags: [],
    ...overrides,
  } as Person;
}

describe("share tokens", () => {
  it("is URL-safe and carries plenty of randomness", () => {
    const token = createShareToken(secureRandomBytes, "Wei Zhang");

    expect(shareTokenByteLength * 8).toBeGreaterThanOrEqual(64);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(token).not.toContain("=");
  });

  it("still accepts the 32 character tokens issued before the change", () => {
    expect(isValidShareToken("a".repeat(32))).toBe(true);
  });

  it("builds a slug from any name, however awkward", () => {
    expect(shareSlugFor("Wei Zhang")).toBe("zhang");
    expect(shareSlugFor("José Álvarez")).toBe("alvarez");
    expect(shareSlugFor("???")).toBe("card");
    expect(shareSlugFor("Bartholomew Featherstonehaugh")).toHaveLength(12);
  });

  it("never repeats across many draws", () => {
    const tokens = new Set(
      Array.from({ length: 2_000 }, () => createShareToken(secureRandomBytes)),
    );
    expect(tokens.size).toBe(2_000);
  });

  it("refuses anything that is not exactly the token shape", () => {
    expect(isValidShareToken("short")).toBe(false);
    expect(isValidShareToken("a".repeat(9))).toBe(false);
    expect(isValidShareToken("a".repeat(65))).toBe(false);
    expect(isValidShareToken(`${"a".repeat(30)}/=`)).toBe(false);
    expect(isValidShareToken(null)).toBe(false);
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
    expect(shareExpiryFromChoice("never", now)).toBeNull();
  });

  it("falls back to thirty days rather than to forever", () => {
    expect(shareExpiryFromChoice("whatever", now)).toBe(
      "2026-09-05T00:00:00.000Z",
    );
  });
});

describe("whether a link still works", () => {
  const now = new Date("2026-08-06T00:00:00.000Z");

  it("refuses expired and revoked links", () => {
    expect(
      shareIsLive({ expiresAt: "2026-08-05T00:00:00.000Z", revokedAt: null }, now),
    ).toBe(false);
    expect(
      shareIsLive(
        { expiresAt: null, revokedAt: "2026-08-05T00:00:00.000Z" },
        now,
      ),
    ).toBe(false);
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
    expect(normalizeShareSelection({ phoneNumber: "yes" }).phoneNumber).toBe(
      false,
    );
    expect(normalizeShareSelection(undefined).hometown).toBe(false);
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
  });
});

describe("redacting a person down to the selection", () => {
  it("removes every field that was not ticked", () => {
    const serialized = JSON.stringify(
      redactedSharePerson(person(), { ...defaultContactShareSelection }),
    );

    expect(serialized).not.toContain("555 0134");
    expect(serialized).not.toContain("maya@example.edu");
    expect(serialized).not.toContain("rough breakup");
    expect(serialized).toContain("Portland");
  });

  it("keeps a phone number once it is ticked", () => {
    const redacted = redactedSharePerson(person(), {
      ...defaultContactShareSelection,
      phoneNumber: true,
    });
    expect(JSON.stringify(redacted)).toContain("555 0134");
  });
});

describe("the rows a viewer sees", () => {
  it("lists only selected fields", () => {
    const selection = { ...defaultContactShareSelection };
    const labels = sharedFieldRows(
      redactedSharePerson(person(), selection),
      selection,
    ).map((row) => row.label);

    expect(labels).toContain("Hometown");
    expect(labels).not.toContain("Phone");
    expect(labels).not.toContain("Notes");
  });
});

describe("links before migration 0015", () => {
  it("recognises a missing table", () => {
    expect(isMissingPersonSharesSchema("42P01")).toBe(true);
    expect(isMissingPersonSharesSchema("PGRST205")).toBe(true);
    expect(isMissingPersonSharesSchema("23505")).toBe(false);
  });
});

describe("the link itself", () => {
  it("is a short path on the app origin", () => {
    expect(buildShareUrl("https://www.siyi.app/", "a".repeat(32))).toBe(
      `https://www.siyi.app/s/${"a".repeat(32)}`,
    );
  });
});
