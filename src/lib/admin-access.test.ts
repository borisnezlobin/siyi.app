import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const requireAuthenticatedRequest = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const getAuthenticatedUser = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAuthenticatedRequest: (request: NextRequest) =>
    requireAuthenticatedRequest(request),
}));
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: () => getAuthenticatedUser(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

const { adminNotFound, requireAdminPageUser, resolveAdminRequest } = await import(
  "@/lib/admin-access"
);

const request = {} as NextRequest;

function signedInAs(email: string | null) {
  const user = { id: "user-1", email };
  requireAuthenticatedRequest.mockResolvedValue({ user, supabase: {} });
  getAuthenticatedUser.mockResolvedValue(user);
}

describe("guarding the admin area", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_EMAILS = "boris@example.com, jerry@example.com";
  });

  it("lets an allowlisted admin through on API routes", async () => {
    signedInAs("jerry@example.com");
    const context = await resolveAdminRequest(request);
    expect(context?.user.id).toBe("user-1");
  });

  it("matches the allowlist ignoring case and whitespace", async () => {
    signedInAs("  Jerry@Example.com ");
    await expect(resolveAdminRequest(request)).resolves.not.toBeNull();
  });

  it("turns a signed-in non-admin away", async () => {
    signedInAs("stranger@example.com");
    await expect(resolveAdminRequest(request)).resolves.toBeNull();
  });

  it("turns a signed-out visitor away", async () => {
    requireAuthenticatedRequest.mockRejectedValue(
      new Error("Authentication required"),
    );
    await expect(resolveAdminRequest(request)).resolves.toBeNull();
  });

  it("turns everyone away when the allowlist is unset", async () => {
    delete process.env.ADMIN_EMAILS;
    signedInAs("boris@example.com");
    await expect(resolveAdminRequest(request)).resolves.toBeNull();
  });

  it("answers 404 rather than 403 so the route stays invisible", () => {
    expect(adminNotFound().status).toBe(404);
  });

  it("renders the page only for an admin, and 404s for anyone else", async () => {
    signedInAs("boris@example.com");
    await expect(requireAdminPageUser()).resolves.toMatchObject({ id: "user-1" });
    expect(notFound).not.toHaveBeenCalled();

    signedInAs("stranger@example.com");
    await expect(requireAdminPageUser()).rejects.toThrow("NEXT_NOT_FOUND");

    getAuthenticatedUser.mockResolvedValue(null);
    await expect(requireAdminPageUser()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
