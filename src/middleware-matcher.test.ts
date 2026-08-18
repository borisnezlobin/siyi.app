import { describe, expect, it } from "vitest";
import { config } from "@/middleware";

/**
 * The matcher decides which requests pay for an auth-server round trip, and it
 * is one regex with two ways to be wrong that nothing else would catch: let a
 * file through and every page load costs an extra call, exclude too much and
 * /admin stops being hidden or a referral link stops being remembered.
 */
const matches = (pathname: string) =>
  new RegExp(`^${config.matcher[0]}$`).test(pathname);

describe("which requests run the middleware", () => {
  it("runs for the pages a person actually looks at", () => {
    for (const pathname of [
      "/",
      "/today",
      "/people",
      "/people/alex-vale-7fk2",
      "/settings",
      "/auth",
      "/u/alex",
      "/faq",
    ]) {
      expect(matches(pathname), pathname).toBe(true);
    }
  });

  it("still runs for /admin, which it is the thing that hides", () => {
    // Without this the route answers 200 where an unknown URL answers 404, and
    // that difference is enough to tell a scanner the route exists.
    expect(matches("/admin")).toBe(true);
    expect(matches("/admin/announcements")).toBe(true);
  });

  it("skips the files a browser fetches alongside a page", () => {
    // Each of these used to cost a call to the auth server, and not one of them
    // is auth-gated or a referral destination.
    for (const pathname of [
      "/sw.js",
      "/manifest.webmanifest",
      "/offline",
      "/robots.txt",
      "/sitemap.xml",
      "/favicon.ico",
      "/icon-192.png",
      "/apple-touch-icon.png",
      "/.well-known/apple-app-site-association",
      "/_next/static/chunks/main.js",
    ]) {
      expect(matches(pathname), pathname).toBe(false);
    }
  });

  it("keeps running for the API, which is what rotates a long session's cookie", () => {
    expect(matches("/api/quick-people")).toBe(true);
  });
});
