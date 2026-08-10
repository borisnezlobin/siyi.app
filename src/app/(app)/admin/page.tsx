import type { Metadata } from "next";
import {
  AdminDashboard,
  type AdminSegmentSummary,
} from "@/components/admin-dashboard";
import { PageHeader } from "@/components/page-header";
import { adminSegments, segmentCounts, subscriberCounts } from "@/lib/admin";
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
    ({ id, label, description }) => ({
      id,
      label,
      description,
      users: 0,
      subscribers: 0,
    }),
  );

  try {
    const facts = await getAdminUserFacts();
    const counts = segmentCounts(facts);
    const subscribers = subscriberCounts(facts);
    stats = summariseUsers(facts);
    segments = adminSegments.map(({ id, label, description }) => ({
      id,
      label,
      description,
      users: counts[id] ?? 0,
      subscribers: subscribers[id] ?? 0,
    }));
  } catch (error) {
    statsError = errorMessage(error);
  }

  let announcements: Announcement[] = [];
  try {
    const listing = await listAnnouncements();
    announcements = listing.announcements;
  } catch {
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <PageHeader
        title="Admin"
        description="Aggregate numbers, and a way to tell everyone something."
      />
      <div className="mt-8">
        <AdminDashboard
          stats={stats}
          segments={segments}
          initialAnnouncements={announcements}
          statsError={statsError}
        />
      </div>
    </div>
  );
}
