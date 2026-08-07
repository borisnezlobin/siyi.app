import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { adminSegments, findSegment, usersInSegment } from "@/lib/admin";
import { adminNotFound, resolveAdminRequest } from "@/lib/admin-access";
import {
  announcementColumns,
  getAdminUserFacts,
  listAnnouncements,
  mapAnnouncement,
} from "@/lib/admin-data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(1000),
  segment: z.enum(
    adminSegments.map((segment) => segment.id) as [string, ...string[]],
  ),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  // Generated once by the composer so a retry cannot announce twice.
  dedupeKey: z.string().trim().min(8).max(80),
});

const duplicateKey = "23505";

export async function GET(request: NextRequest) {
  const admin = await resolveAdminRequest(request);
  if (!admin) return adminNotFound();

  try {
    return NextResponse.json(await listAnnouncements());
  } catch (error) {
    return apiError(errorMessage(error), 500);
  }
}

export async function POST(request: NextRequest) {
  const admin = await resolveAdminRequest(request);
  if (!admin) return adminNotFound();

  const validation = announcementSchema.safeParse(await request.json());
  if (!validation.success) return apiError("That announcement looks incomplete.");

  const { title, body, segment, startsAt, endsAt, dedupeKey } = validation.data;
  if (!findSegment(segment)) return apiError("Unknown segment.");

  try {
    const facts = await getAdminUserFacts();
    const audienceSize = usersInSegment(facts, segment).length;
    const service = createAdminClient();

    const { data, error } = await service
      .from("announcements")
      .insert({
        title,
        body,
        segment,
        starts_at: startsAt ?? new Date().toISOString(),
        ends_at: endsAt ?? null,
        created_by: admin.user.id,
        audience_size: audienceSize,
        dedupe_key: dedupeKey,
      })
      .select(announcementColumns)
      .single();

    if (error) {
      if (error.code === duplicateKey) {
        const { data: existing } = await service
          .from("announcements")
          .select(announcementColumns)
          .eq("dedupe_key", dedupeKey)
          .maybeSingle();
        return NextResponse.json({
          announcement: existing ? mapAnnouncement(existing) : null,
          alreadyCreated: true,
        });
      }
      return apiError(error.message, 500);
    }

    return NextResponse.json({
      announcement: mapAnnouncement(data),
      alreadyCreated: false,
    });
  } catch (error) {
    return apiError(errorMessage(error), 500);
  }
}
