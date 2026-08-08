import {
  normalizeOwnCard,
  ownCardIsEmpty,
  ownCardShareState,
  ownCardSummary,
  filledOwnCardFields,
} from "@/lib/own-card";

describe("ownCardShareState", () => {
  it("cannot share a field that has nothing in it, whatever the saved choice says", () => {
    expect(ownCardShareState({}, {}, "hometown")).toBe("unavailable");
    // A stale "yes" from before the value was cleared must not read as shared.
    expect(ownCardShareState({}, { hometown: true }, "hometown")).toBe("unavailable");
  });

  it("is hidden when there is something to share and the answer is no", () => {
    expect(ownCardShareState({ hometown: "Seoul" }, {}, "hometown")).toBe("hidden");
    expect(ownCardShareState({ hometown: "Seoul" }, { hometown: false }, "hometown")).toBe(
      "hidden",
    );
  });

  it("is shared only when there is a value and it is switched on", () => {
    expect(ownCardShareState({ hometown: "Seoul" }, { hometown: true }, "hometown")).toBe(
      "shared",
    );
  });
});

describe("normalizeOwnCard", () => {
  it("keeps the fields it knows and trims them", () => {
    expect(normalizeOwnCard({ email: "  me@example.edu  ", major: "History" })).toEqual({
      email: "me@example.edu",
      major: "History",
    });
  });

  it("drops blanks, unknown keys and anything that is not text", () => {
    expect(
      normalizeOwnCard({ email: "   ", nickname: "x", phoneNumber: 5550123 }),
    ).toEqual({});
  });

  it("survives a row that is not an object at all", () => {
    expect(normalizeOwnCard(null)).toEqual({});
    expect(normalizeOwnCard("nonsense")).toEqual({});
  });
});

describe("ownCardIsEmpty", () => {
  it("is true until something is saved", () => {
    expect(ownCardIsEmpty({})).toBe(true);
    expect(ownCardIsEmpty({ email: "me@example.edu" })).toBe(false);
  });
});

describe("filledOwnCardFields", () => {
  it("lists what is set, in a stable order", () => {
    expect(filledOwnCardFields({ major: "History", email: "me@example.edu" })).toEqual([
      "email",
      "major",
    ]);
  });
});

describe("ownCardSummary", () => {
  it("says so when there is nothing", () => {
    expect(ownCardSummary({})).toBe("Nothing saved yet");
  });

  it("names one or two fields outright", () => {
    expect(ownCardSummary({ email: "a@b.c" })).toBe("Email");
    expect(ownCardSummary({ email: "a@b.c", major: "History" })).toBe("Email and Major");
  });

  it("counts the rest once there are more", () => {
    expect(
      ownCardSummary({
        email: "a@b.c",
        major: "History",
        hometown: "Seoul",
        university: "Stanford University",
      }),
    ).toBe("Email, Hometown and 2 more");
  });
});
