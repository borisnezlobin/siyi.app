import { normalizeOwnCard, type OwnCard } from "@/lib/own-card";
import { DefaultUniversityControl } from "@/components/default-university-control";
import { OwnCardControls } from "@/components/own-card-controls";
import { ProfileControls } from "@/components/profile-controls";
import type { Metadata } from "next";
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
  let initialPublicFields: Record<string, boolean> = {};
  let initialOwnCard: OwnCard = {};
  let initialOwnCardEnabled = false;
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
          "strength_1_days,strength_2_days,strength_3_days,strength_4_days,own_card,own_card_enabled,default_university",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    initialTimezone = profile?.timezone ?? "UTC";
    initialHandle = profile?.handle ?? "";
    initialHandleTag = profile?.handle_tag ?? "";
    initialProfilePublic = profile?.profile_public ?? false;
    initialPublicFields = (profile?.public_fields ?? {}) as Record<string, boolean>;

    // Read consent on its own so a deployment that lands before migration
    // 0007 cannot null out the whole profile row and reset the timezone.
    const { data: consent } = await supabase
      .from("user_profiles")
      .select("marketing_opt_in")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    initialMarketingOptIn = consent?.marketing_opt_in ?? false;
    initialOwnCard = normalizeOwnCard(settings?.own_card);
    initialOwnCardEnabled = settings?.own_card_enabled ?? false;
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
        eyebrow="Make it yours"
        title="Settings"
        description="How often to check in, your account, and a full copy of your data."
      />
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

      <section className="mt-10 rounded-[1.75rem] bg-white p-4 shadow-card ring-1 ring-black/[0.035] sm:p-6">
        <h2 className="text-base font-bold">Default university</h2>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          Filled in for you when you add someone new. Leave blank for none.
        </p>
        <div className="mt-4">
          <DefaultUniversityControl initialValue={initialDefaultUniversity} />
        </div>
      </section>

      <section className="mt-6 rounded-[1.75rem] bg-white p-4 shadow-card ring-1 ring-black/[0.035] sm:p-6">
        <h2 className="text-base font-bold">Your page</h2>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          An address you can say out loud, and a code people can scan.
        </p>
        <div className="mt-5">
          <ProfileControls
            card={initialOwnCard}
            initialHandle={initialHandle}
            initialPublic={initialProfilePublic}
            initialPublicFields={initialPublicFields}
            initialTag={initialHandleTag}
          />
        </div>
      </section>

      <section className="mt-6 rounded-[1.75rem] bg-white p-4 shadow-card ring-1 ring-black/[0.035] sm:p-6">
        <h2 className="text-base font-bold">Your own details</h2>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          What you hand out about yourself, so you are not retyping it every time
          you meet someone.
        </p>
        <div className="mt-5">
          <OwnCardControls
            initialCard={initialOwnCard}
            initialEnabled={initialOwnCardEnabled}
          />
        </div>
      </section>
    </div>
  );
}
