import type { Metadata } from "next";
import {
  NotificationControls,
  type InitialNotificationPreferences,
} from "@/components/notification-controls";
import { PageHeader } from "@/components/page-header";
import { getAuthenticatedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Notifications",
};

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  let initialPreferences: InitialNotificationPreferences = {
    pushEnabled: false,
    overdueContactEnabled: true,
    birthdayEnabled: true,
    reminderEnabled: true,
    reminderHourLocal: 10,
    reminderDaysOfWeek: [1, 2, 3, 4, 5],
  };

  if (isSupabaseConfigured()) {
    const user = await getAuthenticatedUser();
    if (user) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        initialPreferences = {
          pushEnabled: data.push_enabled,
          overdueContactEnabled: data.overdue_contact_enabled,
          birthdayEnabled: data.birthday_enabled,
          reminderEnabled: data.follow_up_enabled,
          reminderHourLocal: data.reminder_hour_local,
          reminderDaysOfWeek: data.reminder_days_of_week,
        };
      }
    }
  }

  return (
    <div className="mx-auto max-w-[680px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <PageHeader
        eyebrow="On your terms"
        title="Notifications"
        description="Choose what is useful, when it arrives, and whether this browser can send it."
      />
      <NotificationControls initialPreferences={initialPreferences} />
    </div>
  );
}
