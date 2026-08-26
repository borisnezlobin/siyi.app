import { NextResponse } from "next/server";
import { appleAppSiteAssociation } from "@/lib/apple-app-site-association";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json(appleAppSiteAssociation(), {
      headers: {
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[siyi] Apple app-site association is not configured", error);
    return NextResponse.json(
      { error: "Apple app-site association is not configured." },
      { status: 503 },
    );
  }
}
