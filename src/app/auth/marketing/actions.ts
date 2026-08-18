"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : "/today";
}

/**
 * Both answers are recorded. "No" has to be written down as firmly as "yes":
 * an unanswered prompt and a declined one look identical otherwise, and the
 * question would come back every time they signed in.
 */
export async function answerMarketingPrompt(formData: FormData) {
  const destination = safeNext(formData.get("next"));
  const optIn = formData.get("optIn") === "yes";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const now = new Date().toISOString();
    await supabase
      .from("user_profiles")
      .update({
        marketing_opt_in: optIn,
        marketing_opt_in_at: optIn ? now : null,
        marketing_prompted_at: now,
      })
      .eq("auth_user_id", user.id);
  }

  redirect(destination);
}
