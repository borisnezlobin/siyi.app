import type { Metadata } from "next";
import {
  AdminDashboard,
  type AdminSegmentSummary,
} from "@/components/admin-dashboard";
import { PageHeader } from "@/components/page-header";
import { adminSegments, segmentCounts } from "@/lib/admin";
import { requireAdminPageUser } from "@/lib/admin-access";
import {
  type AdminStats,
  emptyStats,
  getAdminUserFacts,
  listAnnouncements,
  summariseUsers,
} from "@/lib/admin-data";
import { errorMessage } from "@/lib/api";
import type { Announcement } from "@/lib/types";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminPageUser();

  let stats: AdminStats = emptyStats;
  let statsError: string | null = null;
  let segments: AdminSegmentSummary[] = adminSegments.map(
    ({ id, label, description }) => ({ id, label, description, users: 0 }),
  );

  try {
    const facts = await getAdminUserFacts();
    const counts = segmentCounts(facts);
    stats = summariseUsers(facts);
    segments = adminSegments.map(({ id, label, description }) => ({
      id,
      label,
      description,
      users: counts[id] ?? 0,
    }));
  } catch (error) {
    statsError = errorMessage(error);
  }

  let announcements: Announcement[] = [];
  let announcementsReady = false;
  try {
    const listing = await listAnnouncements();
    announcements = listing.announcements;
    announcementsReady = listing.schemaReady;
  } catch {
    announcementsReady = false;
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <PageHeader
        eyebrow="Just for the two of us"
        title="Admin"
        description="Aggregate numbers, and a way to tell everyone something."
      />
      <div className="mt-8">
        <AdminDashboard
          stats={stats}
          segments={segments}
          initialAnnouncements={announcements}
          announcementsReady={announcementsReady}
          statsError={statsError}
        />
      </div>
    </div>
  );
}
