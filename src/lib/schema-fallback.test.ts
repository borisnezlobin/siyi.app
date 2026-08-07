import { describe, expect, it } from "vitest";
import {
  fallbackKey,
  isMissingSchema,
  readFallback,
  withoutFallback,
  writeFallback,
} from "@/lib/schema-fallback";

describe("isMissingSchema", () => {
  it("recognises a missing table or column", () => {
    expect(isMissingSchema({ code: "42P01" })).toBe(true);
    expect(isMissingSchema({ code: "42703" })).toBe(true);
    expect(isMissingSchema({ code: "PGRST205" })).toBe(true);
  });

  it("does not swallow a real error", () => {
    expect(isMissingSchema({ code: "23505" })).toBe(false);
    expect(isMissingSchema(null)).toBe(false);
  });
});

describe("the fallback blob", () => {
  it("is empty for a card that has never held one", () => {
    expect(readFallback({ email: "a@b.c" })).toEqual({});
    expect(readFallback(null)).toEqual({});
    expect(readFallback("nonsense")).toEqual({});
  });

  it("keeps the card's own fields when something is written", () => {
    const card = writeFallback(
      { email: "a@b.c" },
      { profile: { handle: "ana", tag: "4f21", isPublic: true, publicFields: {} } },
    );

    expect(card.email).toBe("a@b.c");
    expect(readFallback(card).profile?.handle).toBe("ana");
  });

  it("merges rather than replacing, so classes survive a profile write", () => {
    const first = writeFallback({}, { classes: { "person-1": [] } });
    const second = writeFallback(first, {
      profile: { handle: "ana", tag: "4f21", isPublic: false, publicFields: {} },
    });

    expect(readFallback(second).classes).toEqual({ "person-1": [] });
    expect(readFallback(second).profile?.handle).toBe("ana");
  });

  it("hides the reserved key from the card itself", () => {
    const card = writeFallback({ email: "a@b.c" }, { classes: {} });
    expect(Object.keys(card)).toContain(fallbackKey);
    expect(Object.keys(withoutFallback(card))).toEqual(["email"]);
  });
});
