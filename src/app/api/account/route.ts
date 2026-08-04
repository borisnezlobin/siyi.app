import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedRequest(request);
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
