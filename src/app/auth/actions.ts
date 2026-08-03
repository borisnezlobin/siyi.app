"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { brand } from "@/config/brand";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

async function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin;

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured()) {
    redirect("/today");
  }

  const supabase = await createClient();
  const appUrl = await getAppUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/auth/callback?next=/today`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    redirect(
      `/auth?error=${encodeURIComponent(
        error?.message ?? "Google sign-in could not be started.",
      )}`,
    );
  }

  redirect(data.url);
}

export async function sendMagicLink(formData: FormData) {
  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";

  if (!email || !email.includes("@")) {
    redirect("/auth?error=Enter+a+valid+email+address.");
  }

  if (!isSupabaseConfigured()) {
    redirect(`/auth?sent=${encodeURIComponent(email)}`);
  }

  const supabase = await createClient();
  const appUrl = await getAppUrl();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=/onboarding`,
      data: {
        app_name: brand.name,
      },
    },
  });

  if (error) {
    redirect(`/auth?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/auth?sent=${encodeURIComponent(email)}`);
}
