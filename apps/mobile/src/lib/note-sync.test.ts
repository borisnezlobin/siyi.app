import { maxNoteBodyLength } from "@/lib/note-sections";
import { resolveNoteConflict } from "@/lib/note-sync";

const base = { heading: "Interests", body: "Climbing." };

describe("replaying a note edit", () => {
  it("writes the phone's version when nobody else touched the section", () => {
    expect(
      resolveNoteConflict({
        base,
        ours: { heading: "Interests", body: "Climbing and pottery." },
        remote: base,
      }),
    ).toEqual({
      heading: "Interests",
      body: "Climbing and pottery.",
      spillover: null,
    });
  });

  it("puts the section back when it was deleted elsewhere", () => {
    expect(
      resolveNoteConflict({
        base,
        ours: { heading: "Interests", body: "Climbing and pottery." },
        remote: null,
      }),
    ).toEqual({
      heading: "Interests",
      body: "Climbing and pottery.",
      spillover: null,
    });
  });

  it("keeps the newer text and adds the phone's below it when both changed", () => {
    const resolved = resolveNoteConflict({
      base,
      ours: { heading: "Interests", body: "Climbing and pottery." },
      remote: { heading: "Interests", body: "Climbing, and running." },
    });

    expect(resolved.spillover).toBeNull();
    expect(resolved.body).toContain("Climbing, and running.");
    expect(resolved.body).toContain("Climbing and pottery.");
    expect(resolved.body).toContain("Also written on your phone:");
  });

  it("takes the other version when the phone only renamed the section", () => {
    const resolved = resolveNoteConflict({
      base,
      ours: { heading: "Hobbies", body: base.body },
      remote: { heading: "Interests", body: "Climbing, and running." },
    });

    expect(resolved).toEqual({
      heading: "Hobbies",
      body: "Climbing, and running.",
      spillover: null,
    });
  });

  it("keeps the newer heading when both renamed, and says where the phone's text came from", () => {
    const resolved = resolveNoteConflict({
      base,
      ours: { heading: "Hobbies", body: "Climbing and pottery." },
      remote: { heading: "Pastimes", body: "Climbing, and running." },
    });

    expect(resolved.heading).toBe("Pastimes");
    expect(resolved.body).toContain("under “Hobbies”");
    expect(resolved.body).toContain("Climbing and pottery.");
  });

  it("gives the phone's text its own section rather than trimming it away", () => {
    const long = "x".repeat(maxNoteBodyLength - 10);
    const resolved = resolveNoteConflict({
      base,
      ours: { heading: "Interests", body: "Climbing and pottery." },
      remote: { heading: "Interests", body: long },
    });

    expect(resolved.body).toBe(long);
    expect(resolved.spillover).toEqual({
      heading: "Interests (from your phone)",
      body: "Climbing and pottery.",
    });
  });

  it("has nothing to merge when both sides landed on the same text", () => {
    const resolved = resolveNoteConflict({
      base,
      ours: { heading: "Interests", body: "Climbing and pottery." },
      remote: { heading: "Interests", body: "Climbing and pottery." },
    });

    expect(resolved.body).toBe("Climbing and pottery.");
    expect(resolved.spillover).toBeNull();
  });
});
