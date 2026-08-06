import type { SupabaseClient, User } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireAuthenticatedRequest } from "@/lib/api-auth";

function toAdminIdentity(user: User | null | undefined) {
  return user
    ? {
        id: user.id,
        email: user.email,
        emailConfirmedAt: user.email_confirmed_at,
      }
    : null;
}

/**
 * Everything admin answers 404 rather than 403: someone who is not on the
 * allowlist should not learn that the route exists at all.
 */
export function adminNotFound() {
  return new NextResponse(null, { status: 404 });
}

export async function requireAdminPageUser(): Promise<User> {
  const user = await getAuthenticatedUser();
  if (!isAdminUser(toAdminIdentity(user))) notFound();
  return user as User;
}

export type AdminRequestContext = {
  user: User;
  supabase: SupabaseClient;
};

export async function resolveAdminRequest(
  request: NextRequest,
): Promise<AdminRequestContext | null> {
  try {
    const { user, supabase } = await requireAuthenticatedRequest(request);
    if (!isAdminUser(toAdminIdentity(user))) return null;
    return { user, supabase };
  } catch {
    return null;
  }
}
