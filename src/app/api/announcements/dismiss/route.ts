import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const dismissSchema = z.object({
  announcementId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuthenticatedRequest(request);
    const validation = dismissSchema.safeParse(await request.json());
    if (!validation.success) return apiError("Unknown announcement.");

    // A failure here is not worth surfacing: the banner also remembers the
    // dismissal in the browser, so the user never sees it twice either way.
    await supabase.from("announcement_dismissals").upsert(
      {
        announcement_id: validation.data.announcementId,
        user_id: user.id,
      },
      { onConflict: "announcement_id,user_id" },
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
