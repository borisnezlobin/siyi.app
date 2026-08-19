"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiResponseError } from "@/lib/http";
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

type BusyAction = "link" | "unlink" | `import:${string}` | null;

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
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  // Every fetch checks it still belongs to the mounted personId before it
  // writes state, so a slow response for the previous person cannot land on
  // the next one, and nothing writes after unmount.
  const activePersonId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/amelia/overview?personId=${encodeURIComponent(personId)}`,
    );
    if (!response.ok) {
      throw new Error(
        await getApiResponseError(response, "Loading Amelia data failed."),
      );
    }
    const next = (await response.json()) as AmeliaOverview;
    if (activePersonId.current === personId) setOverview(next);
  }, [personId]);

  useEffect(() => {
    activePersonId.current = personId;
    setOverview(null);
    setSelectedSpeaker("");
    setError(null);
    load().catch(() => {
      // An initial failure reads as "no Amelia here" — the section stays
      // hidden rather than opening with an error for an optional service.
    });
    return () => {
      activePersonId.current = null;
    };
  }, [personId, load]);

  if (!overview?.configured) return null;

  const act = async (action: BusyAction, run: () => Promise<Response>) => {
    setBusy(action);
    setError(null);
    try {
      const response = await run();
      if (!response.ok) {
        throw new Error(
          await getApiResponseError(response, "Something went wrong."),
        );
      }
      await load();
      router.refresh();
    } catch (actionError) {
      if (activePersonId.current !== personId) return;
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Something went wrong.",
      );
    } finally {
      if (activePersonId.current === personId) setBusy(null);
    }
  };

  const linkSpeaker = () =>
    act("link", () =>
      fetch("/api/amelia/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId, ameliaPersonId: selectedSpeaker }),
      }),
    );

  const unlinkSpeaker = () =>
    act("unlink", () =>
      fetch("/api/amelia/links", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId }),
      }),
    );

  const importConversation = (conversationId: string) =>
    act(`import:${conversationId}`, () =>
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
              disabled={busy !== null}
              className="text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-50"
            >
              {busy === "unlink" ? "Unlinking…" : "Unlink"}
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
                    disabled={busy !== null}
                    className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/90 disabled:opacity-50"
                  >
                    {busy === `import:${conversation.id}`
                      ? "Importing…"
                      : "Import"}
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
          <label htmlFor="amelia-speaker" className="sr-only">
            Amelia speaker
          </label>
          <select
            id="amelia-speaker"
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
            disabled={busy !== null || !selectedSpeaker}
            className="min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-ink/90 disabled:opacity-50"
          >
            {busy === "link" ? "Linking…" : "Link voice"}
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
