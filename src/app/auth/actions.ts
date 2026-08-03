"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
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

const passwordCredentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(72, "Use no more than 72 characters."),
});

function authErrorUrl(
  message: string,
  mode: "signin" | "signup" | "forgot" = "signin",
) {
  return `/auth?method=password&mode=${mode}&error=${encodeURIComponent(message)}`;
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
      emailRedirectTo: `${appUrl}/auth/callback?next=/today`,
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

export async function signInWithPassword(formData: FormData) {
  const validation = passwordCredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validation.success) {
    redirect(authErrorUrl(validation.error.issues[0].message));
  }

  if (!isSupabaseConfigured()) {
    redirect("/today");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(validation.data);

  if (error) {
    redirect(authErrorUrl(error.message));
  }

  redirect("/today");
}

export async function signUpWithPassword(formData: FormData) {
  const password = formData.get("password");
  const confirmation = formData.get("passwordConfirmation");
  const validation = passwordCredentialsSchema.safeParse({
    email: formData.get("email"),
    password,
  });

  if (!validation.success) {
    redirect(authErrorUrl(validation.error.issues[0].message, "signup"));
  }

  if (password !== confirmation) {
    redirect(authErrorUrl("The passwords do not match.", "signup"));
  }

  if (!isSupabaseConfigured()) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const appUrl = await getAppUrl();
  const { data, error } = await supabase.auth.signUp({
    email: validation.data.email,
    password: validation.data.password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    redirect(authErrorUrl(error.message, "signup"));
  }

  if (data.session) {
    redirect("/onboarding");
  }

  redirect(
    `/auth?sent=${encodeURIComponent(validation.data.email)}&reason=confirm`,
  );
}

export async function sendPasswordReset(formData: FormData) {
  const emailValue = formData.get("email");
  const emailValidation = z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .safeParse(emailValue);

  if (!emailValidation.success) {
    redirect(authErrorUrl(emailValidation.error.issues[0].message, "forgot"));
  }

  if (!isSupabaseConfigured()) {
    redirect(
      `/auth?sent=${encodeURIComponent(emailValidation.data)}&reason=reset`,
    );
  }

  const supabase = await createClient();
  const appUrl = await getAppUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(
    emailValidation.data,
    {
      redirectTo: `${appUrl}/auth/callback?next=/auth/update-password`,
    },
  );

  if (error) {
    redirect(authErrorUrl(error.message, "forgot"));
  }

  redirect(
    `/auth?sent=${encodeURIComponent(emailValidation.data)}&reason=reset`,
  );
}

export async function updatePassword(formData: FormData) {
  const password = formData.get("password");
  const confirmation = formData.get("passwordConfirmation");
  const passwordValidation = z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(72, "Use no more than 72 characters.")
    .safeParse(password);

  if (!passwordValidation.success) {
    redirect(
      `/auth/update-password?error=${encodeURIComponent(
        passwordValidation.error.issues[0].message,
      )}`,
    );
  }

  if (password !== confirmation) {
    redirect(
      "/auth/update-password?error=The+passwords+do+not+match.",
    );
  }

  if (!isSupabaseConfigured()) {
    redirect("/today");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: passwordValidation.data,
  });

  if (error) {
    redirect(
      `/auth/update-password?error=${encodeURIComponent(error.message)}`,
    );
  }

  redirect("/today");
}
