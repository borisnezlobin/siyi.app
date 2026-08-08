import { describe, expect, it } from "vitest";
import {
  buildProfileUrl,
  createHandleTag,
  formatHandle,
  handleProblem,
  normalizeHandle,
  parseProfileSlug,
  profilePath,
} from "@/lib/handles";

describe("normalizeHandle", () => {
  it("lowercases, strips accents and drops what cannot appear", () => {
    expect(normalizeHandle("  Alex.Vale ")).toBe("alex.vale");
    expect(normalizeHandle("José Álvarez")).toBe("josealvarez");
    expect(normalizeHandle("a/b?c")).toBe("abc");
  });

  it("stops at the maximum length", () => {
    expect(normalizeHandle("a".repeat(60))).toHaveLength(30);
  });
});

describe("handleProblem", () => {
  it("accepts an ordinary handle", () => {
    expect(handleProblem("alex.vale")).toBeNull();
    expect(handleProblem("ana_kim")).toBeNull();
  });

  it("rejects one that is too short", () => {
    expect(handleProblem("ab")).toBe("too-short");
  });

  it("rejects one that starts or ends with punctuation", () => {
    expect(handleProblem(".alex")).toBe("bad-characters");
    expect(handleProblem("alex.")).toBe("bad-characters");
  });

  it("refuses handles that would shadow a page", () => {
    expect(handleProblem("settings")).toBe("reserved");
    expect(handleProblem("people")).toBe("reserved");
  });
});

describe("handle tags", () => {
  it("is four hex characters", () => {
    const bytes = (size: number) => new Uint8Array(size).fill(255);
    expect(createHandleTag(bytes)).toBe("ffff");
  });

  it("pads a small value rather than shortening the tag", () => {
    const bytes = (size: number) => new Uint8Array(size);
    expect(createHandleTag(bytes)).toBe("0000");
  });

  it("reads the way somebody would say it", () => {
    expect(formatHandle("alex.vale", "4f21")).toBe("alex.vale#4f21");
  });
});

describe("profile addresses", () => {
  it("builds a path and a full URL", () => {
    expect(profilePath("alex.vale", "4f21")).toBe("/@alex.vale-4f21");
    expect(buildProfileUrl("https://www.siyi.app/", "ana_kim", "00ab")).toBe(
      "https://www.siyi.app/@ana_kim-00ab",
    );
  });

  it("reads a slug back apart", () => {
    expect(parseProfileSlug("alex.vale-4f21")).toEqual({
      handle: "alex.vale",
      tag: "4f21",
    });
  });

  it("refuses a slug with no tag, a bad tag, or a bad handle", () => {
    expect(parseProfileSlug("alex.vale")).toBeNull();
    expect(parseProfileSlug("alex.vale-zzzz")).toBeNull();
    expect(parseProfileSlug("ab-4f21")).toBeNull();
  });
});
