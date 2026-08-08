import { defaultContactShareSelection } from "@/lib/contact-card";
import {
  buildShareUrl,
  createShareToken,
  defaultShareExpiryChoiceId,
  isValidShareToken,
  mapPersonShare,
  normalizeShareSelection,
  redactedSharePerson,
  shareExpiryFromChoice,
  shareIsLive,
  sharedFieldRows,
  shareTokenAlphabet,
  shareTokenLength,
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
    university: "Stanford University",
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
  it("is six characters, so a link stays short enough to text", () => {
    const token = createShareToken(secureRandomBytes);

    expect(token).toHaveLength(shareTokenLength);
    expect(token).toMatch(/^[a-zA-Z0-9]{6}$/);
    expect(isValidShareToken(token)).toBe(true);
    expect(buildShareUrl("https://www.siyi.app", token)).toHaveLength(
      "https://www.siyi.app/s/".length + 6,
    );
  });

  it("leaves out the characters people mistype when copying a link", () => {
    const drawn = Array.from({ length: 4_000 }, () =>
      createShareToken(secureRandomBytes),
    ).join("");

    for (const confusable of ["0", "O", "1", "l", "I"]) {
      expect(drawn).not.toContain(confusable);
    }
  });

  it("turns down any shape other than the six-character one", () => {
    // Longer, shorter, and the older surname-with-a-tail shape.
    expect(isValidShareToken("a".repeat(32))).toBe(false);
    expect(isValidShareToken("zhang-k7f2m9qpAB3d")).toBe(false);
    expect(isValidShareToken("abcde")).toBe(false);
    expect(isValidShareToken("abcdefg")).toBe(false);
  });

  it("turns down the confusable characters the alphabet leaves out", () => {
    for (const token of ["abcdei", "abcdel", "abcdeo", "abcde0", "abcde1"]) {
      expect(isValidShareToken(token)).toBe(false);
    }
    // Uppercase L is in the alphabet, so it has to pass.
    expect(isValidShareToken("abcdeL")).toBe(true);
  });

  it("draws every character of the alphabet rather than favouring a few", () => {
    const drawn = new Set(
      Array.from({ length: 6_000 }, () => createShareToken(secureRandomBytes))
        .join("")
        .split(""),
    );

    expect(drawn.size).toBe(shareTokenAlphabet.length);
  });

  it("never repeats across many draws", () => {
    const tokens = new Set(
      Array.from({ length: 2_000 }, () => createShareToken(secureRandomBytes)),
    );
    expect(tokens.size).toBe(2_000);
  });

  it("refuses anything that is not exactly the token shape", () => {
    expect(isValidShareToken("abc")).toBe(false);
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

describe("the link itself", () => {
  it("is a short path on the app origin", () => {
    expect(buildShareUrl("https://www.siyi.app/", "a".repeat(32))).toBe(
      `https://www.siyi.app/s/${"a".repeat(32)}`,
    );
  });
});
