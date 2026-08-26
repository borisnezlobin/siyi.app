import { describe, expect, it } from "vitest";
import { appleAppSiteAssociation } from "@/lib/apple-app-site-association";

describe("Apple app-site association", () => {
  it("associates signed-in routes with the signed iPhone app", () => {
    expect(
      appleAppSiteAssociation({
        APPLE_TEAM_ID: "A1B2C3D4E5",
        APPLE_CLIENT_ID: "app.siyi.mobile",
      }),
    ).toEqual({
      applinks: {
        apps: [],
        details: [
          {
            appIDs: ["A1B2C3D4E5.app.siyi.mobile"],
            components: [
              { "/": "/people*" },
              { "/": "/reminders*" },
              { "/": "/today*" },
              { "/": "/auth/callback*" },
            ],
          },
        ],
      },
    });
  });

  it("fails instead of publishing an empty or malformed association", () => {
    expect(() =>
      appleAppSiteAssociation({
        APPLE_TEAM_ID: "",
        APPLE_CLIENT_ID: "app.siyi.mobile",
      }),
    ).toThrow("APPLE_TEAM_ID");
    expect(() =>
      appleAppSiteAssociation({
        APPLE_TEAM_ID: "A1B2C3D4E5",
        APPLE_CLIENT_ID: "not a bundle id",
      }),
    ).toThrow("APPLE_CLIENT_ID");
  });
});
