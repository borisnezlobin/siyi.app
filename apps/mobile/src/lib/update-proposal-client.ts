import {
  createPersonNote,
  createPersonUpdate,
  createReminder,
  getPersonDetails,
  noteSectionsOf,
  savePersonNote,
  updatePerson,
} from "@/lib/data";
import { learnedUpdateFor } from "@/lib/capture-drafts";
import { storedPersonInput } from "@/lib/person-input";
import { appendToNoteBody, type ProposalFieldName } from "@/lib/update-proposal";
import type { UpdateProposalClient } from "@/lib/update-proposal-apply";

/**
 * Writing an approved proposal from the phone.
 *
 * Every write is the same queued mutation the forms use, so a proposal sorted
 * by the phone's own model can be applied with no signal at all and will reach
 * the server whenever there is one.
 */

const columnFor: Partial<Record<ProposalFieldName, string>> = {
  phone: "phoneNumber",
  email: "email",
  instagram: "instagramUsername",
};

export function mobileProposalClient({
  userId,
  personId,
  recordedOn,
}: {
  userId: string;
  personId: string;
  recordedOn: string;
}): UpdateProposalClient {
  return {
    async createUpdate(text) {
      await createPersonUpdate(
        userId,
        learnedUpdateFor({ personIds: [personId], text, recordedOn }),
      );
    },

    async saveFields(fields) {
      // Read again rather than trusting what was on screen when the model was
      // asked: `updatePerson` writes every column, so a stale copy would undo
      // anything edited while the sorting was happening.
      const details = await getPersonDetails(personId);
      if (!details) throw new Error("That person could not be found.");

      const input = storedPersonInput(details.person);
      for (const { field, value } of fields) {
        // Discord is only ever a contact method, never a column here.
        if (field === "discord") continue;
        (input as unknown as Record<string, unknown>)[columnFor[field] ?? field] = value;
      }

      await updatePerson(userId, personId, input);
    },

    async appendToNote({ noteId, heading, text }) {
      const details = await getPersonDetails(personId);
      const note = noteSectionsOf(details).sections.find((entry) => entry.id === noteId);
      if (!note) throw new Error(`${heading} could not be found.`);

      await savePersonNote(userId, note, {
        heading: note.heading,
        body: appendToNoteBody(note.body, text),
      });
    },

    async createNote({ heading, text }) {
      // Opened with its words already in it: one queued mutation rather than a
      // create followed by an edit that could arrive out of order.
      await createPersonNote(userId, personId, heading, text);
    },

    async createReminder({ text, dueAt }) {
      await createReminder(userId, { personId, text, dueAt });
    },
  };
}
