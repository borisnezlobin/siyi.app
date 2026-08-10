import { describe, expect, it } from "vitest";
import type { AdminUserFacts } from "@/lib/admin";
import {
  campaignForUser,
  lifecycleCampaigns,
  renderLifecycleEmail,
} from "@/lib/lifecycle-email";

const now = new Date("2026-08-10T12:00:00.000Z");
const dayInMs = 24 * 60 * 60 * 1000;

function daysAgo(days: number) {
  return new Date(now.getTime() - days * dayInMs).toISOString();
}

function user(overrides: Partial<AdminUserFacts> = {}): AdminUserFacts {
  return {
    userId: "u-1",
    createdAt: daysAgo(10),
    contactCount: 0,
    pushEnabled: false,
    lastActiveAt: daysAgo(1),
    marketingOptIn: true,
    emailConfirmedAt: daysAgo(10),
    ...overrides,
  };
}

describe("who gets a lifecycle email", () => {
  it("nudges an account that has saved nobody", () => {
    expect(campaignForUser(user(), [], now)?.id).toBe("no-contacts-after-3-days");
  });

  it("leaves a brand-new account alone for its first three days", () => {
    expect(campaignForUser(user({ createdAt: daysAgo(2) }), [], now)).toBeNull();
  });

  it("never mails someone who did not opt in", () => {
    expect(campaignForUser(user({ marketingOptIn: false }), [], now)).toBeNull();
  });

  it("never mails an address that was never verified", () => {
    expect(campaignForUser(user({ emailConfirmedAt: null }), [], now)).toBeNull();
  });

  it("sends each campaign at most once", () => {
    expect(
      campaignForUser(user(), ["no-contacts-after-3-days"], now),
    ).toBeNull();
  });

  it("welcomes a quiet account back only once it has someone to come back to", () => {
    const quiet = user({ contactCount: 12, lastActiveAt: daysAgo(45) });
    expect(campaignForUser(quiet, [], now)?.id).toBe("quiet-for-30-days");
  });

  it("prefers the first-contact nudge over the come-back-to-us one", () => {
    // Quiet and empty at the same time: being told to come back to an empty
    // directory is the message that does not help.
    const both = user({ contactCount: 0, lastActiveAt: daysAgo(60) });
    expect(campaignForUser(both, [], now)?.id).toBe("no-contacts-after-3-days");
  });

  it("says nothing to an account that is getting on with it", () => {
    expect(
      campaignForUser(user({ contactCount: 30, lastActiveAt: daysAgo(2) }), [], now),
    ).toBeNull();
  });
});

describe("the rendered email", () => {
  const rendered = renderLifecycleEmail({
    campaign: lifecycleCampaigns[0],
    appUrl: "https://siyi.app/",
    unsubscribeUrl: "https://siyi.app/api/unsubscribe?token=abc.def",
    brandName: "Siyi.app",
    postalAddress: "Somewhere, Berkeley, CA",
  });

  it("carries an unsubscribe link and a postal address in both parts", () => {
    for (const part of [rendered.html, rendered.text]) {
      expect(part).toContain("https://siyi.app/api/unsubscribe?token=abc.def");
      expect(part).toContain("Somewhere, Berkeley, CA");
    }
  });

  it("builds the action link without doubling the slash", () => {
    expect(rendered.html).toContain("https://siyi.app/people/new");
    expect(rendered.html).not.toContain("siyi.app//");
  });

  it("escapes text so a stray angle bracket cannot become markup", () => {
    const escaped = renderLifecycleEmail({
      campaign: { ...lifecycleCampaigns[0], paragraphs: ["<script>hi</script>"] },
      appUrl: "https://siyi.app",
      unsubscribeUrl: "https://siyi.app/api/unsubscribe?token=abc",
      brandName: "Siyi.app",
      postalAddress: "Somewhere",
    });
    expect(escaped.html).not.toContain("<script>");
    expect(escaped.html).toContain("&lt;script&gt;");
  });
});
