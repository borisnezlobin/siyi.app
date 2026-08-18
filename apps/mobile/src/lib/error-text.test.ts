import { readableError } from "@/lib/error-text";

const fallback = "This screen could not be loaded.";

describe("what a failure says on screen", () => {
  it("keeps a message the app wrote for a person", () => {
    expect(readableError(new Error("Sign in to see your people."), fallback)).toBe(
      "Sign in to see your people.",
    );
    expect(readableError(new Error("Add their name."), fallback)).toBe(
      "Add their name.",
    );
  });

  it("names being offline, because that is the one the reader can act on", () => {
    for (const message of [
      "Network request failed",
      "TypeError: Failed to fetch",
      "connect ECONNREFUSED 127.0.0.1:54321",
    ]) {
      expect(readableError(new Error(message), fallback)).toBe(
        "No connection. This will load when you are back online.",
      );
    }
  });

  it("does not put a developer's note in front of the reader", () => {
    for (const message of [
      "JWT expired",
      "PGRST204",
      'relation "person_classes" does not exist',
      "duplicate key value violates unique constraint",
    ]) {
      expect(readableError(new Error(message), fallback)).toBe(fallback);
    }
  });

  it("does not call a server timeout a lost connection", () => {
    // The server answered — it just took too long. Sending that reader off to
    // check their signal is the wrong instruction.
    expect(
      readableError(
        new Error("canceling statement due to statement timeout"),
        fallback,
      ),
    ).toBe(fallback);
  });

  it("falls back when there is nothing to say", () => {
    expect(readableError(new Error(""), fallback)).toBe(fallback);
    expect(readableError(undefined, fallback)).toBe(fallback);
  });
});
