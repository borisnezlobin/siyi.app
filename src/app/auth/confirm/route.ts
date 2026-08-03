import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const requestedNextPath = safeNextPath(requestUrl.searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      new URL(requestedNextPath ?? "/today", requestUrl.origin),
    );
  }

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL("/auth?error=This+sign-in+link+is+invalid.", requestUrl.origin),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    const destination = new URL("/auth", requestUrl.origin);
    destination.searchParams.set("error", error.message);
    destination.searchParams.set("error_code", error.code ?? "invalid_otp");
    return NextResponse.redirect(destination);
  }

  if (requestedNextPath) {
    return NextResponse.redirect(new URL(requestedNextPath, requestUrl.origin));
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding_completed_at")
    .eq("auth_user_id", data.user?.id ?? "")
    .maybeSingle();
  const nextPath = profile?.onboarding_completed_at ? "/today" : "/onboarding";

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
