import { NextResponse, type NextRequest } from "next/server";
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
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const destination = new URL("/auth", requestUrl.origin);
    destination.searchParams.set("error", exchangeError.message);
    if (exchangeError.code) destination.searchParams.set("error_code", exchangeError.code);
    return NextResponse.redirect(destination);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
