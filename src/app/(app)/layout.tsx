import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPeople } from "@/lib/data";
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

  const quickPeople = (await getPeople()).map((person) => ({
    id: person.id,
    fullName: person.fullName,
    preferredName: person.preferredName,
    profilePhotoUrl: person.profilePhotoUrl,
  }));

  return (
    <AppShell
      displayName={displayName}
      email={email}
      quickPeople={quickPeople}
    >
      {children}
    </AppShell>
  );
}
