import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AdminScreen from "@/app/(app)/admin";
import type { AdminStats } from "@/lib/admin-client";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("expo-crypto", () => ({
  randomUUID: () => "dedupe-key",
}));

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: jest.requireActual("react-native").TextInput,
}));

jest.mock("@expo/ui/community/datetime-picker", () => ({
  DateTimePicker: () => null,
}));

const mockFetchOverview = jest.fn();
const mockFetchAnnouncements = jest.fn();
const mockPublish = jest.fn();

jest.mock("@/lib/admin-client", () => ({
  fetchAdminOverview: (...args: unknown[]) => mockFetchOverview(...args),
  fetchAdminAnnouncements: (...args: unknown[]) =>
    mockFetchAnnouncements(...args),
  publishAnnouncement: (...args: unknown[]) => mockPublish(...args),
  pushAnnouncement: jest.fn(),
}));

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ session: { access_token: "token" } }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const stats: AdminStats = {
  totalUsers: 12,
  totalContacts: 240,
  newUsersLast7: 3,
  newUsersLast30: 8,
  signupsByWeek: [{ weekStarting: "2026-08-03", users: 3 }],
  contactBuckets: [{ id: "1-10", label: "1-10", users: 5 }],
  pushEnabledUsers: 7,
  activeLast7: 6,
  activeLast30: 9,
};

const segments = [
  {
    id: "all",
    label: "Everyone",
    description: "Every account with a profile.",
    users: 12,
  },
  {
    id: "push-enabled",
    label: "Push turned on",
    description: "Accounts with at least one live push subscription.",
    users: 7,
  },
];

async function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AdminScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockFetchOverview.mockReset();
  mockFetchAnnouncements.mockReset().mockResolvedValue([]);
  mockPublish.mockReset().mockResolvedValue({
    announcement: null,
    alreadyCreated: false,
  });
});

/**
 * The route is unlisted and reached by deep link, so the branch that matters
 * most is the one a non-admin hits: every admin endpoint answers 404, and the
 * screen has to look like a page that does not exist rather than one that is
 * merely locked.
 */
describe("someone who is not an admin", () => {
  it("is told the page does not exist, and shown no numbers", async () => {
    mockFetchOverview.mockResolvedValue(null);

    await renderScreen();

    expect(await screen.findByText("This page does not exist.")).toBeTruthy();
    expect(screen.queryByText("Total users")).toBeNull();
    expect(screen.queryByText("Send an announcement")).toBeNull();
  });

  it("never asks the announcements endpoint at all", async () => {
    mockFetchOverview.mockResolvedValue(null);

    await renderScreen();

    await screen.findByText("This page does not exist.");
    expect(mockFetchAnnouncements).not.toHaveBeenCalled();
  });
});

describe("the admin console", () => {
  it("shows the aggregate numbers, and says they are only aggregates", async () => {
    mockFetchOverview.mockResolvedValue({ stats, segments });

    await renderScreen();

    expect(await screen.findByText("Total users")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(
      screen.getByText(
        "Aggregates only. Nobody’s name, email, or contacts appear here.",
      ),
    ).toBeTruthy();
  });

  it("asks for a review before anything is published", async () => {
    mockFetchOverview.mockResolvedValue({ stats, segments });

    await renderScreen();
    await screen.findByText("Total users");

    await fireEvent.changeText(screen.getByLabelText("Title"), "We shipped");
    await fireEvent.changeText(screen.getByLabelText("Message"), "Have a look.");
    await fireEvent.press(screen.getByText("Review before sending"));

    // Publishing is a second, deliberate press on a differently worded button.
    expect(await screen.findByText("Publish to 12 people")).toBeTruthy();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("sends the chosen segment rather than always everyone", async () => {
    mockFetchOverview.mockResolvedValue({ stats, segments });

    await renderScreen();
    await screen.findByText("Total users");

    await fireEvent.press(screen.getByLabelText("Push turned on, 7"));
    await fireEvent.changeText(screen.getByLabelText("Title"), "We shipped");
    await fireEvent.changeText(screen.getByLabelText("Message"), "Have a look.");
    await fireEvent.press(screen.getByText("Review before sending"));
    await fireEvent.press(await screen.findByText("Publish to 7 people"));

    expect(mockPublish).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        segment: "push-enabled",
        title: "We shipped",
        body: "Have a look.",
      }),
    );
  });

  it("takes the hide-after date in any spelling, like every other date", async () => {
    mockFetchOverview.mockResolvedValue({ stats, segments });

    await renderScreen();
    await screen.findByText("Total users");

    await fireEvent.changeText(
      screen.getByLabelText("Hide it after"),
      "March 18 2027",
    );

    expect(await screen.findByText("March 18, 2027")).toBeTruthy();
  });
});
