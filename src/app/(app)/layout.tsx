import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getAuthenticatedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let displayName = "Alex Vale";
  let email = "alex@example.edu";

  if (isSupabaseConfigured()) {
    const user = await getAuthenticatedUser();
    if (!user) redirect("/auth");

    email = user.email ?? "";
    const supabase = await createClient();
    // This is the only query on the critical path of every page load, so
    // nothing else belongs here. The person list the capture sheet needs is
    // fetched when that sheet opens.
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("display_name,email")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    displayName =
      profile?.display_name ||
      user.user_metadata.full_name ||
      user.user_metadata.name ||
      email.split("@")[0] ||
      "Your account";
    email = profile?.email || email;
  }

  return (
    <AppShell
      displayName={displayName}
      email={email}
    >
      {children}
    </AppShell>
  );
}
