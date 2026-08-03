import { describe, expect, it } from "vitest";
import { getApiResponseError, readJsonResponse } from "@/lib/http";

describe("API response helpers", () => {
  it("uses a JSON error returned by the API", async () => {
    const response = Response.json(
      { error: "That person could not be saved." },
      { status: 400 },
    );

    await expect(
      getApiResponseError(response, "Something went wrong."),
    ).resolves.toBe("That person could not be saved.");
  });

  it("handles an HTML server error without parsing it as JSON", async () => {
    const response = new Response("<!doctype html><title>Error</title>", {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

    await expect(
      getApiResponseError(response, "Something went wrong."),
    ).resolves.toBe(
      "The app server ran into a temporary problem. Refresh and try again.",
    );
  });

  it("returns null for malformed JSON", async () => {
    const response = new Response("not-json", {
      headers: { "Content-Type": "application/json" },
    });

    await expect(readJsonResponse(response)).resolves.toBeNull();
  });
});
