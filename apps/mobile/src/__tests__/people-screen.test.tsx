import { render, screen } from "@testing-library/react-native";
import * as mockReact from "react";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import PeopleScreen from "@/app/(app)/(tabs)/people";
import { liquidGlassAvailable } from "@/components/glass-surface";
import { colors } from "@/constants/theme";
import type { Person } from "@/lib/types";

// Stand in for a phone with no Liquid Glass — Android, or iOS before 26 —
// which is the case where the controls have to draw their own fill.
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
  useFocusEffect: (callback: () => void) =>
    mockReact.useEffect(() => callback(), [callback]),
}));

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } } }),
}));

jest.mock("@/providers/quick-capture-provider", () => ({
  useQuickCapture: () => ({ open: jest.fn(), revision: 0 }),
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
  getAccountSettings: jest.fn(async () => ({
    reminderDefaults: { 1: 90, 2: 45, 3: 30, 4: 14 },
  })),
}));

jest.mock("@/lib/classes-data", () => ({
  getClasses: jest.fn(async () => []),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type RenderedNode = {
  props: { style?: unknown };
  parent: RenderedNode | null;
};

async function renderPeopleScreen() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PeopleScreen />
    </SafeAreaProvider>,
  );
  return screen.findByPlaceholderText("Search…");
}

/**
 * The nearest thing that draws behind a node. Each control is its own piece of
 * glass now, so its fill sits on an ancestor rather than on the pressable, and
 * the walk has to keep going until it finds one.
 */
function fillBehind(node: unknown): string | undefined {
  let current = node as RenderedNode | null;
  while (current) {
    const flattened = StyleSheet.flatten(
      current.props?.style as never,
    ) as { backgroundColor?: string } | undefined;
    if (flattened?.backgroundColor) return flattened.backgroundColor;
    current = current.parent;
  }
  return undefined;
}

describe("what the People screen says it searches", () => {
  it("asks for a search and spells out the fields underneath the heading", async () => {
    await renderPeopleScreen();

    expect(screen.getByText("People")).toBeTruthy();
    expect(
      screen.getByText(
        "Search by name, school, class, hometown, major, dorm, or tag.",
      ),
    ).toBeTruthy();
    // A real ellipsis, not three periods pretending to be one.
    expect(screen.getByPlaceholderText("Search…")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Search...")).toBeNull();
  });
});

/**
 * Liquid Glass draws its own material, so a control that sits on it carries no
 * fill of its own. On Android, and on iOS before 26, there is no material — and
 * a control with neither would be invisible against the page. The fill checked
 * for is the control's own paper, not the porcelain of the page behind it, so
 * dropping the fallback fails here instead of shipping.
 */
describe("the search and shortcut controls without Liquid Glass", () => {
  it("is exercised only where the system has no Liquid Glass", () => {
    expect(liquidGlassAvailable).toBe(false);
  });

  it("still fills the search field", async () => {
    const input = await renderPeopleScreen();

    expect(fillBehind(input)).toBe(colors.paper);
  });

  it("still fills the filter button", async () => {
    await renderPeopleScreen();

    expect(fillBehind(screen.getByLabelText("Show filters"))).toBe(
      colors.paper,
    );
  });

  it("still fills every shortcut", async () => {
    await renderPeopleScreen();

    for (const label of ["Birthdays", "Classes", "Map"]) {
      expect(fillBehind(screen.getByText(label))).toBe(colors.paper);
    }
  });
});
