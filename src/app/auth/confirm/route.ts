import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = requestUrl.searchParams.get("next") ?? "/onboarding";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  }

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL("/auth?error=This+sign-in+link+is+invalid.", requestUrl.origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    const destination = new URL("/auth", requestUrl.origin);
    destination.searchParams.set("error", error.message);
    destination.searchParams.set("error_code", error.code ?? "invalid_otp");
    return NextResponse.redirect(destination);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
