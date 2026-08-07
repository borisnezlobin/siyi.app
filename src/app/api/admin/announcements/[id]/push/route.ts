import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { usersInSegment } from "@/lib/admin";
import { adminNotFound, resolveAdminRequest } from "@/lib/admin-access";
import {
  announcementColumns,
  getAdminUserFacts,
  mapAnnouncement,
} from "@/lib/admin-data";
import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const batchSize = 20;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await resolveAdminRequest(request);
  if (!admin) return adminNotFound();

  const { id } = await params;

  try {
    const service = createAdminClient();

    // Claiming the send by stamping push_sent_at in the same statement that
    // checks it is null means two clicks cannot both start a fan-out.
    const { data: claimed, error: claimError } = await service
      .from("announcements")
      .update({ push_sent_at: new Date().toISOString() })
      .eq("id", id)
      .is("push_sent_at", null)
      .select(announcementColumns)
      .maybeSingle();

    if (claimError) {
      return apiError(claimError.message, 500);
    }

    if (!claimed) {
      const { data: existing } = await service
        .from("announcements")
        .select(announcementColumns)
        .eq("id", id)
        .maybeSingle();
      if (!existing) return adminNotFound();
      return NextResponse.json(
        {
          error: "This announcement has already been pushed.",
          announcement: mapAnnouncement(existing),
        },
        { status: 409 },
      );
    }

    const announcement = mapAnnouncement(claimed);
    const facts = await getAdminUserFacts();
    const recipients = usersInSegment(facts, announcement.segment);

    let delivered = 0;
    let failed = 0;

    for (let start = 0; start < recipients.length; start += batchSize) {
      const batch = recipients.slice(start, start + batchSize);
      const results = await Promise.allSettled(
        batch.map((recipient) =>
          sendPushToUser(service, recipient.userId, {
            title: announcement.title,
            body: announcement.body,
            url: "/today",
            tag: `announcement-${announcement.id}`,
          }),
        ),
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          delivered += result.value.delivered;
          failed += result.value.failed;
        } else {
          failed += 1;
          console.error("Announcement push failed", result.reason);
        }
      }
    }

    const { data: finished } = await service
      .from("announcements")
      .update({
        push_recipient_count: recipients.length,
        push_delivered_count: delivered,
        push_failed_count: failed,
      })
      .eq("id", announcement.id)
      .select(announcementColumns)
      .maybeSingle();

    return NextResponse.json({
      announcement: finished ? mapAnnouncement(finished) : announcement,
      recipients: recipients.length,
      delivered,
      failed,
    });
  } catch (error) {
    return apiError(errorMessage(error), 500);
  }
}
