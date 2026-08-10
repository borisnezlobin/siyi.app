import { describe, expect, it } from "vitest";
import { GET } from "./route";

/**
 * The worker is a string, so it cannot be exercised directly here. What these
 * assert is that the rules keeping signed-in HTML out of the wrong hands are
 * still in the file at all — every one of them is a silent failure if deleted,
 * because caching keeps working and only the emptying stops.
 */
async function serviceWorkerSource() {
  return await GET().text();
}

describe("the service worker's page cache", () => {
  it("is emptied when someone signs out", async () => {
    const source = await serviceWorkerSource();

    expect(source).toContain('requestUrl.pathname === "/auth/signout"');
    // Sign out is a POST, and the handler returns early on anything that is not
    // a GET, so the check has to come first or it never runs.
    expect(source.indexOf('"/auth/signout"')).toBeLessThan(
      source.indexOf('event.request.method !== "GET"'),
    );
  });

  it("is emptied when a reply bounces to the sign-in page", async () => {
    const source = await serviceWorkerSource();

    expect(source).toContain("response.redirected");
    expect(source).toContain('new URL(response.url).pathname.startsWith("/auth")');
  });

  it("is emptied when a different account opens the same browser", async () => {
    const source = await serviceWorkerSource();

    expect(source).toContain('message.type !== "siyi-cache-owner"');
    expect(source).toContain("previous === message.owner");
  });

  it("survives activation rather than being swept with the old shells", async () => {
    const source = await serviceWorkerSource();

    expect(source).toContain("name !== CACHE_NAME && name !== PAGES_CACHE");
  });

  it("stores pages without the headers they arrived with", async () => {
    const source = await serviceWorkerSource();

    // A rotated Supabase auth cookie must not be able to travel back out of the
    // cache, so the stored copy is rebuilt rather than put straight in.
    expect(source).toContain("new Response(body, {");
    expect(source).not.toMatch(/cache\.put\(\s*request,\s*response\s*\)/);
  });

  it("only keeps the signed-in routes, never the sign-in page itself", async () => {
    const source = await serviceWorkerSource();
    const list = source.slice(
      source.indexOf("const CACHEABLE_PAGES"),
      source.indexOf("function isCacheablePage"),
    );

    expect(list).toContain('"/today"');
    expect(list).toContain('"/people"');
    expect(list).not.toContain('"/auth"');
    expect(list).not.toContain('"/u/"');
  });
});
