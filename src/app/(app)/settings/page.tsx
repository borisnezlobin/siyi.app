import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SettingsControls } from "@/components/settings-controls";
import { getAuthenticatedUser } from "@/lib/auth";
import { DEFAULT_REMINDER_INTERVALS } from "@/lib/constants";
import { getFollowUps, getInteractions, getPeople } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { RelationshipStrength } from "@/lib/types";

export const metadata: Metadata = {
  title: "Settings",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [people, interactions, followUps, user] = await Promise.all([
    getPeople(),
    getInteractions(),
    getFollowUps(),
    getAuthenticatedUser(),
  ]);
  const providers = user?.app_metadata.providers as string[] | undefined;
  const authMethods = providers?.length
    ? providers.map((provider) => (provider === "email" ? "Email" : "Google"))
    : ["Preview mode"];
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
        .select("timezone")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_settings")
        .select(
          "strength_1_days,strength_2_days,strength_3_days,strength_4_days",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    initialTimezone = profile?.timezone ?? "UTC";

    // Read consent on its own so a deployment that lands before migration
    // 0007 cannot null out the whole profile row and reset the timezone.
    const { data: consent } = await supabase
      .from("user_profiles")
      .select("marketing_opt_in")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    initialMarketingOptIn = consent?.marketing_opt_in ?? false;
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
        eyebrow="Make it yours"
        title="Settings"
        description="How often to check in, your account, and a full copy of your data."
      />
      <SettingsControls
        people={people}
        interactions={interactions}
        followUps={followUps}
        authMethods={authMethods}
        accountEmail={user?.email ?? ""}
        initialTimezone={initialTimezone}
        initialIntervals={initialIntervals}
        initialMarketingOptIn={initialMarketingOptIn}
      />
    </div>
  );
}
