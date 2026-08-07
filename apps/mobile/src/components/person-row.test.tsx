import { render, screen } from "@testing-library/react-native";
import { PersonRow } from "@/components/person-row";
import type { Person } from "@/lib/types";

jest.mock("expo-image", () => ({
  Image: jest.requireActual("react-native").Image,
}));

const dayInMilliseconds = 86_400_000;

function personSeen(daysAgo: number | null): Person {
  const seenAt = new Date(
    Date.now() - (daysAgo ?? 0) * dayInMilliseconds,
  ).toISOString();
  return {
    id: "p1",
    fullName: "Amelia Chen",
    preferredName: "Amelia",
    profilePhotoUrl: null,
    lastInteractionAt: daysAgo === null ? null : seenAt,
    firstMetAt: seenAt,
    generalNotes: "Runs the ceramics studio",
    major: null,
    relationshipStrength: 2,
    status: "active",
    tags: [],
    createdAt: seenAt,
  } as unknown as Person;
}

describe("PersonRow", () => {
  it("words the last interaction the same way the web does", async () => {
    await render(<PersonRow onPress={() => {}} person={personSeen(1)} />);

    expect(screen.getByText("Yesterday")).toBeTruthy();
  });

  it("says Today for someone seen earlier the same day", async () => {
    await render(<PersonRow onPress={() => {}} person={personSeen(0)} />);

    expect(screen.getByText("Today")).toBeTruthy();
  });

  it("says so when nothing has been logged", async () => {
    await render(<PersonRow onPress={() => {}} person={personSeen(null)} />);

    expect(screen.getByText("No interactions yet")).toBeTruthy();
  });

  it("opens the person rather than hiding actions behind a bare glyph", async () => {
    await render(<PersonRow onPress={() => {}} person={personSeen(2)} />);

    expect(screen.getByLabelText("Open Amelia Chen")).toBeTruthy();
    expect(screen.getByText("2 days ago")).toBeTruthy();
  });
});
