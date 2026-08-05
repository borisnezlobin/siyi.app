import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revokeAppleAuthorizationCode } from "@/lib/apple-account";

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedRequest(request);
    const body = (await request.json().catch(() => null)) as
      | { appleAuthorizationCode?: unknown }
      | null;
    const authorizationCode =
      typeof body?.appleAuthorizationCode === "string" &&
      body.appleAuthorizationCode.length <= 4096
        ? body.appleAuthorizationCode
        : null;
    const hasAppleIdentity = user.identities?.some(
      ({ provider }) => provider === "apple",
    );
    const appleAuthorizationRevoked =
      hasAppleIdentity && authorizationCode
        ? await revokeAppleAuthorizationCode(authorizationCode).catch(
            () => false,
          )
        : !hasAppleIdentity;
    const admin = createAdminClient();
    const { data: avatarFiles, error: listError } = await admin.storage
      .from("avatars")
      .list(user.id, { limit: 1000 });

    if (listError) return apiError(listError.message, 500);

    if (avatarFiles?.length) {
      const { error: removeError } = await admin.storage
        .from("avatars")
        .remove(avatarFiles.map((file) => `${user.id}/${file.name}`));
      if (removeError) return apiError(removeError.message, 500);
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return apiError(error.message, 500);

    return NextResponse.json({ ok: true, appleAuthorizationRevoked });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
