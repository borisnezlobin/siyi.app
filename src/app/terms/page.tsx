import Link from "next/link";
import { brand } from "@/config/brand";

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-12 sm:py-20">
      <Link href="/auth" className="text-sm font-semibold text-coral-strong">
        Back to sign in
      </Link>
      <h1 className="mt-8 font-display text-5xl">Terms</h1>
      <p className="mt-5 text-sm leading-7 text-ink-muted">
        This is a placeholder for {brand.name}’s public terms. Before launch,
        replace it with terms covering acceptable use, user-submitted contact
        information, account responsibilities, service availability, and
        account deletion.
      </p>
    </main>
  );
}
