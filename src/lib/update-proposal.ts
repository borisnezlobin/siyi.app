import { contactMethodKinds } from "@/lib/contact-methods";
import { normalizeInstagramUsername } from "@/lib/instagram";
import { courseCodeKey, normalizeCourseCode } from "@/lib/classes";
import { maxNoteBodyLength, maxNoteSectionsPerPerson, normalizeNoteHeading } from "@/lib/note-sections";
import { formatPhoneNumberInput } from "@/lib/phone-format";

/**
 * Sorting one typed sentence into the places it belongs.
 *
 * Everything here is pure. The model — Apple's on the phone, Gemini everywhere
 * else — only ever produces the shape below; deciding what that means for a
 * particular person, and what would overwrite something, happens here, where it
 * can be tested without a model in the loop.
 *
 * Nothing in this module writes anything. It produces a plan for the person to
 * approve, and `update-proposal-apply.ts` carries it out.
 */

/** The sections a new person starts with, and the buckets the model sorts into. */
export const defaultNoteHeadings = ["Interests", "Facts", "Future"] as const;

export const proposalFieldNames = [
  "hometown",
  "university",
  "major",
  "graduationYear",
  "birthday",
  "dormOrResidence",
  "firstMetLocation",
  "relationshipLabel",
  ...contactMethodKinds,
] as const;

export type ProposalFieldName = (typeof proposalFieldNames)[number];

export const proposalFieldLabels: Record<ProposalFieldName, string> = {
  hometown: "Hometown",
  university: "University",
  major: "Major",
  graduationYear: "Graduation year",
  birthday: "Birthday",
  dormOrResidence: "Where they live",
  firstMetLocation: "Where you met",
  relationshipLabel: "How you know them",
  phone: "Phone",
  email: "Email",
  instagram: "Instagram",
  discord: "Discord",
};

/**
 * What each field is for, in the words a model is told.
 *
 * Spelled out rather than derived from the labels above: a label is written to
 * sit over a form input, and "the person's where you met" is not a sentence.
 */
export const proposalFieldHints: Record<ProposalFieldName, string> = {
  hometown: "the town or city they are from",
  university: "the university or college they attend",
  major: "what they study",
  graduationYear: "the year they graduate",
  birthday:
    "the day they were born, including when the note gives the day they turn an age",
  dormOrResidence: "where they live now, such as a dorm or a neighbourhood",
  firstMetLocation: "where you first met them",
  relationshipLabel: "how you know them, such as a classmate or a cousin",
  phone: "their phone number",
  email: "their email address",
  instagram: "their Instagram handle",
  discord: "their Discord username",
};

const contactFields = new Set<ProposalFieldName>(contactMethodKinds);

export function isContactField(field: ProposalFieldName) {
  return contactFields.has(field);
}

/** What a model is allowed to hand back. Anything else is dropped, not repaired. */
export type UpdateProposal = {
  notes: { heading: string; text: string }[];
  fields: { field: ProposalFieldName; value: string }[];
  /**
   * `dueOn` is the date the note actually named, copied as written. `dueInDays`
   * is only for something relative — "in three weeks". Given a date, a model is
   * asked to repeat it rather than to count the days to it: counting is
   * arithmetic, and a small model gets it wrong by a day often enough that a
   * reminder lands on the wrong date.
   */
  reminders: { text: string; dueInDays: number; dueOn?: string }[];
  /** Course codes or names, as written: "math 53", "middle eastern studies". */
  classes: string[];
  leftover: string;
};

const maxNotes = 6;
const maxFields = 8;
// A four-day span is four reminders on its own, so a ceiling of four meant one
// ordinary sentence used the whole allowance and anything after it was cut.
const maxReminders = 12;

function cleanText(value: unknown, limit: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, limit);
}

/**
 * Validated by hand rather than with a schema library: the two apps are on
 * different major versions of zod, and this shape has to mean exactly the same
 * thing on both. It is small enough that the check is clearer than the config.
 */
