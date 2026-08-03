import Link from "next/link";
import { brand } from "@/config/brand";

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-12 sm:py-20">
      <Link href="/auth" className="text-sm font-semibold text-coral-strong">
        Back to sign in
      </Link>
      <h1 className="mt-8 font-display text-5xl">Privacy notice</h1>
      <p className="mt-5 text-sm leading-7 text-ink-muted">
        This is a placeholder for {brand.name}’s public privacy notice. Before
        launch, it should explain what account, contact, note, file, and
        notification data is stored; how it is used; retention periods; and how
        users can export or delete their data.
      </p>
    </main>
  );
}
