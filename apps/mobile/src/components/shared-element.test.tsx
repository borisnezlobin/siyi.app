import {
  flightGeometry,
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

/**
 * A row's 48px avatar 20 from the left, 400 down; the profile's 126px one
 * centred near the top. Real numbers from a 390-wide screen.
 */
const rowAvatar = { x: 20, y: 400, width: 48, height: 48 };
const profileAvatar = { x: 132, y: 180, width: 126, height: 126 };

describe("the path a copy travels", () => {
  it("ends exactly where the destination sits", () => {
    const path = flightGeometry(rowAvatar, profileAvatar);

    expect(path.endX).toBe(profileAvatar.x);
    expect(path.endY).toBe(profileAvatar.y);
    expect(path.endScale).toBe(1);
  });

  it("starts centred on the row's element, not on its corner", () => {
    const path = flightGeometry(rowAvatar, profileAvatar);

    // The copy is laid out at the destination's size, so aligning corners
    // would start it 39px left and 39px high of the avatar it is leaving.
    expect(path.startX + profileAvatar.width / 2).toBe(
      rowAvatar.x + rowAvatar.width / 2,
    );
    expect(path.startY + profileAvatar.height / 2).toBe(
      rowAvatar.y + rowAvatar.height / 2,
    );
  });

  it("starts at the size it is leaving and ends at the size it lands on", () => {
    const path = flightGeometry(rowAvatar, profileAvatar);

    // 48 into 126: the copy is drawn large and shrunk, so the frame held at
    // the end is the sharp one.
    expect(path.startScale).toBeCloseTo(48 / 126);
    expect(path.endScale).toBe(1);
  });

  it("really moves, rather than landing where it started", () => {
    const path = flightGeometry(rowAvatar, profileAvatar);

    expect(path.startX).not.toBeCloseTo(path.endX);
    expect(path.startY).not.toBeCloseTo(path.endY);
  });

  it("stands still when a row happens to sit exactly where it lands", () => {
    const path = flightGeometry(profileAvatar, profileAvatar);

    expect(path.startX).toBe(path.endX);
    expect(path.startY).toBe(path.endY);
    expect(path.startScale).toBe(1);
  });

  it("survives a destination measured as zero-wide without dividing by it", () => {
    const path = flightGeometry(rowAvatar, { x: 0, y: 0, width: 0, height: 0 });

    expect(Number.isFinite(path.startScale)).toBe(true);
    expect(path.startScale).toBe(1);
  });

  it("carries the name from the row's line to the profile's heading", () => {
    // The name travels too, and it grows more than the avatar does.
    const rowName = { x: 80, y: 404, width: 120, height: 20 };
    const profileName = { x: 96, y: 330, width: 198, height: 34 };
    const path = flightGeometry(rowName, profileName);

    expect(path.endX).toBe(profileName.x);
    expect(path.endY).toBe(profileName.y);
    expect(path.startScale).toBeCloseTo(120 / 198);
  });
});
