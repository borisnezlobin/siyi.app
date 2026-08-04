import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient as createServerClient } from "@/lib/supabase/server";

export type AuthenticatedRequest = {
  user: User;
  supabase: SupabaseClient;
  accessToken: string | null;
};

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

export async function requireAuthenticatedRequest(
  request: NextRequest,
): Promise<AuthenticatedRequest> {
  const accessToken = bearerToken(request);

  if (accessToken) {
    const { url, publishableKey } = getSupabasePublicConfig();
    const supabase = createSupabaseClient(url, publishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user) throw new Error("Authentication required");
    return { user, supabase, accessToken };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  return { user, supabase, accessToken: null };
}