export function normalizeProposal(raw: unknown): UpdateProposal | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;

  const notes: UpdateProposal["notes"] = [];
  if (Array.isArray(source.notes)) {
    for (const entry of source.notes.slice(0, maxNotes)) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const heading = cleanText(row.heading, 60);
      const text = cleanText(row.text, 500);
      if (heading && text) notes.push({ heading, text });
    }
  }

  const fields: UpdateProposal["fields"] = [];
  const seenFields = new Set<string>();
  if (Array.isArray(source.fields)) {
    for (const entry of source.fields.slice(0, maxFields)) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const field = proposalFieldNames.find((name) => name === row.field);
      const value = cleanText(row.value, 200);
      if (!field || !value) continue;

      // A person has one hometown, so a model offering two has misread the
      // sentence and choosing between them would be a guess. But they may well
      // have two email addresses, and the app already holds as many as they
      // like — so a contact is kept per value rather than per field.
      const key = isContactField(field) ? `${field}:${value.toLowerCase()}` : field;
      if (seenFields.has(key)) continue;
      seenFields.add(key);
      fields.push({ field, value });
    }
  }

  const reminders: UpdateProposal["reminders"] = [];
  if (Array.isArray(source.reminders)) {
    for (const entry of source.reminders.slice(0, maxReminders)) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const text = cleanText(row.text, 500);
      const days = typeof row.dueInDays === "number" ? Math.round(row.dueInDays) : null;
      const dueOn = cleanText(row.dueOn, 40) ?? undefined;
      if (!text || days === null || days < 0 || days > 3650) continue;
      reminders.push(dueOn ? { text, dueInDays: days, dueOn } : { text, dueInDays: days });
    }
  }

  const classes: string[] = [];
  if (Array.isArray(source.classes)) {
    for (const entry of source.classes.slice(0, 8)) {
      const course = cleanText(entry, 40);
      if (course && !classes.some((held) => held.toLowerCase() === course.toLowerCase())) {
        classes.push(course);
      }
    }
  }

  const leftover = cleanText(source.leftover, 2000) ?? "";

  return { notes, fields, reminders, classes, leftover };
}

const yearPattern = /(?:^|\D)('?\d{2}|\d{4})(?:\D|$)/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The model hands back whatever the person wrote — "class of '27", "june 3rd".
 * Turning that into something the column will accept happens here rather than in
 * two different models, because here it can be tested.
 */
export function coerceFieldValue(
  field: ProposalFieldName,
  value: string,
): { ok: true; value: string | number } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false };

  if (field === "graduationYear") {
    const match = yearPattern.exec(trimmed);
    if (!match) return { ok: false };
    const digits = match[1].replace("'", "");
    const year = digits.length === 2 ? 2000 + Number(digits) : Number(digits);
    if (year < 1950 || year > 2100) return { ok: false };
    return { ok: true, value: year };
  }

  if (field === "birthday") {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (iso) {
      const date = new Date(`${trimmed}T00:00:00Z`);
      return Number.isNaN(date.getTime()) ? { ok: false } : { ok: true, value: trimmed };
    }
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed) || !yearPattern.test(trimmed)) return { ok: false };
    // Written out from the local parts. Going through toISOString would move
    // the date a day earlier for anyone east of UTC, which on a birthday is a
    // wrong answer that nobody would think to check.
    const date = new Date(parsed);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return { ok: true, value: `${date.getFullYear()}-${month}-${day}` };
  }

  if (field === "phone") {
    const formatted = formatPhoneNumberInput(trimmed);
    const digits = formatted.replace(/\D/g, "");
    if (digits.length < 7) return { ok: false };
    return { ok: true, value: formatted };
  }

  if (field === "email") {
    const lowered = trimmed.toLowerCase();
    return emailPattern.test(lowered) ? { ok: true, value: lowered } : { ok: false };
  }

  if (field === "instagram") {
    const handle = normalizeInstagramUsername(trimmed);
    return handle ? { ok: true, value: handle } : { ok: false };
  }

  return { ok: true, value: trimmed.slice(0, field === "university" ? 120 : 1000) };
}

/** Appended, never replaced: a section is a list of things learned over time. */
export function appendToNoteBody(existingBody: string, text: string): string {
  const body = existingBody.trim();
  if (!body) return text.trim().slice(0, maxNoteBodyLength);
  // Saving the same update twice should not say it twice.
  if (body.toLowerCase().includes(text.trim().toLowerCase())) return body;
  return `${body}\n${text.trim()}`.slice(0, maxNoteBodyLength);
}

export function dueAtFromDays(dueInDays: number, now: Date): string {
  const due = new Date(now);
  due.setDate(due.getDate() + dueInDays);
  due.setHours(9, 0, 0, 0);
  return due.toISOString();
}

