import { LockKey, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { updatePassword } from "@/app/auth/actions";
import { brand } from "@/config/brand";
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
        "/auth?method=password&mode=forgot&error=Open+the+latest+password+reset+link+first.",
      );
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-porcelain px-4 py-10">
      <div className="w-full max-w-[460px]">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-3 rounded-xl font-display text-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <span className="grid size-10 place-items-center rounded-full bg-coral text-white">
            <LockKey size={20} weight="fill" aria-hidden="true" />
          </span>
          {brand.name}
        </Link>
        <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-black/[0.035] sm:p-8">
          <p className="text-xs font-semibold text-coral-strong">Almost there</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-[-0.035em]">
            Set a new password.
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            Use at least 8 characters. This reset session works once.
          </p>
          {parameters.error ? (
            <p
              role="alert"
              className="mt-5 flex gap-2 rounded-2xl bg-[#fbe5e0] p-3 text-xs leading-5 text-coral-strong"
            >
              <WarningCircle size={17} className="shrink-0" aria-hidden="true" />
              {parameters.error}
            </p>
          ) : null}
          <form action={updatePassword} className="mt-6">
            <label className="block text-xs font-semibold text-ink-muted">
              New password
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold text-ink-muted">
              Confirm new password
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
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 text-sm font-semibold text-white shadow-card hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            >
              <LockKey size={17} weight="fill" aria-hidden="true" />
              Save new password
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
