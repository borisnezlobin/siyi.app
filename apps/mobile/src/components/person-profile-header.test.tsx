import { render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { PersonProfileHeader } from "@/components/person-profile-header";
import type { Person } from "@/lib/types";

jest.mock("expo-image", () => ({
  Image: jest.requireActual("react-native").Image,
}));

const isReduceMotionEnabled = jest.spyOn(
  AccessibilityInfo,
  "isReduceMotionEnabled",
);

jest
  .spyOn(AccessibilityInfo, "addEventListener")
  .mockReturnValue({ remove: jest.fn() } as never);

function personNamed(overrides: Partial<Person> = {}): Person {
  return {
    id: "person-1",
    slug: null,
    userId: "user-1",
    fullName: "Nadia Rahman",
    preferredName: null,
    profilePhotoUrl: "https://example.test/nadia.jpg",
    profilePhotoPath: null,
    instagramUsername: null,
    phoneNumber: null,
    email: null,
    birthday: null,
    hometown: null,
    dormOrResidence: null,
    university: null,
    major: null,
    graduationYear: null,
    relationshipStrength: 2,
    relationshipLabel: null,
    remindersEnabled: false,
    reminderIntervalDays: null,
    status: "active",
    firstMetAt: "2026-01-04",
    firstMetLocation: null,
    generalNotes: null,
    createdAt: "2026-01-04T00:00:00.000Z",
    updatedAt: "2026-01-04T00:00:00.000Z",
    lastInteractionAt: null,
    tags: [],
    ...overrides,
  };
}

/**
 * Reduce Motion reads back from a promise, so the hook only knows the answer
 * a tick after the first mount of a session. The throwaway first render is
 * what teaches it; the assertions then run against an informed mount, which is
 * what every profile after the first one gets.
 */
async function renderHeader(person: Person, reduceMotion: boolean) {
  isReduceMotionEnabled.mockResolvedValue(reduceMotion);

  const primer = await render(<PersonProfileHeader person={person} />);
  await waitFor(() => expect(isReduceMotionEnabled).toHaveBeenCalled());
  await primer.unmount();

  await render(<PersonProfileHeader person={person} />);
}

/** Animated resolves its styles to plain numbers before they reach the view. */
function styleOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

describe("the person profile header", () => {
  afterEach(() => {
    isReduceMotionEnabled.mockClear();
  });

  it("holds still for someone who asked the system for less movement", async () => {
    await renderHeader(personNamed(), true);

    expect(styleOf("person-profile-avatar")).toMatchObject({
      opacity: 1,
      transform: [{ scale: 1 }],
    });
    expect(styleOf("person-profile-name")).toMatchObject({
      opacity: 1,
      transform: [{ translateY: 0 }],
    });
  });

  it("still shows the whole header when movement is off", async () => {
    await renderHeader(personNamed({ preferredName: "Nadia" }), true);

    expect(screen.getByText("Nadia")).toBeTruthy();
    expect(screen.getByText("Nadia Rahman")).toBeTruthy();
    expect(screen.getByText("Getting to know")).toBeTruthy();
  });

  it("starts the avatar and name away from rest when movement is allowed", async () => {
    await renderHeader(personNamed(), false);

    expect(styleOf("person-profile-avatar")).toMatchObject({
      opacity: 0,
      transform: [{ scale: 0.86 }],
    });
    expect(styleOf("person-profile-name")).toMatchObject({
      opacity: 0,
      transform: [{ translateY: 12 }],
    });
  });

  it("moves the initials disc when there is no photo, rather than nothing", async () => {
    await renderHeader(personNamed({ profilePhotoUrl: null }), false);

    expect(screen.getByLabelText("Nadia Rahman's initials")).toBeTruthy();
    expect(styleOf("person-profile-avatar")).toMatchObject({
      opacity: 0,
      transform: [{ scale: 0.86 }],
    });
  });
});
