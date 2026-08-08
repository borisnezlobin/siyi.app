import { describe, expect, it } from "vitest";
import {
  isWellFormedSlug,
  looksLikeUuid,
  personPath,
  personSlug,
  randomSlugSuffix,
  slugifyName,
} from "@/lib/slug";

const suffix = /-[23456789bcdfghjkmnpqrstvwxz]{4}$/;

describe("slugifyName", () => {
  it("lowercases and hyphenates a plain name", () => {
    expect(slugifyName("Alex Vale")).toBe("alex-vale");
  });

  it("folds accents to their base letters", () => {
    expect(slugifyName("Renée Élodie Ångström")).toBe("renee-elodie-angstrom");
    expect(slugifyName("Łukasz Nuñez")).toBe("ukasz-nunez");
  });

  it("collapses punctuation and repeated separators", () => {
    expect(slugifyName("  Mary-Jane   O'Brien, Jr.  ")).toBe(
      "mary-jane-o-brien-jr",
    );
    expect(slugifyName("Anna___Marie")).toBe("anna-marie");
  });

  it("drops emoji instead of leaving stray separators", () => {
    expect(slugifyName("Sam 🎉 Rivera")).toBe("sam-rivera");
    expect(slugifyName("🎉🎉🎉 Sam")).toBe("sam");
  });

  it("caps a very long name at a word boundary", () => {
    const slug = slugifyName(
      "Bartholomew Maximilian Wolfeschlegelsteinhausenberger Von Habsburg",
    );
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug).toBe("bartholomew-maximilian");
    expect(slug.endsWith("-")).toBe(false);
  });

  it("caps a single unbroken word without leaving a trailing hyphen", () => {
    const slug = slugifyName("a".repeat(200));
    expect(slug).toBe("a".repeat(48));
  });

  it("falls back to a readable word when nothing survives", () => {
    expect(slugifyName("")).toBe("person");
    expect(slugifyName("!!! ??? ---")).toBe("person");
    expect(slugifyName("🎂")).toBe("person");
  });

  it("falls back for names written in a non-Latin script", () => {
    expect(slugifyName("Борис Незлобин")).toBe("person");
    expect(slugifyName("山田太郎")).toBe("person");
    expect(slugifyName("محمد")).toBe("person");
  });
});

describe("randomSlugSuffix", () => {
  it("uses only unambiguous consonants and digits", () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      expect(randomSlugSuffix()).toMatch(
        /^[23456789bcdfghjkmnpqrstvwxz]{4}$/,
      );
    }
  });

  it("cannot spell a word, because the alphabet holds no vowels", () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      expect(randomSlugSuffix()).not.toMatch(/[aeiouy]/);
    }
  });

  it("varies between calls", () => {
    const seen = new Set(
      Array.from({ length: 200 }, () => randomSlugSuffix()),
    );
    expect(seen.size).toBeGreaterThan(150);
  });
});

describe("personSlug", () => {
  it("always appends a suffix, even with no collision in sight", () => {
    expect(personSlug("Alex Vale")).toMatch(
      /^alex-vale-[23456789bcdfghjkmnpqrstvwxz]{4}$/,
    );
    expect(personSlug("Zzyzx Quorndale")).toMatch(suffix);
  });

  it("gives two people with the same name different slugs", () => {
    const first = personSlug("Alex Kim");
    const second = personSlug("Alex Kim");
    expect(first).not.toBe(second);
    expect(first.startsWith("alex-kim-")).toBe(true);
    expect(second.startsWith("alex-kim-")).toBe(true);
  });

  it("never emits a bare suffix for a name that normalizes to nothing", () => {
    const slug = personSlug("山田太郎");
    expect(slug).toMatch(/^person-[23456789bcdfghjkmnpqrstvwxz]{4}$/);
  });

  it("always produces a well formed slug", () => {
    const names = [
      "Alex Vale",
      "Renée Élodie",
      "Sam 🎉 Rivera",
      "山田太郎",
      "a".repeat(300),
      "!!!",
      "  ",
    ];
    for (const name of names) {
      const slug = personSlug(name);
      expect(isWellFormedSlug(slug)).toBe(true);
      expect(slug).toMatch(suffix);
    }
  });
});

describe("looksLikeUuid", () => {
  it("recognises the ids already in circulation", () => {
    expect(looksLikeUuid("3f2b6a1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b")).toBe(true);
    expect(looksLikeUuid("3F2B6A1E-1C2D-4E5F-8A9B-0C1D2E3F4A5B")).toBe(true);
  });

  it("does not mistake a slug for an id", () => {
    expect(looksLikeUuid("alex-vale-7fk2")).toBe(false);
    expect(looksLikeUuid("beefcafe-dead-beef-cafe")).toBe(false);
  });
});

describe("personPath", () => {
  it("prefers the slug", () => {
    expect(personPath({ id: "abc", slug: "alex-vale-7fk2" })).toBe(
      "/people/alex-vale-7fk2",
    );
  });

  it("falls back to the uuid before migration 0012 has run", () => {
    expect(personPath({ id: "abc", slug: null })).toBe("/people/abc");
    expect(personPath({ id: "abc" })).toBe("/people/abc");
  });
});
