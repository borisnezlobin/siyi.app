import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

export const dynamic = "force-dynamic";

async function optOut(request: NextRequest, token: string | null) {
  const confirmationUrl = new URL("/unsubscribe", request.url);

  if (!token) {
    confirmationUrl.searchParams.set("status", "invalid");
    return confirmationUrl;
  }

  let userId: string | null = null;
  try {
    userId = verifyUnsubscribeToken(token);
  } catch {
    confirmationUrl.searchParams.set("status", "error");
    return confirmationUrl;
  }

  if (!userId) {
    confirmationUrl.searchParams.set("status", "invalid");
    return confirmationUrl;
  }

  try {
    const { error } = await createAdminClient()
      .from("user_profiles")
      .update({ marketing_opt_in: false, marketing_opt_in_at: null })
      .eq("auth_user_id", userId);

    confirmationUrl.searchParams.set("status", error ? "error" : "done");
  } catch {
    confirmationUrl.searchParams.set("status", "error");
  }

  return confirmationUrl;
}

export async function GET(request: NextRequest) {
  const confirmationUrl = await optOut(
    request,
    request.nextUrl.searchParams.get("token"),
  );
  return NextResponse.redirect(confirmationUrl, { status: 303 });
}

// Mail clients that support List-Unsubscribe-Post send a body-less POST.
export async function POST(request: NextRequest) {
  const tokenFromQuery = request.nextUrl.searchParams.get("token");
  const confirmationUrl = await optOut(request, tokenFromQuery);
  const status = confirmationUrl.searchParams.get("status");

  return NextResponse.json(
    { ok: status === "done" },
    { status: status === "done" ? 200 : 400 },
  );
}