/** Whole days between two moments, counted by the day each falls on. */
export function daysBetweenDays(from: Date, to: Date): number {
  const start = new Date(from).setHours(0, 0, 0, 0);
  const end = new Date(to).setHours(0, 0, 0, 0);
  return Math.round((end - start) / 86_400_000);
}

const monthNames = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * A date as somebody wrote it — "august 23rd", "23 Aug", "2026-08-23".
 *
 * Parsed by hand rather than with `Date.parse`, which on Hermes understands
 * little beyond ISO and would quietly return a different answer on the phone
 * than in a test. A date with no year means the next one to come around.
 */
export function parseWrittenDate(value: string, now: Date): Date | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) {
    const parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 9);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // "23rd" is a day; the suffix carries nothing.
  const cleaned = text.replace(/(\d+)(?:st|nd|rd|th)\b/g, "$1");
  const month = monthNames.findIndex((name) =>
    new RegExp(`\\b${name.slice(0, 3)}[a-z]*\\b`).test(cleaned),
  );
  if (month < 0) return null;

  const numbers = cleaned.match(/\d{1,4}/g) ?? [];
  const day = numbers.map(Number).find((value) => value >= 1 && value <= 31);
  if (day === undefined) return null;
  const year = numbers.map(Number).find((value) => value >= 1900 && value <= 2200);

  const due = new Date(year ?? now.getFullYear(), month, day, 9, 0, 0, 0);
  if (due.getMonth() !== month || due.getDate() !== day) return null;

  // No year given, and that date has already gone by: they mean the next one.
  if (!year && due.getTime() < new Date(now).setHours(0, 0, 0, 0)) {
    due.setFullYear(due.getFullYear() + 1);
  }
  return due;
}

/**
 * When a reminder is due. A date the note named wins over a number of days,
 * because it is the thing the person actually said.
 */
export function reminderDueAt(
  reminder: { dueInDays: number; dueOn?: string },
  now: Date,
): string {
  const written = reminder.dueOn ? parseWrittenDate(reminder.dueOn, now) : null;
  return written ? written.toISOString() : dueAtFromDays(reminder.dueInDays, now);
}

// ---------------------------------------------------------------------------
// What the model is told, and what its answer means for this person.
// ---------------------------------------------------------------------------

export type ProposalPerson = {
  fullName: string;
  preferredName?: string | null;
  hometown?: string | null;
  university?: string | null;
  major?: string | null;
  graduationYear?: number | null;
  birthday?: string | null;
  dormOrResidence?: string | null;
  firstMetLocation?: string | null;
  relationshipLabel?: string | null;
};

export type ProposalSection = { id: string; heading: string; body: string };

/**
 * What the model is allowed to know.
 *
 * Only which of the plain fields are already filled, and the section headings —
 * never a contact detail, never the body of a note. The model does not need any
 * of that to sort a sentence, and on the Gemini path this context leaves the
 * device. Conflicts are worked out here afterwards, against the real person.
 */
export function buildProposalContext({
  person,
  sections,
  now,
}: {
  person: ProposalPerson;
  sections: ProposalSection[];
  now: Date;
}): string {
  const known: string[] = [];
  for (const field of proposalFieldNames) {
    if (isContactField(field)) continue;
    const current = person[field as keyof ProposalPerson];
    if (current !== null && current !== undefined && current !== "") {
      known.push(proposalFieldLabels[field]);
    }
  }

  const headings = sections.map((section) => section.heading);
  const weekday = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return [
    `Today is ${weekday}.`,
    `The person is called ${person.preferredName || person.fullName}.`,
    known.length
      ? `Already known, so do not repeat it: ${known.join(", ")}.`
      : "Nothing is filled in for them yet.",
    headings.length
      ? `Their note headings: ${headings.join(", ")}.`
      : `Their note headings: ${defaultNoteHeadings.join(", ")}.`,
  ].join("\n");
}

