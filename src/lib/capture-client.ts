import { timestampFromDateInput } from "@/lib/date-input";
import { getApiResponseError } from "@/lib/http";
import { interactionFromTitle } from "@/lib/interaction-title";

/**
 * Both composers post from the browser, and both have to behave in the preview
 * build the end-to-end tests run against, where there is no database at all.
 */

export const isPreviewOnly = () => !process.env.NEXT_PUBLIC_SUPABASE_URL;

async function pretendToSave() {
  await new Promise((resolve) => window.setTimeout(resolve, 300));
  return null;
}

export type InteractionLogDraft = {
  personIds: string[];
  title: string;
  occurredOn: string;
  note: string;
};

/** Resolves to an error message, or null when it saved. */
export async function logInteraction(
  draft: InteractionLogDraft,
): Promise<string | null> {
  if (isPreviewOnly()) return pretendToSave();

  const { type, customLabel } = interactionFromTitle(draft.title);
  const response = await fetch("/api/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      personIds: draft.personIds,
      type,
      occurredAt: timestampFromDateInput(draft.occurredOn),
      note: draft.note,
      customLabel,
      customIcon: null,
    }),
  });

  return response.ok
    ? null
    : getApiResponseError(response, "That could not be saved.");
}

export async function saveUpdate(draft: {
  personId: string;
  text: string;
  recordedOn: string;
}): Promise<string | null> {
  if (isPreviewOnly()) return pretendToSave();

  const response = await fetch("/api/updates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      personIds: [draft.personId],
      text: draft.text,
      recordedAt: timestampFromDateInput(draft.recordedOn),
    }),
  });

  return response.ok
    ? null
    : getApiResponseError(response, "That update could not be saved.");
}
