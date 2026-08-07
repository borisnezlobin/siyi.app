"use client";

import { Check, SpinnerGap } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiResponseError } from "@/lib/http";

/**
 * Ticking a reminder off from the Today list, the same one-tap affordance the
 * phone has on the same row.
 */
export function CompleteReminderButton({
  reminderId,
  label,
}: {
  reminderId: string;
  label: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function complete() {
    setSaving(true);
    try {
      const response = await fetch(`/api/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt: new Date().toISOString() }),
      });
      if (!response.ok) {
        throw new Error(await getApiResponseError(response, "Not saved."));
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={`Complete ${label}`}
      disabled={saving}
      onClick={() => void complete()}
      className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:text-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:cursor-wait"
    >
      {saving ? (
        <SpinnerGap size={18} className="animate-spin" aria-hidden="true" />
      ) : (
        <Check size={18} weight="bold" aria-hidden="true" />
      )}
    </button>
  );
}
