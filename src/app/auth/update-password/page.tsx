import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { updatePassword } from "@/app/auth/actions";
import { getAuthenticatedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Update password",
};

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const parameters = await searchParams;

  if (isSupabaseConfigured()) {
    const user = await getAuthenticatedUser();
    if (!user) {
      redirect(
        "/auth?error=Open+the+latest+password+reset+link+first.",
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center bg-porcelain px-5 py-10">
      <div className="mx-auto w-full max-w-[520px] space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-[2.75rem] leading-[0.95] tracking-[-0.04em]">
            Set a new password
          </h1>
          <p className="text-sm leading-6 text-ink-muted">
            Choose something memorable and unique to this account.
          </p>
        </div>

        <form action={updatePassword} className="space-y-4">
          <label className="block text-xs font-semibold text-ink-muted">
            New password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
            />
          </label>
          <label className="block text-xs font-semibold text-ink-muted">
            Confirm password
            <input
              name="passwordConfirmation"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
            />
          </label>
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-coral px-5 text-sm font-semibold text-white transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            Save password
          </button>
        </form>

        {parameters.error ? (
          <p role="alert" className="text-xs leading-5 text-coral-strong">
            {parameters.error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
