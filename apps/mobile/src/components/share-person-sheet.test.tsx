import {
  act,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

jest.mock("@gorhom/bottom-sheet", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@/test-support/bottom-sheet").bottomSheetMock(),
);

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

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
import {
  sheetFooterTestId,
  sheetScrollTestId,
  sheetSpy as mockSheet,
} from "@/test-support/bottom-sheet";
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

  it("offers copying the link once the table exists", async () => {
    listShares.mockResolvedValue([]);

    await renderSheet();

    await waitFor(() => expect(screen.getByText("Copy link")).toBeTruthy());

    // A link and the card, both pinned; no separate "create" step.
    expect(screen.getByText("Share link")).toBeTruthy();
    expect(screen.getByText("Share contact card")).toBeTruthy();
    expect(screen.queryByText("Create a link")).toBeNull();
  });

  it("lists a live link with its expiry and a way to turn it off", async () => {
    listShares.mockResolvedValue([
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
    ]);

    await renderSheet();

    await waitFor(() => expect(screen.getByText(/abcdefgh/)).toBeTruthy());
    expect(screen.getByLabelText("Turn off link")).toBeTruthy();
    expect(screen.getByLabelText("Send link")).toBeTruthy();
  });

  it("pins the share action in the footer, out of the scrolling region", async () => {
    listShares.mockResolvedValue([]);

    await renderSheet();
    await waitFor(() => expect(screen.getByText("Copy link")).toBeTruthy());

    // Ticking every field and listing links makes the body taller than the
    // sheet, so an action inside it would be below the fold.
    const footer = screen.getByTestId(sheetFooterTestId);
    expect(within(footer).getByText("Copy link")).toBeTruthy();
    expect(within(footer).getByText("Share link")).toBeTruthy();

    const scrolling = screen.getByTestId(sheetScrollTestId);
    expect(within(scrolling).queryByText("Copy link")).toBeNull();
    expect(within(scrolling).queryByText("Share link")).toBeNull();
  });

  it("pins the contact-card action too, when there are no links", async () => {
    listShares.mockResolvedValue([]);

    await renderSheet();
    await waitFor(() => expect(listShares).toHaveBeenCalled());

    const footer = screen.getByTestId(sheetFooterTestId);
    expect(within(footer).getByText("Share contact card")).toBeTruthy();
    expect(
      within(screen.getByTestId(sheetScrollTestId)).queryByText(
        "Share contact card",
      ),
    ).toBeNull();
  });

  it("opens when asked and goes away again", async () => {
    listShares.mockResolvedValue([]);

    const { rerender } = await render(sheetFor(false, () => {}));
    expect(screen.queryByText("Share May")).toBeNull();

    await act(async () => rerender(sheetFor(true, () => {})));
    expect(screen.getByText("Share May")).toBeTruthy();

    await act(async () => rerender(sheetFor(false, () => {})));
    expect(screen.queryByText("Share May")).toBeNull();
  });

  it("closes when the sheet itself is dismissed, not only from the close button", async () => {
    listShares.mockResolvedValue([]);
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
