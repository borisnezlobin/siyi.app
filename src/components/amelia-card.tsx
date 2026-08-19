"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { relativeDateLabel } from "@/lib/relative-time";

type AmeliaOverview = {
  configured: boolean;
  reachable?: boolean;
  link?: { ameliaPersonId: string } | null;
  people?: { id: string; name: string; linked: boolean }[];
  conversations?: {
    id: string;
    title: string | null;
    startedAt: string;
    participants: string[];
    imported: boolean;
  }[];
};

type Props = {
  personId: string;
  personName: string;
};

/**
 * The bridge to Amelia, the conversation-capture service. Renders nothing at
 * all when Amelia is not configured, so the section only exists for people
 * running the service.
 */
export function AmeliaCard({ personId, personName }: Props) {
  const router = useRouter();
  const [overview, setOverview] = useState<AmeliaOverview | null>(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/amelia/overview?personId=${encodeURIComponent(personId)}`,
      );
      if (!response.ok) throw new Error("Amelia overview failed.");
      setOverview((await response.json()) as AmeliaOverview);
    } catch {
      setOverview(null);
    }
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!overview?.configured) return null;

  const act = async (run: () => Promise<Response>) => {
    setBusy(true);
    setError(null);
    try {
      const response = await run();
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Something went wrong.");
      }
      await load();
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  };

  const linkSpeaker = () =>
    act(() =>
      fetch("/api/amelia/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId, ameliaPersonId: selectedSpeaker }),
      }),
    );

  const unlinkSpeaker = () =>
    act(() =>
      fetch("/api/amelia/links", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId }),
      }),
    );

  const importConversation = (conversationId: string) =>
    act(() =>
      fetch("/api/amelia/conversations/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId }),
      }),
    );

  const linkableSpeakers = (overview.people ?? []).filter(
    (speaker) => !speaker.linked,
  );
  const linkedSpeakerName = overview.link
    ? (overview.people ?? []).find(
        (speaker) => speaker.id === overview.link?.ameliaPersonId,
      )?.name
    : null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-bold">Conversations</h2>
      {!overview.reachable ? (
        <p className="mt-3 text-sm text-ink-muted">
          Amelia is not reachable right now.
        </p>
      ) : overview.link ? (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-muted">
              Voice linked to {linkedSpeakerName ?? personName} in Amelia.
            </p>
            <button
              type="button"
              onClick={unlinkSpeaker}
              disabled={busy}
              className="text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-50"
            >
              Unlink
            </button>
          </div>
          <ul className="mt-2">
            {(overview.conversations ?? []).map((conversation) => (
              <li
                key={conversation.id}
                className="flex items-center justify-between gap-3 border-t border-ink/[0.08] py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {conversation.title ?? "Untitled conversation"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {relativeDateLabel(conversation.startedAt)} ·{" "}
                    {conversation.participants.join(", ")}
                  </p>
                </div>
                {conversation.imported ? (
                  <span className="shrink-0 text-xs text-ink-muted">
                    Imported
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => importConversation(conversation.id)}
                    disabled={busy}
                    className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/90 disabled:opacity-50"
                  >
                    Import
                  </button>
                )}
              </li>
            ))}
            {!(overview.conversations ?? []).length ? (
              <li className="border-t border-ink/[0.08] py-4 text-sm text-ink-muted">
                No captured conversations with them yet.
              </li>
            ) : null}
          </ul>
        </>
      ) : linkableSpeakers.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={selectedSpeaker}
            onChange={(event) => setSelectedSpeaker(event.target.value)}
            className="min-h-11 rounded-xl border border-ink/[0.12] bg-white px-3 text-sm"
          >
            <option value="">Pick an Amelia speaker</option>
            {linkableSpeakers.map((speaker) => (
              <option key={speaker.id} value={speaker.id}>
                {speaker.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={linkSpeaker}
            disabled={busy || !selectedSpeaker}
            className="min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-ink/90 disabled:opacity-50"
          >
            Link voice
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">
          No unlinked Amelia speakers to connect yet.
        </p>
      )}
      {error ? (
        <p className="mt-2 text-xs text-coral-strong">{error}</p>
      ) : null}
    </section>
  );
}
