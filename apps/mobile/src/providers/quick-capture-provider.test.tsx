import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("@gorhom/bottom-sheet", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@/test-support/bottom-sheet").bottomSheetMock(),
);

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: {
    Success: "success",
    Error: "error",
    Warning: "warning",
  },
}));

jest.mock("expo-image", () => ({
  Image: jest.requireActual("react-native").Image,
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: jest.requireActual("react-native").View,
}));

jest.mock("@expo/ui/community/datetime-picker", () => ({
  DateTimePicker: jest.requireActual("react-native").View,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/lib/data", () => ({
  createReminder: jest.fn(),
  createInteraction: jest.fn(),
  createPersonUpdate: jest.fn(),
  deleteInteraction: jest.fn(),
  deletePersonUpdate: jest.fn(),
  editInteraction: jest.fn(),
  editPersonUpdate: jest.fn(),
  getPeople: jest.fn(async () => []),
  getPersonDetails: jest.fn(),
  getRecentCustomLabels: jest.fn(async () => []),
}));

jest.mock("@/lib/contact-preferences", () => ({
  getPreferredContactMethod: jest.fn(async () => null),
  setPreferredContactMethod: jest.fn(),
}));

jest.mock("@/lib/on-device-intelligence", () => ({
  onDeviceConversationStarters: jest.fn(async () => []),
}));

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } } }),
}));

import {
  QuickCaptureProvider,
  useQuickCapture,
} from "@/providers/quick-capture-provider";
import {
  sheetFooterTestId,
  sheetScrollTestId,
} from "@/test-support/bottom-sheet";
import { createPersonUpdate, getPeople } from "@/lib/data";

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const people = [
  {
    id: "person-1",
    userId: "user-1",
    fullName: "Jordan Lee",
    preferredName: "Jordan",
    status: "active",
    relationshipStrength: 2,
    remindersEnabled: true,
    createdAt: "2026-08-01T12:00:00.000Z",
    lastInteractionAt: "2026-08-01T12:00:00.000Z",
    tags: [],
  },
];

type Phase = "interaction" | "update" | "reminder" | "menu";

/** Opens the composer straight into one phase, the way a tab button does. */
function Opener({ phase }: { phase: Phase }) {
  const capture = useQuickCapture();

  useEffect(() => {
    if (phase === "interaction") capture.logInteraction();
    else if (phase === "update") capture.addUpdate();
    else if (phase === "reminder") capture.addReminder();
    else capture.open();
    // Once, on mount: this stands in for a single tap on a menu button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

async function openComposer(phase: Phase) {
  const rendered = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QuickCaptureProvider>
        <Opener phase={phase} />
      </QuickCaptureProvider>
    </SafeAreaProvider>,
  );
  await act(async () => {});
  return rendered;
}

beforeEach(() => {
  (getPeople as jest.Mock).mockResolvedValue(people);
});

describe("the quick capture composer", () => {
  it.each([
    ["interaction" as const, "Log interaction"],
    ["update" as const, "Save update"],
    ["reminder" as const, "Save reminder"],
  ])(
    "pins %s's save button in the footer rather than after the fields",
    async (phase, label) => {
      await openComposer(phase);
      await waitFor(() => expect(screen.getByText(label)).toBeTruthy());

      // The footer is what the library keeps above the keyboard. A button in
      // the scrolling body can sit under the keyboard with nothing to show for
      // it, which is exactly the bug this replaces.
      expect(
        within(screen.getByTestId(sheetFooterTestId)).getByText(label),
      ).toBeTruthy();
      expect(
        within(screen.getByTestId(sheetScrollTestId)).queryByText(label),
      ).toBeNull();
    },
  );

  it("puts what went wrong beside the button, not at the end of the form", async () => {
    (createPersonUpdate as jest.Mock).mockRejectedValueOnce(
      new Error("That update could not be saved."),
    );
    await openComposer("update");
    await waitFor(() => expect(screen.getByText("Jordan")).toBeTruthy());

    await fireEvent.press(screen.getByText("Jordan"));
    await fireEvent.changeText(
      screen.getByLabelText("What did you learn?"),
      "Got into photography",
    );
    await fireEvent.press(screen.getByText("Save update"));

    // A failure printed under a form you have to scroll through is a failure
    // nobody sees. It belongs next to the button that caused it.
    await waitFor(() =>
      expect(
        within(screen.getByTestId(sheetFooterTestId)).getByText(
          "That update could not be saved.",
        ),
      ).toBeTruthy(),
    );
  });

  it("asks the field being typed in to scroll itself into view", async () => {
    await openComposer("update");

    const field = await screen.findByLabelText("What did you learn?");

    // Nothing to assert about pixels under jest; what matters structurally is
    // that the field reports its focus at all, which is what the scrolling
    // area acts on.
    expect(field.props.onFocus).toEqual(expect.any(Function));
  });

  it("leaves the menu without a footer, because its actions are the list", async () => {
    await openComposer("menu");

    expect(screen.getByText("Capture the moment")).toBeTruthy();
    expect(screen.queryByTestId(sheetFooterTestId)).toBeNull();
  });
});
