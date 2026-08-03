"use client";

import { Archive } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArchivePersonButton({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function archivePerson() {
    if (
      !window.confirm(
        `Archive ${personName}? They will stop appearing in reminders, but their history stays available.`,
      )
    ) {
      return;
    }

    setWorking(true);

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch(`/api/people/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });

      if (!response.ok) {
        setWorking(false);
        return;
      }
    }

    router.push("/people");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={archivePerson}
      disabled={working}
      className="inline-flex items-center gap-2 rounded-xl bg-mist px-3 py-2.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-sage disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
    >
      <Archive size={16} aria-hidden="true" />
      {working ? "Archiving…" : "Archive"}
    </button>
  );
}
