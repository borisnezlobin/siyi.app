import type { SupabaseClient, User } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireAuthenticatedRequest } from "@/lib/api-auth";

/**
 * Everything admin answers 404 rather than 403: someone who is not on the
 * allowlist should not learn that the route exists at all.
 */
export function adminNotFound() {
  return new NextResponse(null, { status: 404 });
}

export async function requireAdminPageUser(): Promise<User> {
  const user = await getAuthenticatedUser();
  if (!isAdminEmail(user?.email)) notFound();
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
    if (!isAdminEmail(user.email)) return null;
    return { user, supabase };
  } catch {
    return null;
  }
}