export function proposalInstructions(): string {
  return [
    "You sort one short note about a person into structured parts.",
    "Use only what the note says. Never invent a fact and never guess.",
    // Without this the model does not realise a profile field is even an
    // option, and files "doing a chemistry major" as a note about them.
    "A profile field always beats a note. These are the fields, and what belongs in each:",
    ...proposalFieldNames.map((field) => `  ${field}: ${proposalFieldHints[field]}`),
    // Without this the model has no way to say "two emails" and gives up on
    // the fields entirely, putting both addresses in a note.
    "A person can have several phones, emails, Instagram handles or Discord names. Give each one its own entry rather than describing them together.",
    "Courses they are taking go in classes, one entry each, written the way the note wrote them.",
    "Only when a fact fits none of those does it become a note.",
    "Put a note under one of the person's existing headings when it fits; only use a new heading when none of them do.",
    "Do not repeat something as a note if you already made it a field or a reminder.",
    "Do not propose a field the person already has a value for unless the note plainly corrects it.",
    "Only make a reminder for something with a date or a deadline in the future.",
    // A date column will not take "last July", and today's date is already at
    // the top of the context.
    "A date in a field must be a complete calendar date as yyyy-mm-dd.",
    // Counting days is arithmetic, and getting it wrong by one puts the
    // reminder on the wrong day. Repeating the date is not.
    "When the note names a date, copy it into dueOn exactly as written and set dueInDays to 0.",
    "Only work out dueInDays when the note says something relative, like 'in three weeks', and leave dueOn empty.",
    "Put anything you are unsure about, or that fits nowhere, in leftover, copied word for word.",
    'Use "" for leftover when everything was sorted.',
  ].join("\n");
}

export type ProposalItem =
  | { id: string; kind: "note"; heading: string; text: string; noteId: string | null }
  | {
      id: string;
      kind: "field";
      field: ProposalFieldName;
      value: string | number;
      display: string;
      current: string | null;
      conflict: boolean;
      /** A further phone or email, kept alongside the ones already there. */
      adds: boolean;
    }
  | { id: string; kind: "reminder"; text: string; dueAt: string; dueInDays: number }
  | { id: string; kind: "class"; course: string };

export type ItemDecision = { removed?: boolean; keepExisting?: boolean };
export type Decisions = Record<string, ItemDecision>;

