import { act, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * The last props the sheet shell handed to the library, so a test can do what a
 * swipe down or a backdrop tap does: run the library's own dismissal.
 */
const mockSheet: { props: Record<string, unknown> } = { props: {} };

// The real sheet runs on the worklet runtime, which does not exist under Jest.
// This stand-in keeps the parts the app depends on: nothing is on screen until
// the sheet is presented, and every way of dismissing it ends in onDismiss.
jest.mock("@gorhom/bottom-sheet", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");

  return {
    __esModule: true,
    BottomSheetBackdrop: (props: Record<string, unknown>) =>
      React.createElement(View, props),
    BottomSheetModal: React.forwardRef(function BottomSheetModal(
      props: { children?: unknown; onDismiss?: () => void },
      ref: unknown,
    ) {
      const [presented, setPresented] = React.useState(false);
      // The library has no early exit for dismissing a sheet in its initial
      // state: it marks the sheet as dismissing and then refuses to render, so
      // every later present() is swallowed. Modelled here because that is the
      // bug that stopped the share button working.
      const everPresented = React.useRef(false);
      const poisoned = React.useRef(false);
      mockSheet.props = props as Record<string, unknown>;
      React.useImperativeHandle(ref, () => ({
        present: () => {
          if (poisoned.current) return;
          everPresented.current = true;
          setPresented(true);
        },
        dismiss: () => {
          if (!everPresented.current) poisoned.current = true;
          setPresented(false);
          props.onDismiss?.();
        },
      }));
      return presented
        ? React.createElement(View, { testID: "bottom-sheet" }, props.children)
        : null;
    }),
    BottomSheetScrollView: ({ children, ...rest }: { children?: unknown }) =>
      React.createElement(View, rest, children),
    BottomSheetView: ({ children, ...rest }: { children?: unknown }) =>
      React.createElement(View, rest, children),
  };
});

jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn() }));

jest.mock("@/lib/on-device-intelligence", () => ({
  onDeviceShortBio: jest.fn(async () => null),
}));

jest.mock("@/lib/share-contact", () => ({
  sharePersonCard: jest.fn(async () => true),
}));

jest.mock("@/lib/person-share-data", () => ({
  listPersonShares: jest.fn(),
  createPersonShare: jest.fn(),
  revokePersonShare: jest.fn(),
  shareUrl: (share: { token: string }) => `https://www.siyi.app/s/${share.token}`,
}));

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ session: { user: { id: "owner-1" } } }),
}));

import { SharePersonSheet } from "@/components/share-person-sheet";
import { listPersonShares } from "@/lib/person-share-data";
import type { Person } from "@/lib/types";

const person = {
  id: "person-1",
  slug: null,
  userId: "owner-1",
  fullName: "Maya Chen",
  preferredName: "May",
  profilePhotoUrl: null,
  profilePhotoPath: null,
  instagramUsername: "mayamakes",
  phoneNumber: "+1 415 555 0134",
  email: "maya@example.edu",
  birthday: "2004-05-12",
  hometown: "Portland",
  dormOrResidence: null,
  university: "Berkeley",
  major: "Ceramics",
  graduationYear: 2027,
  relationshipStrength: 3,
  relationshipLabel: null,
  remindersEnabled: true,
  reminderIntervalDays: null,
  status: "active",
  firstMetAt: "2026-01-01",
  firstMetLocation: null,
  generalNotes: "Private.",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  lastInteractionAt: null,
  tags: [],
} as unknown as Person;

const listShares = listPersonShares as jest.Mock;

function sheetFor(visible: boolean, onClose: () => void) {
  return (
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <SharePersonSheet person={person} visible={visible} onClose={onClose} />
    </SafeAreaProvider>
  );
}

async function renderSheet(onClose: () => void = () => {}) {
  return render(sheetFor(true, onClose));
}

describe("the share sheet", () => {
  beforeEach(() => {
    mockSheet.props = {};
  });

  it("offers only the contact card until migration 0015 has been applied", async () => {
    listShares.mockResolvedValue({ available: false, shares: [] });

    await renderSheet();

    await waitFor(() => expect(listShares).toHaveBeenCalled());

    // Exactly today's behaviour: the card button, no link controls, no error.
    expect(screen.getByText("Share contact card")).toBeTruthy();
    expect(screen.queryByText("Create a link")).toBeNull();
    expect(screen.queryByText("Or send a link")).toBeNull();
  });

  it("offers copying the link once the table exists", async () => {
    listShares.mockResolvedValue({ available: true, shares: [] });

    await renderSheet();

    await waitFor(() => expect(screen.getByText("Copy link")).toBeTruthy());

    // One link action, not three. The contact card is gone entirely.
    expect(screen.getByText("Share link")).toBeTruthy();
    expect(screen.queryByText("Share contact card")).toBeNull();
    expect(screen.queryByText("Create a link")).toBeNull();
  });

  it("lists a live link with its expiry and a way to turn it off", async () => {
    listShares.mockResolvedValue({
      available: true,
      shares: [
        {
          id: "share-1",
          personId: "person-1",
          token: "abcdefgh".repeat(4),
          selection: {},
          expiresAt: "2026-09-05T00:00:00.000Z",
          revokedAt: null,
          lastViewedAt: null,
          viewCount: 0,
          createdAt: "2026-08-06T00:00:00.000Z",
        },
      ],
    });

    await renderSheet();

    await waitFor(() => expect(screen.getByText(/abcdefgh/)).toBeTruthy());
    expect(screen.getByLabelText("Turn off link")).toBeTruthy();
    expect(screen.getByLabelText("Send link")).toBeTruthy();
  });

  it("opens when asked and goes away again", async () => {
    listShares.mockResolvedValue({ available: false, shares: [] });

    const { rerender } = await render(sheetFor(false, () => {}));
    expect(screen.queryByText("Share May")).toBeNull();

    await act(async () => rerender(sheetFor(true, () => {})));
    expect(screen.getByText("Share May")).toBeTruthy();

    await act(async () => rerender(sheetFor(false, () => {})));
    expect(screen.queryByText("Share May")).toBeNull();
  });

  it("closes when the sheet itself is dismissed, not only from the close button", async () => {
    listShares.mockResolvedValue({ available: false, shares: [] });
    const onClose = jest.fn();

    await renderSheet(onClose);
    await waitFor(() => expect(screen.getByText("Share May")).toBeTruthy());

    // A backdrop that fades on its own, and a sheet that can be dragged away.
    expect(mockSheet.props.backdropComponent).toEqual(expect.any(Function));
    expect(mockSheet.props.enablePanDownToClose).not.toBe(false);

    // Swiping down and tapping the backdrop both land here.
    await act(async () => {
      (mockSheet.props.onDismiss as () => void)();
    });

    expect(onClose).toHaveBeenCalled();
  });
});
