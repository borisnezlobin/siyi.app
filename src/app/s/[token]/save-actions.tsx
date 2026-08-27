"use client";

import { DownloadSimple, SpinnerGap, UserPlus } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiResponseError, readJsonResponse } from "@/lib/http";

/**
 * Saving into siyi is the main thing to do with a shared card — it keeps the
 * details current if the sharer changes them, which a downloaded file cannot.
 * The contacts file stays available underneath for people who want it.
 *
 * The card text is built on the server from the sharer's selection, so nothing
 * here can widen what the link exposes.
 */
export function SaveActions({
  token,
  card,
  fileName,
  personName,
}: {
  token: string;
  card: string;
  fileName: string;
  personName: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveToSiyi() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/shares/${token}/save`, { method: "POST" });

      if (response.status === 401) {
        router.push(`/auth?next=${encodeURIComponent(`/s/${token}`)}`);
        return;
      }
      if (!response.ok) {
        throw new Error(
          await getApiResponseError(response, "They could not be saved."),
        );
      }

      const result = await readJsonResponse<{ person?: { id: string } }>(response);
      if (!result?.person) throw new Error("They could not be saved.");
      router.push(`/people/${result.person.id}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "They could not be saved.",
      );
      setSaving(false);
    }
  }

  function downloadCard() {
    const file = new File([card], fileName, { type: "text/vcard" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void saveToSiyi()}
        disabled={saving}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-6 text-sm font-semibold text-white transition-colors hover:bg-coral-strong disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 sm:w-auto"
      >
        {saving ? (
          <SpinnerGap size={17} weight="bold" className="animate-spin" aria-hidden="true" />
        ) : (
          <UserPlus size={17} weight="bold" aria-hidden="true" />
        )}
        Save {personName.split(" ")[0]} to {"siyi"}
      </button>

      <p className="mt-3 text-xs leading-5 text-ink-muted">
        Keeps up to date if they change their details.{" "}
        <button
          type="button"
          onClick={downloadCard}
          className="inline-flex items-center gap-1 font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <DownloadSimple size={13} aria-hidden="true" />
          Save to phone contacts instead
        </button>
      </p>

      {error ? <p className="mt-3 text-xs text-coral-strong">{error}</p> : null}
    </div>
  );
}
