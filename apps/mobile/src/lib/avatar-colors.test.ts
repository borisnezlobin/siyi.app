import { avatarColorFor, avatarColors, avatarInitials } from "@/lib/avatar-colors";

describe("avatarColorFor", () => {
  it("gives one person the same colour every time", () => {
    expect(avatarColorFor("Amara Okafor")).toEqual(avatarColorFor("Amara Okafor"));
  });

  it("only ever answers with a colour from the palette", () => {
    for (const name of ["A", "Zed", "Amelia Chen", "", "Ana María"]) {
      expect(avatarColors).toContain(avatarColorFor(name));
    }
  });

  it("spreads different people across the palette", () => {
    const chosen = new Set(
      ["Amelia Chen", "Luis Ortega", "Amara Okafor", "Priya Raman", "Sam Cole"].map(
        (name) => avatarColorFor(name).background,
      ),
    );
    expect(chosen.size).toBeGreaterThan(1);
  });
});

describe("avatarInitials", () => {
  it("takes the first letter of the first two names", () => {
    expect(avatarInitials("Amelia Chen")).toBe("AC");
    expect(avatarInitials("Ana María Ortega Ruiz")).toBe("AM");
  });

  it("copes with one name and with stray spacing", () => {
    expect(avatarInitials("Prince")).toBe("P");
    expect(avatarInitials("  Luis   Ortega ")).toBe("LO");
    expect(avatarInitials("")).toBe("");
  });
});
