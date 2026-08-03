import { UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { brand } from "@/config/brand";
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
    <main className="min-h-screen bg-porcelain px-4 py-7 sm:px-7 sm:py-12">
      <div className="mx-auto max-w-[620px]">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-coral text-white shadow-card">
            <UsersThree size={20} weight="fill" aria-hidden="true" />
          </span>
          <span className="font-display text-2xl">{brand.name}</span>
        </div>
        <header className="mt-10">
          <p className="text-xs font-semibold text-coral-strong">One quick setup</p>
          <h1 className="mt-2 font-display text-[2.75rem] leading-[0.95] tracking-[-0.04em] sm:text-6xl">
            Make reminders feel like yours.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-ink-muted">
            Set your local time and choose what is worth a nudge. Nothing here is
            permanent.
          </p>
        </header>
        <OnboardingForm />
      </div>
    </main>
  );
}
