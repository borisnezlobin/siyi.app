import { normalizeInstagramUsername } from "@/lib/instagram";
import { formatPhoneNumberInput } from "@/lib/phone-format";

export const contactMethodKinds = ["phone", "email", "instagram"] as const;
export type ContactMethodKind = (typeof contactMethodKinds)[number];

export type ContactMethod = {
  id: string;
  personId: string;
  userId: string;
  kind: ContactMethodKind;
  value: string;
  label: string | null;
  position: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Empty and unavailable are different: the table only exists once migration
 * 0013 has been applied, and until then every reader falls back to the single
 * columns on `people`. */
export type PersonContactMethods = {
  available: boolean;
  methods: ContactMethod[];
};

export const unavailableContactMethods: PersonContactMethods = {
  available: false,
  methods: [],
};

/** One row as the form holds it, before it has an id in the database. Order in
 * the list is the stored position, so nothing has to keep an index in sync. */
export type ContactMethodDraft = {
  id?: string;
  kind: ContactMethodKind;
  value: string;
  label: string | null;
  isPrimary: boolean;
};

/** The three single columns on `people`, which stay the primary of each kind. */
export type LegacyContactColumns = {
  phoneNumber: string | null;
  email: string | null;
  instagramUsername: string | null;
};

export const maxContactMethodsPerKind = 12;
export const maxContactMethodLabelLength = 40;
export const maxContactMethodValueLength = 200;

export function isContactMethodKind(value: unknown): value is ContactMethodKind {
  return contactMethodKinds.includes(value as ContactMethodKind);
}

export function normalizeContactMethodValue(
  kind: ContactMethodKind,
  value: string,
) {
  if (kind === "instagram") return normalizeInstagramUsername(value);
  if (kind === "email") return value.trim();
  // Phone numbers keep whatever shape the person typed, exactly as the single
  // phone_number column has always stored them.
  return value.trim();
}

function normalizeLabel(label: string | null | undefined) {
  const trimmed = label?.trim() ?? "";
  return trimmed ? trimmed.slice(0, maxContactMethodLabelLength) : null;
}

/**
 * The one invariant everything else leans on: values are normalised, blanks are
 * gone, positions run 0..n within a kind, and every kind that has any rows at
 * all has exactly one primary. Deleting the primary therefore promotes whatever
 * row now sits first, rather than leaving the person with no primary.
 */
export function normalizeContactDrafts(
  drafts: ContactMethodDraft[],
): ContactMethodDraft[] {
  const normalized: ContactMethodDraft[] = [];

  for (const kind of contactMethodKinds) {
    const ofKind = drafts
      .filter((draft) => draft.kind === kind)
      .map((draft) => ({
        ...draft,
        value: normalizeContactMethodValue(kind, draft.value).slice(
          0,
          maxContactMethodValueLength,
        ),
        label: normalizeLabel(draft.label),
      }))
      .filter((draft) => draft.value !== "")
      .slice(0, maxContactMethodsPerKind);

    const primaryIndex = ofKind.findIndex((draft) => draft.isPrimary);
    const chosen = primaryIndex === -1 ? 0 : primaryIndex;

    ofKind.forEach((draft, index) => {
      normalized.push({ ...draft, isPrimary: index === chosen });
    });
  }

  return normalized;
}

export function draftsOfKind(
  drafts: ContactMethodDraft[],
  kind: ContactMethodKind,
) {
  return drafts.filter((draft) => draft.kind === kind);
}

/** Primary first, then the rest in saved order. */
export function contactValuesOfKind(
  drafts: ContactMethodDraft[],
  kind: ContactMethodKind,
) {
  const ofKind = draftsOfKind(drafts, kind);
  return [
    ...ofKind.filter((draft) => draft.isPrimary),
    ...ofKind.filter((draft) => !draft.isPrimary),
  ];
}

export function primaryContactValue(
  drafts: ContactMethodDraft[],
  kind: ContactMethodKind,
): string | null {
  return contactValuesOfKind(drafts, kind)[0]?.value ?? null;
}

/** The three columns on `people` that mirror the primary of each kind. */
export function legacyColumnsFromDrafts(
  drafts: ContactMethodDraft[],
): LegacyContactColumns {
  return {
    phoneNumber: primaryContactValue(drafts, "phone"),
    email: primaryContactValue(drafts, "email"),
    instagramUsername: primaryContactValue(drafts, "instagram"),
  };
}

export function draftsFromContactMethods(
  methods: ContactMethod[],
): ContactMethodDraft[] {
  const ordered = [...methods].sort(
    (left, right) =>
      left.position - right.position ||
      left.createdAt.localeCompare(right.createdAt),
  );
  return normalizeContactDrafts(
    ordered.map((method) => ({
      id: method.id,
      kind: method.kind,
      value: method.value,
      label: method.label,
      isPrimary: method.isPrimary,
    })),
  );
}

export function draftsFromLegacyColumns(
  person: LegacyContactColumns,
): ContactMethodDraft[] {
  const drafts: ContactMethodDraft[] = [];
  const add = (kind: ContactMethodKind, value: string | null) => {
    if (value?.trim()) {
      drafts.push({ kind, value, label: null, isPrimary: true });
    }
  };
  add("phone", person.phoneNumber);
  add("email", person.email);
  add("instagram", person.instagramUsername);
  return normalizeContactDrafts(drafts);
}

/**
 * Every way of reaching one person, whether or not migration 0013 has run.
 * Before it runs — or for anyone whose backfill has not reached them — this is
 * the single phone, email and handle the app has always shown.
 */
export function resolveContactDrafts(
  person: LegacyContactColumns,
  stored: PersonContactMethods = unavailableContactMethods,
): ContactMethodDraft[] {
  if (!stored.available || stored.methods.length === 0) {
    return draftsFromLegacyColumns(person);
  }

  const fromTable = draftsFromContactMethods(stored.methods);
  const legacy = draftsFromLegacyColumns(person);

  // A value written straight to `people` by an older client that never learned
  // about the child table would otherwise vanish from the page.
  const missing = legacy.filter(
    (candidate) =>
      !fromTable.some(
        (existing) =>
          existing.kind === candidate.kind &&
          existing.value.toLowerCase() === candidate.value.toLowerCase(),
      ),
  );

  return missing.length === 0
    ? fromTable
    : normalizeContactDrafts([...fromTable, ...missing]);
}

/**
 * The safe way to read someone's contact rows anywhere in the app. A person
 * loaded before migration 0013 — or from the demo data — carries no list, and
 * falls back to the single phone, email and handle it has always had.
 */
export function contactDraftsOf(
  person: LegacyContactColumns & { contactMethods?: ContactMethodDraft[] },
): ContactMethodDraft[] {
  return person.contactMethods?.length
    ? person.contactMethods
    : draftsFromLegacyColumns(person);
}

/**
 * What the contact form should start with: everything saved for this person,
 * plus a blank row for any kind they have nothing for, so the common case is
 * still one box per kind with nothing to click to reveal it.
 */
export function initialContactDrafts(
  person: LegacyContactColumns & { contactMethods?: ContactMethodDraft[] },
): ContactMethodDraft[] {
  const saved = contactDraftsOf(person).map((entry) =>
    entry.kind === "phone"
      ? { ...entry, value: formatPhoneNumberInput(entry.value) }
      : entry,
  );

  const withBlanks = [...saved];
  for (const kind of contactMethodKinds) {
    if (!saved.some((entry) => entry.kind === kind)) {
      withBlanks.push({ kind, value: "", label: null, isPrimary: true });
    }
  }
  return withBlanks;
}

export function emptyContactDrafts(): ContactMethodDraft[] {
  return contactMethodKinds.map((kind) => ({
    kind,
    value: "",
    label: null,
    isPrimary: true,
  }));
}

function firstNonEmptyValue(
  drafts: ContactMethodDraft[],
  kind: ContactMethodKind,
) {
  const ofKind = drafts.filter(
    (entry) => entry.kind === kind && entry.value.trim() !== "",
  );
  return (ofKind.find((entry) => entry.isPrimary) ?? ofKind[0])?.value ?? "";
}

/**
 * The values the contact rows contribute to the surrounding form. The primary
 * of each kind keeps the field name it has always had, so nothing that reads
 * this form has to know that several are now possible.
 */
export function contactFormValues(drafts: ContactMethodDraft[]) {
  return {
    phoneNumber: firstNonEmptyValue(drafts, "phone"),
    email: firstNonEmptyValue(drafts, "email"),
    instagramUsername: firstNonEmptyValue(drafts, "instagram"),
    contactMethods: JSON.stringify(
      drafts
        .filter((entry) => entry.value.trim() !== "")
        .map(({ id, kind, value, label, isPrimary }) => ({
          id,
          kind,
          value,
          label,
          isPrimary,
        })),
    ),
  };
}

/** Rows one row can slot into, for the "add another" affordance. */
export function withAddedDraft(
  drafts: ContactMethodDraft[],
  kind: ContactMethodKind,
): ContactMethodDraft[] {
  return [...drafts, { kind, value: "", label: null, isPrimary: false }];
}

export function withPrimaryAt<T extends ContactMethodDraft>(
  drafts: T[],
  index: number,
): T[] {
  const chosen = drafts[index];
  if (!chosen) return drafts;
  return drafts.map((draft, position) =>
    draft.kind === chosen.kind
      ? { ...draft, isPrimary: position === index }
      : draft,
  );
}

/**
 * Removing the primary hands the badge to the next row of that kind, so a
 * person is never left with numbers but no primary number.
 */
export function withoutDraftAt<T extends ContactMethodDraft>(
  drafts: T[],
  index: number,
): T[] {
  const removed = drafts[index];
  if (!removed) return drafts;
  const remaining = drafts.filter((_, position) => position !== index);
  if (!removed.isPrimary) return remaining;

  let promoted = false;
  return remaining.map((draft) => {
    if (draft.kind !== removed.kind || promoted) return draft;
    promoted = true;
    return { ...draft, isPrimary: true };
  });
}

/** The form carries the list as JSON in a hidden field. */
export function parseContactDraftsJson(raw: unknown): ContactMethodDraft[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    return parseContactDrafts(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function parseContactDrafts(value: unknown): ContactMethodDraft[] {
  if (!Array.isArray(value)) return [];
  const drafts: ContactMethodDraft[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (!isContactMethodKind(row.kind)) continue;
    if (typeof row.value !== "string") continue;
    drafts.push({
      id: typeof row.id === "string" ? row.id : undefined,
      kind: row.kind,
      value: row.value,
      label: typeof row.label === "string" ? row.label : null,
      isPrimary: row.isPrimary === true,
    });
  }
  return normalizeContactDrafts(drafts);
}
