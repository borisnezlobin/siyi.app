import {
  generateReferralCode,
  normalizeReferralCode,
  rankReferrers,
  referralShareMessage,
  referralUrl,
  REFERRAL_ALPHABET,
  REFERRAL_CODE_LENGTH,
} from "@/lib/referral";

/** Deterministic bytes, so the generated code is predictable in a test. */
function fixedBytes(values: number[]) {
  return () => Uint8Array.from(values);
}

describe("generating a code", () => {
  it("only ever uses characters people can transcribe", () => {
    const code = generateReferralCode((count) =>
      Uint8Array.from({ length: count }, (_, index) => index * 37),
    );
    expect(code).toHaveLength(REFERRAL_CODE_LENGTH);
    for (const character of code) {
      expect(REFERRAL_ALPHABET).toContain(character);
    }
    expect(code).not.toMatch(/[ILO01]/);
  });

  it("maps every byte value into the alphabet", () => {
    // 255 % 31 must still land in range — an off-by-one here would produce
    // undefined characters in a code the database then rejects.
    const code = generateReferralCode(fixedBytes([255, 254, 0, 1, 128, 200, 31]));
    expect(code).toHaveLength(REFERRAL_CODE_LENGTH);
    expect(code).not.toContain("undefined");
  });
});

describe("reading a code someone typed", () => {
  it("accepts lowercase and surrounding whitespace", () => {
    expect(normalizeReferralCode("  jq7mnp2 ")).toBe("JQ7MNP2");
  });

  it("forgives the lookalike characters the alphabet leaves out", () => {
    // Someone reading JQ7MNP2 off a screen may type I for J and O for Q.
    expect(normalizeReferralCode("IO7MNP2")).toBe("JQ7MNP2");
    expect(normalizeReferralCode("1Q7MNP2")).toBe("JQ7MNP2");
    expect(normalizeReferralCode("L07MNP2")).toBe("JQ7MNP2");
  });

  it("ignores punctuation people paste along with the code", () => {
    expect(normalizeReferralCode("JQ7-MNP2")).toBe("JQ7MNP2");
  });

  it("rejects anything that is not a whole code", () => {
    expect(normalizeReferralCode("JQ7MN")).toBeNull();
    expect(normalizeReferralCode("JQ7MNP23")).toBeNull();
    expect(normalizeReferralCode("")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
    expect(normalizeReferralCode(undefined)).toBeNull();
  });
});

describe("the share link", () => {
  it("does not double the slash when the base already ends in one", () => {
    expect(referralUrl("https://www.siyi.app/", "JQ7MNP2")).toBe(
      "https://www.siyi.app/?ref=JQ7MNP2",
    );
    expect(referralUrl("https://www.siyi.app", "JQ7MNP2")).toBe(
      "https://www.siyi.app/?ref=JQ7MNP2",
    );
  });

  it("says what the app is before it says where to get it", () => {
    const message = referralShareMessage("JQ7MNP2", "https://www.siyi.app");
    expect(message.indexOf("Siyi")).toBeLessThan(message.indexOf("http"));
  });
});

describe("ambassador standings", () => {
  it("orders by referrals and breaks ties predictably", () => {
    expect(
      rankReferrers([
        { code: "BBBBBBB", joined: 3 },
        { code: "AAAAAAA", joined: 3 },
        { code: "CCCCCCC", joined: 9 },
      ]),
    ).toEqual([
      { code: "CCCCCCC", joined: 9 },
      { code: "AAAAAAA", joined: 3 },
      { code: "BBBBBBB", joined: 3 },
    ]);
  });

  it("drops accounts that never generated a code", () => {
    expect(rankReferrers([{ code: null, joined: 4 }])).toEqual([]);
  });
});
