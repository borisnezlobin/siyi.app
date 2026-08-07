import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The shareable link is on for new profiles and untouched for everybody else.
 * Both halves of that live in one migration, and the dangerous half is the one
 * that is easy to add by accident: a single `update` in this file would publish
 * the details of every user who has left their page off.
 */
const migration = readFileSync(
  new URL(
    "../../supabase/migrations/0020_shareable_link_on_by_default.sql",
    import.meta.url,
  ),
  "utf8",
);

/** The statements only, so a word in a comment cannot pass or fail a check. */
const statements = migration
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("the shareable-link defaults", () => {
  it("turns the link on for a profile created from now on", () => {
    expect(statements).toMatch(/alter column profile_public set default true/i);
  });

  it("starts a new profile sharing the full name and the major, and nothing else", () => {
    const defaultFields = statements.match(
      /alter column public_fields set default '([^']*)'/i,
    );
    expect(defaultFields).not.toBeNull();
    expect(JSON.parse(defaultFields![1])).toEqual({ fullName: true, major: true });
  });

  it("leaves every profile that already exists exactly as it is", () => {
    // A column default is read when a row is inserted, so existing rows keep
    // what they hold. The only way this migration could reach them is by
    // writing to them.
    expect(statements).not.toMatch(/\bupdate\b/i);
    expect(statements).not.toMatch(/\binsert\b/i);
  });
});
