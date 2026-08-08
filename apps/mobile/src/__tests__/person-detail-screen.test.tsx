import { render, screen } from "@testing-library/react-native";
import * as mockReact from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import PersonDetailScreen from "@/app/(app)/people/[id]";
import type { Person } from "@/lib/types";

const mockParams: { id: string; catchUp?: string } = { id: "person-1" };

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) =>
    mockReact.useEffect(() => callback(), [callback]),
}));

jest.mock("expo-image", () => ({
  Image: jest.requireActual("react-native").Image,
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Error: "error", Success: "success" },
}));

jest.mock("@/components/ambient-header", () => ({
  AmbientHeader: () => null,
}));

jest.mock("@/components/share-person-sheet", () => ({
  SharePersonSheet: () => null,
}));

jest.mock("@/components/person-classes", () => ({ PersonClasses: () => null }));

const mockGetPersonDetails = jest.fn();

jest.mock("@/lib/data", () => ({
  archivePerson: jest.fn(),
  getPersonDetails: (...args: unknown[]) => mockGetPersonDetails(...args),
  noteSectionsOf: () => ({ sections: [] }),
}));

jest.mock("@/lib/classes-data", () => ({
  getClasses: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } } }),
}));

const mockCatchUp = jest.fn();

jest.mock("@/providers/quick-capture-provider", () => ({
  useQuickCapture: () => ({ catchUp: mockCatchUp, revision: 0 }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const nadia: Person = {
  id: "person-1",
  slug: "nadia-rahman",
  userId: "user-1",
  fullName: "Nadia Rahman",
  preferredName: null,
  profilePhotoUrl: null,
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
};

async function openPerson() {
  mockGetPersonDetails.mockResolvedValue({
    person: nadia,
    interactions: [],
    reminders: [],
    updates: [],
  });

  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PersonDetailScreen />
    </SafeAreaProvider>,
  );

  return screen.findByText("Nadia Rahman");
}

describe("a person's screen", () => {
  beforeEach(() => {
    mockParams.id = "person-1";
    delete mockParams.catchUp;
    mockCatchUp.mockClear();
  });

  /**
   * The header's entrance belongs to the screen, not to the row that was
   * tapped, so the ways in that have no row behind them have to look the same.
   */
  it("opens the same way from a notification as from anywhere else", async () => {
    expect(await openPerson()).toBeTruthy();

    expect(screen.getByLabelText("Nadia Rahman's initials")).toBeTruthy();
    expect(screen.getByTestId("person-profile-avatar")).toBeTruthy();
    expect(screen.getByTestId("person-profile-name")).toBeTruthy();
  });

  it("opens from a shared link, where the id is a slug rather than a uuid", async () => {
    mockParams.id = "nadia-rahman";

    expect(await openPerson()).toBeTruthy();

    expect(mockGetPersonDetails).toHaveBeenCalledWith("nadia-rahman");
    expect(screen.getByTestId("person-profile-avatar")).toBeTruthy();
  });

  it("opens from a reminder, which also asks for the catch-up composer", async () => {
    mockParams.catchUp = "1";

    expect(await openPerson()).toBeTruthy();

    expect(screen.getByTestId("person-profile-name")).toBeTruthy();
    expect(mockCatchUp).toHaveBeenCalledWith("person-1");
  });
});
