// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboard } from "@/components/admin-dashboard";
import type { AdminStats } from "@/lib/admin-data";

afterEach(cleanup);

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
  idle: { quiet: 3, withoutContacts: 2, emailUnverified: 1 },
  marketingSubscribers: 5,
};

const segments = [
  {
    id: "all",
    label: "Everyone",
    description: "Every account with a profile.",
    users: 12,
    subscribers: 5,
  },
  {
    id: "push-enabled",
    label: "Push turned on",
    description: "Accounts with at least one live push subscription.",
    users: 7,
    subscribers: 4,
  },
];

const sent = {
  id: "ann-1",
  title: "Reminders now arrive on your phone",
  body: "Turn them on in Settings.",
  segment: "all",
  startsAt: "2026-08-01T00:00:00.000Z",
  endsAt: null,
  createdBy: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  audienceSize: 12,
  pushSentAt: null,
  pushRecipientCount: null,
  pushDeliveredCount: null,
  pushFailedCount: null,
};

function renderDashboard(announcements = [] as (typeof sent)[]) {
  return render(
    <AdminDashboard
      stats={stats}
      segments={segments}
      initialAnnouncements={announcements}
      statsError={null}
    />,
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({ announcement: null, alreadyCreated: false }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

/**
 * Publishing writes to every user's app at once, so the parts worth pinning
 * down are the ones that decide who receives it and how many deliberate
 * actions stand between a typo and a send.
 */
describe("the admin dashboard", () => {
  it("shows the aggregates, and says they are only aggregates", () => {
    renderDashboard();

    expect(screen.getByText("Total users")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(
      screen.getByText(
        "Aggregates only. Nobody's name, email, or contacts appear here.",
      ),
    ).toBeTruthy();
  });

  it("never publishes straight from the compose form", () => {
    renderDashboard();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "We shipped" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Have a look." },
    });
    fireEvent.click(screen.getByText("Review before sending"));

    expect(screen.getByText("Publish to 12 people")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cannot be reviewed with an empty title or message", () => {
    renderDashboard();

    const review = screen.getByText("Review before sending") as HTMLButtonElement;
    expect(review.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Only a title" },
    });
    expect((screen.getByText("Review before sending") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("sends the chosen segment, and counts that segment rather than everyone", async () => {
    renderDashboard();

    fireEvent.change(screen.getByLabelText("Who sees it"), {
      target: { value: "push-enabled" },
    });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "We shipped" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Have a look." },
    });
    fireEvent.click(screen.getByText("Review before sending"));

    expect(screen.getByText("Publish to 7 people")).toBeTruthy();
    fireEvent.click(screen.getByText("Publish to 7 people"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/announcements");
    expect(JSON.parse(init.body)).toMatchObject({
      segment: "push-enabled",
      title: "We shipped",
      body: "Have a look.",
    });
  });

  it("still explains the chosen segment, without that becoming the field's name", () => {
    renderDashboard();

    // The description moved out of the <label>: inside it, a screen reader
    // read the whole sentence as the select's name.
    expect(screen.getByText("Every account with a profile.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Who sees it"), {
      target: { value: "push-enabled" },
    });
    expect(
      screen.getByText("Accounts with at least one live push subscription."),
    ).toBeTruthy();
  });

  it("asks again before a push, because the banner already went out", async () => {
    renderDashboard([sent]);

    fireEvent.click(screen.getByText("Send as push"));

    // Still nothing sent: the confirm is a second, differently worded button.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Yes, push to 12")).toBeTruthy();
  });

  it("says how a push actually landed rather than just that it was sent", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ recipients: 12, delivered: 10, failed: 2 }),
    });
    renderDashboard([sent]);

    fireEvent.click(screen.getByText("Send as push"));
    fireEvent.click(screen.getByText("Yes, push to 12"));

    expect(
      await screen.findByText("Pushed to 12 people: 10 delivered, 2 failed."),
    ).toBeTruthy();
  });

  it("carries a dedupe key, so a double publish cannot send twice", async () => {
    renderDashboard();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "We shipped" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Have a look." },
    });
    fireEvent.click(screen.getByText("Review before sending"));
    fireEvent.click(screen.getByText("Publish to 12 people"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(typeof body.dedupeKey).toBe("string");
    expect(body.dedupeKey.length).toBeGreaterThan(0);
  });
});
