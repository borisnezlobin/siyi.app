import { formatPhoneNumberInput } from "@/lib/phone-format";

describe("formatting a phone number as it is typed", () => {
  it("groups a plain ten digit number", () => {
    expect(formatPhoneNumberInput("4155550134")).toBe("(415) 555-0134");
  });

  it("formats partial input without jumping ahead", () => {
    expect(formatPhoneNumberInput("4")).toBe("(4");
    expect(formatPhoneNumberInput("415")).toBe("(415");
    expect(formatPhoneNumberInput("4155")).toBe("(415) 5");
    expect(formatPhoneNumberInput("415555")).toBe("(415) 555");
  });

  it("keeps an already formatted number stable", () => {
    expect(formatPhoneNumberInput("(415) 555-0134")).toBe("(415) 555-0134");
  });

  it("handles a leading US country code", () => {
    expect(formatPhoneNumberInput("+14155550134")).toBe("+1 (415) 555-0134");
  });

  it("leaves other international numbers alone", () => {
    expect(formatPhoneNumberInput("+442071838750")).toBe("+442071838750");
  });

  it("does not mangle input longer than a local number", () => {
    expect(formatPhoneNumberInput("4155550134 ext 22")).toBe(
      "4155550134 ext 22",
    );
  });

  it("returns an empty string for empty input", () => {
    expect(formatPhoneNumberInput("")).toBe("");
  });
});
