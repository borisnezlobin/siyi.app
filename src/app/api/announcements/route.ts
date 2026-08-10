import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { AdminUserFacts } from "@/lib/admin";
import { findSegment } from "@/lib/admin";
import { requireAuthenticatedRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type LiveAnnouncement = {
  id: string;
  title: string;
  body: string;
  segment: string;
};

async function latestTimestamp(
  supabase: SupabaseClient,
  table: string,
  userId: string,
) {
  const { data } = await supabase
    .from(table)
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.created_at as string | undefined) ?? null;
}

async function hasLivePush(supabase: SupabaseClient, userId: string) {
  const tables = ["push_subscriptions", "native_push_subscriptions"];
  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("revoked_at", null);
    if ((count ?? 0) > 0) return true;
  }
  return false;
}

async function currentUserFacts(
  supabase: SupabaseClient,
  userId: string,
  emailConfirmedAt: string | null,
): Promise<AdminUserFacts> {
  const [{ count }, lastPerson, lastInteraction, pushEnabled, profile] =
    await Promise.all([
      supabase
        .from("people")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      latestTimestamp(supabase, "people", userId),
      latestTimestamp(supabase, "interactions", userId),
      hasLivePush(supabase, userId),
      supabase
        .from("user_profiles")
        .select("created_at,marketing_opt_in")
        .eq("auth_user_id", userId)
        .maybeSingle(),
    ]);

  const stamps = [
    profile.data?.created_at as string | undefined,
    lastPerson,
    lastInteraction,
  ].filter((value): value is string => Boolean(value));

  return {
    userId,
    createdAt: (profile.data?.created_at as string | undefined) ?? new Date().toISOString(),
    contactCount: count ?? 0,
    pushEnabled,
    lastActiveAt:
      stamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ??
      null,
    marketingOptIn: Boolean(profile.data?.marketing_opt_in),
    emailConfirmedAt,
  };
}

/**
 * Feeds the in-app banner. Every failure mode here — no announcements table
 * yet, a segment nobody recognises, a hiccup reading the user's own rows —
 * degrades to "no banner" so a normal user's app is untouched.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuthenticatedRequest(request);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("announcements")
      .select("id,title,body,segment,starts_at,ends_at")
      .lte("starts_at", now)
      .order("starts_at", { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(error.message);
    }

    const live = (data as (LiveAnnouncement & { ends_at: string | null })[])
      .filter((row) => !row.ends_at || new Date(row.ends_at) > new Date());
    if (live.length === 0) return NextResponse.json({ announcements: [] });

    const { data: dismissals } = await supabase
      .from("announcement_dismissals")
      .select("announcement_id")
      .eq("user_id", user.id);
    const dismissed = new Set(
      (dismissals ?? []).map((row) => row.announcement_id as string),
    );

    const undismissed = live.filter((row) => !dismissed.has(row.id));
    if (undismissed.length === 0) return NextResponse.json({ announcements: [] });

    const facts = await currentUserFacts(
      supabase,
      user.id,
      user.email_confirmed_at ?? null,
    );
    const visible = undismissed.filter((row) => {
      const segment = findSegment(row.segment);
      return segment ? segment.matches(facts, new Date()) : false;
    });

    return NextResponse.json({
      announcements: visible.map(({ id, title, body }) => ({ id, title, body })),
    });
  } catch {
    return NextResponse.json({ announcements: [] });
  }
}
