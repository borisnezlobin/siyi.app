import { fireEvent, render, screen } from "@testing-library/react-native";
import { AnnouncementBanner } from "@/components/announcement-banner";

const mockFetch = jest.fn();
const mockDismiss = jest.fn();

jest.mock("@/lib/announcements", () => ({
  fetchLiveAnnouncements: (...args: unknown[]) => mockFetch(...args),
  dismissAnnouncement: (...args: unknown[]) => mockDismiss(...args),
}));

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ session: { access_token: "token" } }),
}));

const announcement = {
  id: "a1",
  title: "Reminders now arrive on your phone",
  body: "Turn on notifications in Settings.",
};

beforeEach(() => {
  mockFetch.mockReset().mockResolvedValue([]);
  mockDismiss.mockReset().mockResolvedValue(undefined);
});

/**
 * The banner is optional furniture on both platforms: anything going wrong
 * has to end in no banner rather than an error, because it sits on top of the
 * screen a user opens the app to.
 */
describe("the announcement banner", () => {
  it("shows nothing at all when there is nothing to say", async () => {
    await render(<AnnouncementBanner />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the first live announcement", async () => {
    mockFetch.mockResolvedValue([announcement]);

    await render(<AnnouncementBanner />);

    expect(
      await screen.findByText("Reminders now arrive on your phone"),
    ).toBeTruthy();
    expect(screen.getByText("Turn on notifications in Settings.")).toBeTruthy();
  });

  it("records the dismissal on the server, so the web does not show it again", async () => {
    mockFetch.mockResolvedValue([announcement]);

    await render(<AnnouncementBanner />);
    await screen.findByText("Reminders now arrive on your phone");
    await fireEvent.press(screen.getByLabelText("Dismiss announcement"));

    expect(screen.queryByText("Reminders now arrive on your phone")).toBeNull();
    expect(mockDismiss).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "a1",
    );
  });
});
