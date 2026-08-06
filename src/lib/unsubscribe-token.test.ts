import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildUnsubscribeUrl,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/unsubscribe-token";

const firstUserId = "5a5bd2a4-4d1c-4f2a-9c1e-0a1b2c3d4e5f";
const secondUserId = "c0ffee00-1111-2222-3333-444455556666";

const originalSecret = process.env.UNSUBSCRIBE_SECRET;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

beforeAll(() => {
  process.env.UNSUBSCRIBE_SECRET = "a-secret-only-the-server-knows";
  process.env.NEXT_PUBLIC_APP_URL = "https://siyi.app";
});

afterAll(() => {
  process.env.UNSUBSCRIBE_SECRET = originalSecret;
  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});

describe("signing an unsubscribe token", () => {
  it("verifies a token it just created", () => {
    const token = createUnsubscribeToken(firstUserId);
    expect(verifyUnsubscribeToken(token)).toBe(firstUserId);
  });

  it("is stable for the same user", () => {
    expect(createUnsubscribeToken(firstUserId)).toBe(
      createUnsubscribeToken(firstUserId),
    );
  });

  it("gives different users different tokens", () => {
    expect(createUnsubscribeToken(firstUserId)).not.toBe(
      createUnsubscribeToken(secondUserId),
    );
  });
});

describe("verifying an unsubscribe token", () => {
  it("rejects a tampered signature", () => {
    const [payload, signature] = createUnsubscribeToken(firstUserId).split(".");
    const tamperedSignature = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
    expect(verifyUnsubscribeToken(`${payload}.${tamperedSignature}`)).toBeNull();
  });

  it("rejects a signature borrowed from another user", () => {
    const otherSignature = createUnsubscribeToken(secondUserId).split(".")[1];
    const payload = createUnsubscribeToken(firstUserId).split(".")[0];
    expect(verifyUnsubscribeToken(`${payload}.${otherSignature}`)).toBeNull();
  });

  it("rejects a payload swapped to another user", () => {
    const signature = createUnsubscribeToken(firstUserId).split(".")[1];
    const otherPayload = createUnsubscribeToken(secondUserId).split(".")[0];
    expect(verifyUnsubscribeToken(`${otherPayload}.${signature}`)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyUnsubscribeToken("")).toBeNull();
    expect(verifyUnsubscribeToken("no-separator")).toBeNull();
    expect(verifyUnsubscribeToken("too.many.parts")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createUnsubscribeToken(firstUserId);
    process.env.UNSUBSCRIBE_SECRET = "a-rotated-secret";
    const result = verifyUnsubscribeToken(token);
    process.env.UNSUBSCRIBE_SECRET = "a-secret-only-the-server-knows";
    expect(result).toBeNull();
  });
});

describe("building the unsubscribe link", () => {
  it("points at the unsubscribe route with a verifiable token", () => {
    const url = new URL(buildUnsubscribeUrl(firstUserId));
    expect(url.origin).toBe("https://siyi.app");
    expect(url.pathname).toBe("/api/unsubscribe");
    expect(verifyUnsubscribeToken(url.searchParams.get("token") ?? "")).toBe(
      firstUserId,
    );
  });
});
