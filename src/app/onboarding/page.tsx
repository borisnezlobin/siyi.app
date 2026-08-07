import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getAuthenticatedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Set up your account",
};

export default async function OnboardingPage() {
  if (isSupabaseConfigured()) {
    const user = await getAuthenticatedUser();
    if (!user) redirect("/auth");
  }

  return (
    <main className="min-h-screen bg-porcelain px-5 py-10 sm:py-14">
      <div className="mx-auto max-w-[620px]">
        <header className="space-y-2">
          <h1 className="font-display text-[2.75rem] leading-[0.95] tracking-[-0.04em]">
            Make it yours
          </h1>
          <p className="text-sm leading-6 text-ink-muted">
            You can change all of this from Settings.
          </p>
        </header>
        <OnboardingForm />
      </div>
    </main>
  );
}
