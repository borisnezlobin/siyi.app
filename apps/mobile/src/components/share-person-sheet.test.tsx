import { render, screen, waitFor } from "@testing-library/react-native";

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

describe("the share sheet", () => {
  it("offers only the contact card until migration 0015 has been applied", async () => {
    listShares.mockResolvedValue({ available: false, shares: [] });

    await render(
      <SharePersonSheet person={person} visible onClose={() => {}} />,
    );

    await waitFor(() => expect(listShares).toHaveBeenCalled());

    // Exactly today's behaviour: the card button, no link controls, no error.
    expect(screen.getByText("Share contact card")).toBeTruthy();
    expect(screen.queryByText("Create a link")).toBeNull();
    expect(screen.queryByText("Or send a link")).toBeNull();
  });

  it("offers a link, defaulting to thirty days, once the table exists", async () => {
    listShares.mockResolvedValue({ available: true, shares: [] });

    await render(
      <SharePersonSheet person={person} visible onClose={() => {}} />,
    );

    await waitFor(() => expect(screen.getByText("Or send a link")).toBeTruthy());

    expect(screen.getByText("Share contact card")).toBeTruthy();
    expect(screen.getByText("Create a link")).toBeTruthy();
    expect(
      screen.getByLabelText("30 days").props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByLabelText("No expiry").props.accessibilityState.selected,
    ).toBe(false);
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

    await render(
      <SharePersonSheet person={person} visible onClose={() => {}} />,
    );

    await waitFor(() => expect(screen.getByText(/abcdefgh/)).toBeTruthy());
    expect(screen.getByLabelText("Turn off link")).toBeTruthy();
    expect(screen.getByLabelText("Send link")).toBeTruthy();
  });
});
