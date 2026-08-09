import type { ProposalFieldName, ProposalPlan } from "@/lib/update-proposal";

/**
 * Carrying out an approved proposal.
 *
 * Written against an injected client so the order and the failure handling can
 * be tested without a database on either app, and so the phone can queue its
 * writes offline while the web posts them.
 */
export type UpdateProposalClient = {
  /** The sentence as it was typed. */
  createUpdate(text: string): Promise<void>;
  saveFields(fields: { field: ProposalFieldName; value: string | number }[]): Promise<void>;
  /** Added to whatever they already have, never in place of it. */
  addContacts(contacts: { kind: ProposalFieldName; value: string }[]): Promise<void>;
  addClass(course: string): Promise<void>;
  appendToNote(input: { noteId: string; heading: string; text: string }): Promise<void>;
  createNote(input: { heading: string; text: string }): Promise<void>;
  createReminder(input: { text: string; dueAt: string }): Promise<void>;
};

export type ApplyResult = {
  applied: number;
  /** What could not be written, in words a person can read. */
  failed: string[];
};

/**
 * The typed sentence goes first, always.
 *
 * It is the only part of this that the person actually wrote, and the only part
 * they would have to type again. Everything after it is a derived convenience,
 * so a failure half way through costs a field rather than their words.
 *
 * Each write is caught on its own: one rejected field must not take the
 * reminder down with it, because the person approved both.
 */
export async function applyUpdateProposal(
  client: UpdateProposalClient,
  { text, plan }: { text: string; plan: ProposalPlan },
): Promise<ApplyResult> {
  const failed: string[] = [];
  let applied = 0;

  const attempt = async (label: string, write: () => Promise<void>) => {
    try {
      await write();
      applied += 1;
    } catch {
      failed.push(label);
    }
  };

  if (text.trim()) {
    try {
      await client.createUpdate(text.trim());
    } catch {
      // Nothing else is worth attempting: the words are the point, and a
      // failure here is almost certainly a failure for everything after it.
      return { applied: 0, failed: ["the update itself"] };
    }
  }

  if (plan.fields.length > 0) {
    await attempt("the profile details", () => client.saveFields(plan.fields));
  }

  if (plan.contacts.length > 0) {
    await attempt("the contact details", () => client.addContacts(plan.contacts));
  }

  for (const course of plan.classes) {
    await attempt(course, () => client.addClass(course));
  }

  for (const note of plan.noteAppends) {
    await attempt(note.heading, () => client.appendToNote(note));
  }

  for (const note of plan.noteCreates) {
    await attempt(note.heading, () => client.createNote(note));
  }

  for (const reminder of plan.reminders) {
    await attempt("the reminder", () => client.createReminder(reminder));
  }

  return { applied, failed };
}

/** "Saved, except the reminder." — said once, however many parts there were. */
export function applyResultMessage(result: ApplyResult): string | null {
  if (result.failed.length === 0) return null;
  const unique = [...new Set(result.failed)];
  if (unique.length === 1) return `Saved, except ${unique[0]}.`;
  return `Saved, except ${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}.`;
}
