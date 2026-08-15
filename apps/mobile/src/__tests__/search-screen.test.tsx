import { render, screen } from "@testing-library/react-native";
import * as mockReact from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SearchScreen from "@/app/(app)/search";
import type { SearchResult } from "@/lib/search";
import type { SearchOutcome } from "@/lib/search-data";
import type { Person } from "@/lib/types";

// The screen is tested against `searchEverything`'s three outcomes rather than
// against Supabase: what a `42883` means is search-data's business and is
// covered there, and mocking the seam the screen actually reads keeps the
// states here spelled out one line each.
const mockSearchEverything = jest.fn<Promise<SearchOutcome>, [string]>();
const mockParams: { q?: string } = {};

jest.mock("@/lib/search-data", () => ({
  searchEverything: (...args: [string]) => mockSearchEverything(...args),
}));

jest.mock("expo-glass-effect", () => {
  const { View } = jest.requireActual("react-native");
  return {
    isLiquidGlassAvailable: () => false,
    GlassView: View,
    GlassContainer: View,
  };
});

jest.mock("expo-image", () => ({
  Image: jest.requireActual("react-native").Image,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) =>
    mockReact.useEffect(() => callback(), [callback]),
}));

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } } }),
}));

const mockPerson: Person = {
  id: "person-1",
  slug: "amelia-chen",
  userId: "user-1",
  fullName: "Amelia Chen",
  preferredName: null,
  profilePhotoUrl: null,
  profilePhotoPath: null,
  instagramUsername: null,
  phoneNumber: null,
  email: null,
  contactMethods: [],
  birthday: null,
  hometown: null,
  dormOrResidence: null,
  university: null,
  major: null,
  graduationYear: null,
  relationshipStrength: 3,
  relationshipLabel: null,
  remindersEnabled: true,
  reminderIntervalDays: null,
  status: "active",
  firstMetAt: "2026-01-04",
  firstMetLocation: null,
  generalNotes: null,
  createdAt: "2026-01-04T00:00:00.000Z",
  updatedAt: "2026-01-04T00:00:00.000Z",
  lastInteractionAt: null,
  tags: [],
};

jest.mock("@/lib/data", () => ({
  getPeople: jest.fn(async () => [mockPerson]),
  getPeopleCached: jest.fn(async () => [mockPerson]),
}));

const noteAboutAmelia: SearchResult = {
  kind: "note",
  recordId: "note-1",
  personIds: ["person-1"],
  title: "Coffee at Blue Bottle",
  snippet: "She is moving to Lisbon in the spring.",
  occurredAt: null,
  rank: 0.61,
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderSearchScreen() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SearchScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockSearchEverything.mockReset();
  mockSearchEverything.mockResolvedValue({ status: "ready", results: [] });
  delete mockParams.q;
});

describe("the search field", () => {
  it("is there, labelled, and says what it searches", async () => {
    await renderSearchScreen();

    expect(await screen.findByLabelText("Search everything you have written")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search…")).toBeTruthy();
    expect(
      screen.getByText("People, updates, notes, interactions, classes and reminders."),
    ).toBeTruthy();
  });

  it("waits to be given something before it says anything about results", async () => {
    await renderSearchScreen();

    expect(await screen.findByText("What are you looking for?")).toBeTruthy();
    expect(mockSearchEverything).not.toHaveBeenCalled();
  });
});

describe("arriving with a query already in the address", () => {
  it("searches for the q parameter without anyone typing it again", async () => {
    mockParams.q = "lisbon";
    mockSearchEverything.mockResolvedValue({ status: "ready", results: [noteAboutAmelia] });

    await renderSearchScreen();

    expect(await screen.findByText("Coffee at Blue Bottle")).toBeTruthy();
    expect(mockSearchEverything).toHaveBeenCalledWith("lisbon");
  });

  it("puts a match under the name of the person it is about", async () => {
    mockParams.q = "lisbon";
    mockSearchEverything.mockResolvedValue({ status: "ready", results: [noteAboutAmelia] });

    await renderSearchScreen();

    expect(await screen.findByText("Amelia Chen")).toBeTruthy();
    expect(screen.getByText("Note")).toBeTruthy();
    expect(screen.getByText("She is moving to Lisbon in the spring.")).toBeTruthy();
    expect(screen.queryByText("Not tied to anyone")).toBeNull();
  });
});

describe("the states a search can end in", () => {
  it("explains that search needs a connection when the phone has none", async () => {
    mockParams.q = "lisbon";
    mockSearchEverything.mockResolvedValue({ status: "offline" });

    await renderSearchScreen();

    expect(await screen.findByText("You are offline")).toBeTruthy();
    expect(
      screen.getByText(
        "Search runs against your account rather than the copy on this phone, so it needs a connection.",
      ),
    ).toBeTruthy();
  });

  it("says search is not switched on yet, and does not call that no matches", async () => {
    mockParams.q = "lisbon";
    mockSearchEverything.mockResolvedValue({ status: "unavailable" });

    await renderSearchScreen();

    expect(await screen.findByText("Search is not switched on yet")).toBeTruthy();
    expect(
      screen.getByText("Search turns on once migration 0028 has been applied to the database."),
    ).toBeTruthy();
    expect(screen.queryByText(/No matches/)).toBeNull();
  });

  it("names the query back when nothing mentions it", async () => {
    mockParams.q = "lisbon";
    mockSearchEverything.mockResolvedValue({ status: "ready", results: [] });

    await renderSearchScreen();

    expect(await screen.findByText('No matches for "lisbon"')).toBeTruthy();
    expect(screen.getByText("Nothing you have written mentions that.")).toBeTruthy();
  });

  it("reports a search that failed outright, with the reason", async () => {
    mockParams.q = "lisbon";
    mockSearchEverything.mockRejectedValue(new Error("network request failed"));

    await renderSearchScreen();

    expect(await screen.findByText("Search could not run")).toBeTruthy();
    expect(screen.getByText("network request failed")).toBeTruthy();
  });
});