function currentFieldValue(
  person: ProposalPerson,
  field: ProposalFieldName,
): string | null {
  const value = person[field as keyof ProposalPerson];
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

/**
 * The proposal, turned into rows a person can say yes or no to.
 *
 * A value the person already has is dropped rather than shown as a change. A
 * value that differs from one already there is a conflict: it is offered, with
 * both values, and nothing is chosen on their behalf.
 */
export function buildProposalItems({
  proposal,
  person,
  sections,
  contact = {},
  classes = [],
  now,
}: {
  proposal: UpdateProposal;
  person: ProposalPerson;
  sections: ProposalSection[];
  /** Every phone, email and handle they already have, by kind. */
  contact?: Partial<Record<ProposalFieldName, string[]>>;
  /** The course codes already on their list, so none is offered twice. */
  classes?: string[];
  now: Date;
}): ProposalItem[] {
  const items: ProposalItem[] = [];

  const byHeading = new Map(
    sections.map((section) => [normalizeNoteHeading(section.heading).toLowerCase(), section]),
  );
  const reminderText = proposal.reminders.map((entry) => entry.text.toLowerCase());
  let openedSections = 0;

  proposal.notes.forEach((note, index) => {
    // Already going in as a reminder; saying it twice is noise, not safety.
    if (reminderText.some((text) => text.includes(note.text.toLowerCase()))) return;

    const heading = normalizeNoteHeading(note.heading);
    const existing = byHeading.get(heading.toLowerCase());
    if (!existing && sections.length + openedSections >= maxNoteSectionsPerPerson) return;
    if (!existing) openedSections += 1;

    items.push({
      id: `note:${index}`,
      kind: "note",
      heading: existing?.heading ?? heading,
      text: note.text,
      noteId: existing?.id ?? null,
    });
  });

  // Anything the parser cannot read is kept as words rather than thrown away.
  // A value that fits no column is still something the person told us, and a
  // fact that vanishes with nothing on screen to show for it is worse than a
  // fact filed in the wrong place — one can be corrected, the other cannot.
  const unreadableFields: UpdateProposal["fields"] = [];

  proposal.fields.forEach((entry, index) => {
    const coerced = coerceFieldValue(entry.field, entry.value);
    if (!coerced.ok) {
      unreadableFields.push(entry);
      return;
    }

    const value = coerced.value;
    const display = String(value);

    // A contact is added to the ones they already have, so the only reason to
    // say nothing is that they already have this exact one. Nothing is being
    // replaced, so there is nothing to warn about either.
    if (isContactField(entry.field)) {
      const held = contact[entry.field] ?? [];
      if (held.some((value) => value.toLowerCase() === display.toLowerCase())) return;

      items.push({
        id: `field:${entry.field}:${index}`,
        kind: "field",
        field: entry.field,
        value,
        display,
        current: null,
        conflict: false,
        adds: held.length > 0,
      });
      return;
    }

    const current = currentFieldValue(person, entry.field);
    if (current !== null && current.toLowerCase() === display.toLowerCase()) return;

    items.push({
      id: `field:${entry.field}`,
      kind: "field",
      field: entry.field,
      value,
      display,
      current,
      conflict: current !== null,
      adds: false,
    });
  });

  proposal.classes.forEach((course, index) => {
    const code = normalizeCourseCode(course);
    // Already on their list: "math 53" and "MATH53" are the same course.
    if (classes.some((held) => courseCodeKey(held) === courseCodeKey(code))) return;
    items.push({ id: `class:${index}`, kind: "class", course: code });
  });

  unreadableFields.forEach((entry, index) => {
    const heading = sections[0]?.heading ?? defaultNoteHeadings[1];
    items.push({
      id: `unreadable:${entry.field}:${index}`,
      kind: "note",
      heading,
      text: `${proposalFieldLabels[entry.field]}: ${entry.value}`,
      noteId: sections[0]?.id ?? null,
    });
  });

  proposal.reminders.forEach((entry, index) => {
    const dueAt = reminderDueAt(entry, now);
    items.push({
      id: `reminder:${index}`,
      kind: "reminder",
      text: entry.text,
      dueAt,
      // Taken back off the date rather than trusted from the model: when the
      // note named a day, that day decides how far away it is, and the two
      // disagreeing is how a reminder ends up shown as one date and saved as
      // another.
      dueInDays: daysBetweenDays(now, new Date(dueAt)),
    });
  });

  return items;
}

export type ProposalPlan = {
  noteAppends: { noteId: string; heading: string; text: string }[];
  noteCreates: { heading: string; text: string }[];
  /** Set on the person, replacing whatever was there. */
  fields: { field: ProposalFieldName; value: string | number }[];
  /** Kept alongside what is already there, never instead of it. */
  contacts: { kind: ProposalFieldName; value: string }[];
  classes: string[];
  reminders: { text: string; dueAt: string }[];
};

export function planFromItems(items: ProposalItem[], decisions: Decisions): ProposalPlan {
  const plan: ProposalPlan = {
    noteAppends: [],
    noteCreates: [],
    fields: [],
    contacts: [],
    classes: [],
    reminders: [],
  };

  for (const item of items) {
    const decision = decisions[item.id] ?? {};
    if (decision.removed) continue;

    if (item.kind === "note") {
      if (item.noteId) {
        plan.noteAppends.push({ noteId: item.noteId, heading: item.heading, text: item.text });
      } else {
        plan.noteCreates.push({ heading: item.heading, text: item.text });
      }
      continue;
    }

    if (item.kind === "field") {
      // Keeping what is already there is a decision, not a removal: the row
      // stays on screen showing which of the two won.
      if (decision.keepExisting) continue;
      if (isContactField(item.field)) {
        plan.contacts.push({ kind: item.field, value: String(item.value) });
        continue;
      }
      plan.fields.push({ field: item.field, value: item.value });
      continue;
    }

    if (item.kind === "class") {
      plan.classes.push(item.course);
      continue;
    }

    plan.reminders.push({ text: item.text, dueAt: item.dueAt });
  }

  return plan;
}

export function planSize(plan: ProposalPlan): number {
  return (
    plan.noteAppends.length +
    plan.noteCreates.length +
    plan.fields.length +
    plan.contacts.length +
    plan.classes.length +
    plan.reminders.length
  );
}

/** One wording for both apps, so the phone and the web never disagree. */
export function describeItem(item: ProposalItem): { title: string; detail: string } {
  if (item.kind === "note") {
    return {
      title: item.noteId ? item.heading : `${item.heading} · new section`,
      detail: item.text,
    };
  }
  if (item.kind === "field") {
    return { title: proposalFieldLabels[item.field], detail: item.display };
  }
  if (item.kind === "class") {
    return { title: "Class", detail: item.course };
  }
  // Anything more than a week out is named by its date. "In 14 days" is not
  // something a person can check, and this is the screen for checking.
  const when =
    item.dueInDays === 0
      ? "today"
      : item.dueInDays === 1
        ? "tomorrow"
        : item.dueInDays <= 7
          ? `in ${item.dueInDays} days`
          : new Date(item.dueAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
            });
  return { title: "Reminder", detail: `${item.text} · ${when}` };
}
