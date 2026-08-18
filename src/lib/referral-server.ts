import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  generateReferralCode,
  normalizeReferralCode,
  REFERRAL_CODE_LENGTH,
} from "@/lib/referral";
import { REFERRAL_COOKIE } from "@/lib/referral-cookie";

/**
 * The caller's code, generated on first ask.
 *
 * Retried on collision rather than assumed unique: 31^7 makes a clash unlikely,
 * and the unique index makes it harmless, but "unlikely" is not the same as
 * "handled".
 */
export async function ensureReferralCode(userId: string) {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("user_profiles")
    .select("referral_code")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (existing?.referral_code) return existing.referral_code as string;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReferralCode((count) =>
      Uint8Array.from(randomBytes(count)),
    );
    const { data, error } = await supabase
      .from("user_profiles")
      .update({ referral_code: code })
      .eq("auth_user_id", userId)
      .is("referral_code", null)
      .select("referral_code")
      .maybeSingle();

    if (!error && data?.referral_code) return data.referral_code as string;

    // Another request generated one first — take theirs rather than fight.
    const { data: raced } = await supabase
      .from("user_profiles")
      .select("referral_code")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (raced?.referral_code) return raced.referral_code as string;
  }

  return null;
}

/**
 * Spend the referral cookie, if there is one.
 *
 * Called immediately after a session is created, from every path that can
 * create one. Every rule about who may credit whom lives in the database
 * function; this only decides *when* to ask.
 *
 * Deliberately silent on failure. A referral that does not land is a lost
 * attribution, never a signup that fails — nobody should be unable to make an
 * account because a code was stale.
 */
export async function claimReferralFromCookie() {
  if (!isSupabaseConfigured()) return false;

  const cookieStore = await cookies();
  const raw = cookieStore.get(REFERRAL_COOKIE)?.value;
  const code = normalizeReferralCode(raw);
  if (!code) return false;

  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("claim_referral", { code });
    return data === true;
  } catch {
    return false;
  } finally {
    // Spent either way. A code that could be retried on every later sign-in
    // would keep trying to credit someone for an account that already exists.
    try {
      cookieStore.delete(REFERRAL_COOKIE);
    } catch {
      // A server component cannot delete cookies; the next middleware pass
      // will not rewrite it, and it expires on its own.
    }
  }
}

/**
 * How many people signed up on the caller's code.
 *
 * Through a function rather than a query: RLS limits a profile read to your own
 * row, so counting the rows that point at you is not something the caller can
 * do directly.
 */
export async function countReferrals() {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createClient();
  const { data } = await supabase.rpc("referral_count");
  return typeof data === "number" ? data : 0;
}

export { REFERRAL_CODE_LENGTH };
