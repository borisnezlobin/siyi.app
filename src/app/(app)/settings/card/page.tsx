import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { OwnCardForm } from "@/components/own-card-form";
import { PageHeader } from "@/components/page-header";
import { getAuthenticatedUser } from "@/lib/auth";
import { normalizeOwnCard, type OwnCard } from "@/lib/own-card";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "What gets shared",
};

export const dynamic = "force-dynamic";

export default async function ConfigureCardPage() {
  const user = await getAuthenticatedUser();

  let card: OwnCard = {};
  let publicFields: Record<string, boolean> = {};

  if (user && isSupabaseConfigured()) {
    const supabase = await createClient();
    const [{ data: profile }, { data: settings }] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("public_fields")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_settings")
        .select("own_card")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    publicFields = (profile?.public_fields ?? {}) as Record<string, boolean>;
    card = normalizeOwnCard(settings?.own_card);
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        <CaretLeft size={14} aria-hidden="true" />
        Settings
      </Link>

      <div className="mt-5">
        <PageHeader
          title="What gets shared"
          description="Your own details, and which of them appear on the page people reach through your link."
        />
      </div>

      <div className="mt-7">
        <OwnCardForm
          accountEmail={user?.email ?? ""}
          initialCard={card}
          initialPublicFields={publicFields}
        />
      </div>
    </div>
  );
}
