import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { answerMarketingPrompt } from "@/app/auth/marketing/actions";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { brand } from "@/config/brand";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "One last thing",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function safeNext(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/today";
}

/**
 * Signing in with Google or Apple skips the signup form, so it skips the box
 * that asks about email. Rather than assume an answer, the question gets its
 * own screen, once, and the answer is recorded either way so it is never asked
 * again.
 */
export default async function MarketingConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(next);

  if (!isSupabaseConfigured()) redirect(destination);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  // Answered already — by this screen or by the signup form — so it is not
  // asked twice however the person got back here.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("marketing_prompted_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profile?.marketing_prompted_at) redirect(destination);

  return (
    <main className="flex min-h-screen items-center bg-porcelain px-5 py-10">
      <div className="mx-auto w-full max-w-[460px] space-y-6">
        <div>
          <h1 className="font-display text-[2.5rem] leading-[0.98] tracking-[-0.04em]">
            Want to hear from us?
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            Every so often we send a short note about what&apos;s new in{" "}
            {brand.shortName}. Only things worth reading, and never often. You
            can change your mind any time in settings.
          </p>
        </div>

        <form action={answerMarketingPrompt} className="space-y-2.5">
          <input type="hidden" name="next" value={destination} />
          <input type="hidden" name="optIn" value="yes" />
          <AuthSubmitButton
            label="Yes, keep me posted"
            pendingLabel="Saving…"
          />
        </form>

        {/* Its own form, so declining is one press and never the thing you hit
            by accident while reaching for the other. */}
        <form action={answerMarketingPrompt}>
          <input type="hidden" name="next" value={destination} />
          <input type="hidden" name="optIn" value="no" />
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold text-ink-muted transition-colors hover:bg-ink/[0.05] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            No thanks
          </button>
        </form>
      </div>
    </main>
  );
}
