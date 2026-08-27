// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUserFacts } from "@/lib/admin";
import type * as adminDataModule from "@/lib/admin-data";

afterEach(cleanup);

const getAuthenticatedUser = vi.fn();
const getAdminUserFacts = vi.fn();
const listAnnouncements = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

// Only the two edges are stood in for: the cookie/session transport, and the
// database. The allowlist gate, the aggregation and the dashboard itself all
// run for real, which is the part worth proving.
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: () => getAuthenticatedUser(),
}));
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));
vi.mock("@/lib/admin-data", async () => {
  const actual = await vi.importActual<typeof adminDataModule>("@/lib/admin-data");
  return {
    ...actual,
    getAdminUserFacts: () => getAdminUserFacts(),
    listAnnouncements: () => listAnnouncements(),
  };
});

const AdminPage = (await import("@/app/(app)/admin/page")).default;

const dayInMs = 24 * 60 * 60 * 1000;
const now = Date.now();

function user(overrides: Partial<AdminUserFacts> = {}): AdminUserFacts {
  return {
    userId: "u-1",
    createdAt: new Date(now - 2 * dayInMs).toISOString(),
    contactCount: 5,
    pushEnabled: false,
    lastActiveAt: new Date(now - dayInMs).toISOString(),
    marketingOptIn: false,
    emailConfirmedAt: new Date(now - dayInMs).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  getAuthenticatedUser.mockReset();
  listAnnouncements.mockReset().mockResolvedValue({ announcements: [] });
  getAdminUserFacts.mockReset().mockResolvedValue([
    user({ userId: "u-1", pushEnabled: true, contactCount: 5 }),
    user({ userId: "u-2", contactCount: 120 }),
    user({
      userId: "u-3",
      contactCount: 0,
      lastActiveAt: new Date(now - 90 * dayInMs).toISOString(),
      createdAt: new Date(now - 90 * dayInMs).toISOString(),
    }),
  ]);
});

const admin = {
  id: "admin-1",
  email: "boris@siyi.app",
  email_confirmed_at: new Date().toISOString(),
};

/**
 * The whole chain an authenticated admin actually travels: the allowlist
 * decides, the facts are aggregated, and the dashboard renders the numbers.
 * Everything here except the session transport and the database is the real
 * code that runs in production.
 */
describe("arriving at /admin as an allowlisted admin", () => {
  it("renders the console, with the aggregates computed from real facts", async () => {
    vi.stubEnv("ADMIN_USER_IDS", "admin-1");
    getAuthenticatedUser.mockResolvedValue(admin);

    render(await AdminPage());

    expect(screen.getByRole("heading", { name: "Admin" })).toBeTruthy();
    expect(screen.getByText("How siyi is doing")).toBeTruthy();
    // Three accounts, one with push, 125 contacts between them.
    expect(screen.getByText("Total users")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Contacts saved")).toBeTruthy();
    expect(screen.getByText("125")).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("offers each segment with the count that segment really has", async () => {
    vi.stubEnv("ADMIN_USER_IDS", "admin-1");
    getAuthenticatedUser.mockResolvedValue(admin);

    render(await AdminPage());

    // Counts come from segmentCounts over the same facts: everyone is 3, one
    // account has push, one has 100+ contacts, one has been quiet 90 days.
    expect(screen.getByRole("option", { name: "Everyone (3)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Push turned on (1)" })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "100 or more contacts (1)" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Quiet for 30 days (1)" }),
    ).toBeTruthy();
  });

  it("is allowed in by a confirmed allowlisted address when no ids are set", async () => {
    vi.stubEnv("ADMIN_USER_IDS", "");
    vi.stubEnv("ADMIN_EMAILS", "boris@siyi.app");
    getAuthenticatedUser.mockResolvedValue(admin);

    render(await AdminPage());

    expect(screen.getByText("How siyi is doing")).toBeTruthy();
  });

  it("still renders the console when the stats query fails, and says so", async () => {
    vi.stubEnv("ADMIN_USER_IDS", "admin-1");
    getAuthenticatedUser.mockResolvedValue(admin);
    getAdminUserFacts.mockRejectedValue(new Error("database is down"));

    render(await AdminPage());

    expect(screen.getByText(/Stats could not be loaded right now/)).toBeTruthy();
    // The announcement composer is the part an admin may still need urgently.
    expect(screen.getByText("Send an announcement")).toBeTruthy();
  });
});

describe("arriving at /admin as anyone else", () => {
  it("is refused when no allowlist is configured at all", async () => {
    vi.stubEnv("ADMIN_USER_IDS", "");
    vi.stubEnv("ADMIN_EMAILS", "");
    getAuthenticatedUser.mockResolvedValue(admin);

    await expect(AdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getAdminUserFacts).not.toHaveBeenCalled();
  });

  it("is refused when signed out", async () => {
    vi.stubEnv("ADMIN_USER_IDS", "admin-1");
    getAuthenticatedUser.mockResolvedValue(null);

    await expect(AdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is refused for a signed-in user who is not on the list", async () => {
    vi.stubEnv("ADMIN_USER_IDS", "somebody-else");
    getAuthenticatedUser.mockResolvedValue(admin);

    await expect(AdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getAdminUserFacts).not.toHaveBeenCalled();
  });

  it("is refused for an allowlisted address that was never confirmed", async () => {
    vi.stubEnv("ADMIN_USER_IDS", "");
    vi.stubEnv("ADMIN_EMAILS", "boris@siyi.app");
    getAuthenticatedUser.mockResolvedValue({ ...admin, email_confirmed_at: null });

    await expect(AdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
