import { NextResponse, type NextRequest } from "next/server";
import { claimReferralFromCookie } from "@/lib/referral-server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/today";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));
  const error = requestUrl.searchParams.get("error_description");
  const errorCode = requestUrl.searchParams.get("error_code");

  if (error) {
    const destination = new URL("/auth", requestUrl.origin);
    destination.searchParams.set("error", error);
    if (errorCode) destination.searchParams.set("error_code", errorCode);
    return NextResponse.redirect(destination);
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth?error=This+sign-in+link+is+invalid.", requestUrl.origin),
    );
  }

  const supabase = await createClient();
  const { data, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const destination = new URL("/auth", requestUrl.origin);
    destination.searchParams.set("error", exchangeError.message);
    if (exchangeError.code) destination.searchParams.set("error_code", exchangeError.code);
    return NextResponse.redirect(destination);
  }

  // Before the marketing redirect below, because that path returns early and
  // the code would otherwise go unspent for anyone signing in with a provider.
  await claimReferralFromCookie();

  // Nobody who arrived through Google or Apple has seen a signup form, so
  // nobody has been asked about email yet. The prompt is owed once, and the
  // column says whether it has been paid.
  if (data.user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("marketing_prompted_at")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (profile && !profile.marketing_prompted_at) {
      const consent = new URL("/auth/marketing", requestUrl.origin);
      consent.searchParams.set("next", nextPath);
      return NextResponse.redirect(consent);
    }
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
