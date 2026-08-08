import { DefaultUniversityControl } from "@/components/default-university-control";
import { ProfileControls } from "@/components/profile-controls";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SettingsControls } from "@/components/settings-controls";
import { getAuthenticatedUser } from "@/lib/auth";
import { DEFAULT_REMINDER_INTERVALS } from "@/lib/constants";
import { getReminders, getInteractions, getPeople } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { RelationshipStrength } from "@/lib/types";

export const metadata: Metadata = {
  title: "Settings",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [people, interactions, reminders, user] = await Promise.all([
    getPeople(),
    getInteractions(),
    getReminders(),
    getAuthenticatedUser(),
  ]);
  const providers = user?.app_metadata.providers as string[] | undefined;
  const authMethods = providers?.length
    ? providers.map((provider) => (provider === "email" ? "Email" : "Google"))
    : ["Preview mode"];
  let initialHandle = "";
  let initialHandleTag = "";
  let initialProfilePublic = false;
  let initialDefaultUniversity = "";
  let initialTimezone = "America/Los_Angeles";
  let initialMarketingOptIn = false;
  let initialIntervals: Record<RelationshipStrength, number> = {
    ...DEFAULT_REMINDER_INTERVALS,
  };

  if (user && isSupabaseConfigured()) {
    const supabase = await createClient();
    const [{ data: profile }, { data: settings }] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("timezone,handle,handle_tag,profile_public,public_fields")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_settings")
        .select(
          "strength_1_days,strength_2_days,strength_3_days,strength_4_days,own_card,default_university",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    initialTimezone = profile?.timezone ?? "UTC";
    initialHandle = profile?.handle ?? "";
    initialHandleTag = profile?.handle_tag ?? "";
    initialProfilePublic = profile?.profile_public ?? false;

    // Read consent on its own so a deployment that lands before migration
    // 0007 cannot null out the whole profile row and reset the timezone.
    const { data: consent } = await supabase
      .from("user_profiles")
      .select("marketing_opt_in")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    initialMarketingOptIn = consent?.marketing_opt_in ?? false;
    initialDefaultUniversity = settings?.default_university ?? "";
    if (settings) {
      initialIntervals = {
        1: settings.strength_1_days,
        2: settings.strength_2_days,
        3: settings.strength_3_days,
        4: settings.strength_4_days,
      };
    }
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <PageHeader
        title="Settings"
        description="Your card, notifications, how often to check in, and a full copy of your data."
      />
      {/* Ordered to match the phone exactly: your card, then notifications,
          then the check-in defaults, account, data and deletion. */}
      <div className="mt-7 divide-y divide-ink/[0.08]">
        <section className="py-7 first:pt-0">
          <h2 className="text-sm font-bold">Your card</h2>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            A code and an address people can reach you at, and the choice of
            what they find there.
          </p>
          <div className="mt-5">
            <ProfileControls
              initialHandle={initialHandle}
              initialPublic={initialProfilePublic}
              initialTag={initialHandleTag}
            />
          </div>
        </section>

        <section className="py-7">
          <h2 className="text-sm font-bold">Notifications</h2>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            Permission, categories, preferred hour, and a test.
          </p>
          <Link
            href="/notifications"
            className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-ink hover:text-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            Push and reminder timing
            <CaretRight size={14} aria-hidden="true" />
          </Link>
        </section>

        {/* A default for the people you add, not a detail about you — so it
            sits with the other new-person defaults, immediately above the
            check-in intervals, exactly as it does on the phone. */}
        <section className="py-7">
          <h2 className="text-sm font-bold">New person defaults</h2>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            Filled in for you when you add someone new. Leave blank for none.
          </p>
          <div className="mt-4">
            <DefaultUniversityControl
              accountEmail={user?.email ?? ""}
              initialValue={initialDefaultUniversity}
            />
          </div>
        </section>
      </div>

      <SettingsControls
        people={people}
        interactions={interactions}
        reminders={reminders}
        authMethods={authMethods}
        accountEmail={user?.email ?? ""}
        initialTimezone={initialTimezone}
        initialIntervals={initialIntervals}
        initialMarketingOptIn={initialMarketingOptIn}
      />

    </div>
  );
}
