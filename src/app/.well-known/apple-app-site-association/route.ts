import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const bundleIdentifier =
    process.env.APPLE_CLIENT_ID?.trim() || "app.siyi.mobile";

  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: teamId
          ? [
              {
                appIDs: [`${teamId}.${bundleIdentifier}`],
                components: [
                  { "/": "/people/*" },
                  { "/": "/reminders*" },
                  { "/": "/today*" },
                  { "/": "/auth/callback*" },
                ],
              },
            ]
          : [],
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "application/json",
      },
    },
  );
}
