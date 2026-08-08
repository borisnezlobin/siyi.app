import { saveUpdate } from "@/lib/capture-client";
import { getApiResponseError } from "@/lib/http";
import { todayDateInputValue } from "@/lib/date-input";
import { appendToNoteBody, type ProposalFieldName } from "@/lib/update-proposal";
import type { UpdateProposalClient } from "@/lib/update-proposal-apply";

/**
 * Writing an approved proposal from the browser.
 *
 * Every write goes through a route that already exists and already validates —
 * nothing here is a new way into the database, it is the same doors the forms
 * use.
 */

const columnFor: Partial<Record<ProposalFieldName, string>> = {
  phone: "phoneNumber",
  email: "email",
  instagram: "instagramUsername",
};

async function must(response: Response, fallback: string) {
  if (!response.ok) throw new Error(await getApiResponseError(response, fallback));
}

export function webProposalClient({
  personId,
  sectionBodies,
}: {
  personId: string;
  /** What each section already holds, so an append does not replace it. */
  sectionBodies: Record<string, string>;
}): UpdateProposalClient {
  return {
    async createUpdate(text) {
      const failure = await saveUpdate({
        personId,
        text,
        recordedOn: todayDateInputValue(),
      });
      if (failure) throw new Error(failure);
    },

    async saveFields(fields) {
      const patch: Record<string, string | number> = {};
      for (const { field, value } of fields) {
        // Discord lives only in contact methods, so it is not a column here and
        // is left to the contact editor rather than guessed at.
        if (field === "discord") continue;
        patch[columnFor[field] ?? field] = value;
      }
      if (Object.keys(patch).length === 0) return;

      await must(
        await fetch(`/api/people/${personId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }),
        "Those details could not be saved.",
      );
    },

    async appendToNote({ noteId, heading, text }) {
      await must(
        await fetch(`/api/person-notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            heading,
            body: appendToNoteBody(sectionBodies[noteId] ?? "", text),
          }),
        }),
        `${heading} could not be saved.`,
      );
    },

    async createNote({ heading, text }) {
      await must(
        await fetch("/api/person-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId, heading, body: text }),
        }),
        `${heading} could not be saved.`,
      );
    },

    async createReminder({ text, dueAt }) {
      await must(
        await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId, text, dueAt }),
        }),
        "That reminder could not be saved.",
      );
    },
  };
}
