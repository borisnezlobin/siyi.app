import {
  createPersonNote,
  createPersonUpdate,
  createReminder,
  getPersonDetails,
  noteSectionsOf,
  savePersonNote,
  updatePerson,
} from "@/lib/data";
import { addClass } from "@/lib/classes-data";
import { learnedUpdateFor } from "@/lib/capture-drafts";
import { contactDraftsOf, type ContactMethodDraft } from "@/lib/contact-methods";
import { storedPersonInput } from "@/lib/person-input";
import { appendToNoteBody } from "@/lib/update-proposal";
import type { UpdateProposalClient } from "@/lib/update-proposal-apply";

/**
 * Writing an approved proposal from the phone.
 *
 * Every write is the same queued mutation the forms use, so a proposal sorted
 * by the phone's own model can be applied with no signal at all and will reach
 * the server whenever there is one.
 */

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

      // Contacts are added rather than set, and go through addContacts.
      const input = storedPersonInput(details.person);
      for (const { field, value } of fields) {
        (input as unknown as Record<string, unknown>)[field] = value;
      }

      await updatePerson(userId, personId, input);
    },

    async addContacts(contacts) {
      const details = await getPersonDetails(personId);
      if (!details) throw new Error("That person could not be found.");

      // Read fresh and merged here, so a second email joins the first instead
      // of replacing the set.
      const held = contactDraftsOf(details.person);
      const drafts = [...held];
      for (const contact of contacts) {
        const kind = contact.kind as ContactMethodDraft["kind"];
        const sameKind = drafts.filter((draft) => draft.kind === kind);
        if (sameKind.some((draft) => draft.value.toLowerCase() === contact.value.toLowerCase())) {
          continue;
        }
        drafts.push({
          kind,
          value: contact.value,
          label: null,
          isPrimary: sameKind.length === 0,
        });
      }

      await updatePerson(
        userId,
        personId,
        storedPersonInput(details.person),
        undefined,
        undefined,
        drafts,
        held,
      );
    },

    async addClass(course) {
      await addClass(userId, {
        personId,
        courseCode: course,
        // Everything else is left for them to fill in on the profile; a note
        // saying "taking math 53" does not say who teaches it or when.
        courseTitle: null,
        professor: null,
        term: null,
        days: null,
        startsAt: null,
        endsAt: null,
        location: null,
      });
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
