import {
  fetchAdminAnnouncements,
  fetchAdminOverview,
  publishAnnouncement,
} from "@/lib/admin-client";
import { fetchLiveAnnouncements } from "@/lib/announcements";

const session = { access_token: "the-token" } as never;
const webUrl = "https://siyi.app";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
  };
}

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

/**
 * The seam between the phone's screens and the web's admin API: nothing here
 * has an opinion about who is an admin, so what matters is that the session
 * token is presented and that a 404 is read as "not an admin" rather than
 * surfacing as a crash.
 */
describe("talking to the admin API", () => {
  it("presents the session token, so the web can decide who is asking", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ stats: {}, segments: [] }));

    await fetchAdminOverview(session, webUrl);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://siyi.app/api/admin/stats");
    expect(init.headers.Authorization).toBe("Bearer the-token");
  });

  it("reads a 404 as not-an-admin rather than throwing", async () => {
    mockFetch.mockResolvedValue(jsonResponse(null, 404));

    await expect(fetchAdminOverview(session, webUrl)).resolves.toBeNull();
  });

  it("never leaves a half-built list when announcements fail", async () => {
    mockFetch.mockResolvedValue(jsonResponse(null, 500));

    await expect(fetchAdminAnnouncements(session, webUrl)).resolves.toEqual([]);
  });

  it("sends the draft as the web route expects it", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ announcement: null, alreadyCreated: false }),
    );

    await publishAnnouncement(session, webUrl, {
      title: "We shipped",
      body: "Have a look.",
      segment: "push-enabled",
      endsAt: null,
      dedupeKey: "key-1",
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://siyi.app/api/admin/announcements");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      title: "We shipped",
      body: "Have a look.",
      segment: "push-enabled",
      endsAt: null,
      dedupeKey: "key-1",
    });
  });

  // Publishing is the one call that is allowed to throw: the admin is standing
  // there waiting to hear whether it went out.
  it("tells the admin when a publish did not land", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: "Nope" }, 500));

    await expect(
      publishAnnouncement(session, webUrl, {
        title: "t",
        body: "b",
        segment: "all",
        endsAt: null,
        dedupeKey: "k",
      }),
    ).rejects.toThrow("Nope");
  });
});

describe("the banner's own request", () => {
  it("asks the public endpoint, with the token", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ announcements: [] }));

    await fetchLiveAnnouncements(session, webUrl);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://siyi.app/api/announcements");
    expect(init.headers.Authorization).toBe("Bearer the-token");
  });

  it("shows no banner rather than an error when the request fails", async () => {
    mockFetch.mockRejectedValue(new Error("offline"));

    await expect(fetchLiveAnnouncements(session, webUrl)).resolves.toEqual([]);
  });

  it("does nothing at all when no web URL is configured", async () => {
    await expect(fetchLiveAnnouncements(session, "")).resolves.toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
