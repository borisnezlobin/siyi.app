import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The owner has had to report the same violations more than once, so they are
 * asserted rather than remembered. Each rule names why it exists, because a
 * failing test that only says "no emoji" invites someone to add an exception.
 */
function sourceFiles(roots: string[]) {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        files.push(path);
      }
    }
  };
  roots.forEach(walk);
  return files;
}

const files = sourceFiles(["src", "apps/mobile/src"]);
const read = (path: string) => readFileSync(path, "utf8");

// Generated data files carry real place and school names; they are not UI.
const isGenerated = (path: string) =>
  /colleges-data|place-table|world-outline/.test(path);

describe("the design rules the owner keeps having to repeat", () => {
  it("uses no emoji in the interface", () => {
    const offenders = files.filter((path) =>
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(read(path)),
    );
    expect(offenders).toEqual([]);
  });

  it("never puts an icon in a circle tinted with that icon's own colour", () => {
    // bg-sage with text-sage-strong, and the like: the shape the owner called
    // out as reading like generated design.
    const offenders = files
      // An avatar is initials on a tinted disc, which is a different thing:
      // the letters are the content, not decoration around an icon.
      .filter((path) => !/avatar/i.test(path))
      .filter((path) => {
        // Drop any element whose content is initials before testing.
        const source = read(path).replace(
          /<span[^>]*>\s*\{[a-zA-Z]*[iI]nitials\}\s*<\/span>/g,
          "",
        );
        return /place-items-center[^"]*\bbg-sage\b[^"]*\btext-sage-strong\b|place-items-center[^"]*\bbg-coral-soft\b[^"]*\btext-coral/.test(
          source,
        );
      });
    expect(offenders).toEqual([]);
  });

  it("keeps the owner's own name and school out of placeholders", () => {
    const offenders = files
      .filter((path) => !isGenerated(path))
      .filter((path) => {
        const source = read(path);
        // brand.ts carries a real postal address the owner supplied.
        if (path.endsWith("brand.ts")) return false;
        return /placeholder[^\n]*(?:Boris|Nezlobin|Berkeley)/i.test(source);
      });
    expect(offenders).toEqual([]);
  });

  it("writes headings in sentence case, never shouting", () => {
    const offenders = files.filter((path) =>
      /className="[^"]*\buppercase\b/.test(read(path)),
    );
    expect(offenders).toEqual([]);
  });
});
