import {
  flightIsStillValid,
  personAvatarSharedId,
} from "@/components/shared-element";

/**
 * The rules the transition turns on, tested without a renderer. The rendering
 * itself is left to the eye: whether 300ms and this easing feel right is not
 * something an assertion can answer.
 */
describe("which person a flight belongs to", () => {
  it("matches on both sides for the same person", () => {
    expect(personAvatarSharedId("p-1")).toBe(personAvatarSharedId("p-1"));
  });

  it("differs between people, so two profiles cannot share one flight", () => {
    expect(personAvatarSharedId("p-1")).not.toBe(personAvatarSharedId("p-2"));
  });

  it("is built from the person id, not the route parameter", () => {
    // The route accepts a slug as well as a uuid; both sides of the transition
    // read person.id, so a link and a tap agree on the id.
    expect(personAvatarSharedId("ada-lovelace-x1")).toBe(
      "person-avatar:ada-lovelace-x1",
    );
  });
});

describe("how long a flight stays valid", () => {
  it("honours one that has only just started", () => {
    expect(flightIsStillValid(1_000, 1_000)).toBe(true);
  });

  it("honours one still within the window a push takes", () => {
    expect(flightIsStillValid(1_000, 1_900)).toBe(true);
  });

  /**
   * The case this exists for: a row was tapped, the profile failed to load,
   * the user went back. Without expiry the id stays armed, and opening that
   * person later from search or a notification animates an avatar in from a
   * rectangle measured on a different screen minutes earlier.
   */
  it("abandons one that never arrived", () => {
    expect(flightIsStillValid(1_000, 60_000)).toBe(false);
  });

  it("abandons one at the far edge rather than honouring it", () => {
    expect(flightIsStillValid(1_000, 2_200)).toBe(false);
  });
});
