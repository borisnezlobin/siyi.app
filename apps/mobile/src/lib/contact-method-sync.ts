import {
  contactMethodKinds,
  isContactMethodKind,
  normalizeContactDrafts,
  type ContactMethodDraft,
  type ContactMethodKind,
} from "@/lib/contact-methods";

/** One row of person_contact_methods as it comes back from the server. */
export type StoredContactMethodRow = {
  id: string;
  kind: string;
  value: string;
  label: string | null;
  position: number;
  is_primary: boolean;
};

export type ContactMethodWrite = {
  id: string;
  user_id: string;
  person_id: string;
  kind: ContactMethodKind;
  value: string;
  label: string | null;
  position: number;
  is_primary: boolean;
};

export type ContactMethodPlan = {
  upserts: ContactMethodWrite[];
  deleteIds: string[];
};

function sameValue(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/**
 * What to write when a contact edit made on the phone finally reaches the
 * server, given whatever is there by then.
 *
 * The phone only ever deletes rows it knew about when the form was opened, so
 * a number added on the web while the phone was offline survives the replay.
 * Those unknown rows keep their values and move below the ones edited here.
 *
 * A row counts as known either by id or by the value the form opened with.
 * The second case matters before migration 0013 has run: the form then has no
 * row ids at all, and the backfill would otherwise hand back a number the
 * person had already deleted here.
 *
 * The one unknown row that does get dropped is one holding a value this edit
 * already carries, because that removes a duplicate rather than a value.
 */
export function planContactMethodRows({
  userId,
  personId,
  drafts,
  knownIds,
  knownValues = [],
  existingRows,
  newId,
}: {
  userId: string;
  personId: string;
  drafts: ContactMethodDraft[];
  knownIds: string[];
  knownValues?: { kind: ContactMethodKind; value: string }[];
  existingRows: StoredContactMethodRow[];
  newId: () => string;
}): ContactMethodPlan {
  const normalized = normalizeContactDrafts(drafts);
  const known = new Set(knownIds);
  const knownValueKeys = new Set(
    knownValues.map(
      (entry) => `${entry.kind}:${entry.value.trim().toLowerCase()}`,
    ),
  );
  const remoteIds = new Set(existingRows.map((row) => row.id));
  const claimedIds = new Set<string>();
  const upserts: ContactMethodWrite[] = [];
  const deleteIds: string[] = [];

  for (const kind of contactMethodKinds) {
    const ours = normalized.filter((draft) => draft.kind === kind);
    const theirs = existingRows.filter(
      (row) => isContactMethodKind(row.kind) && row.kind === kind,
    );

    ours.forEach((draft) => {
      const id =
        draft.id && remoteIds.has(draft.id) ? draft.id : newId();
      claimedIds.add(id);
      upserts.push({
        id,
        user_id: userId,
        person_id: personId,
        kind,
        value: draft.value,
        label: draft.label,
        position: upsertsOfKind(upserts, kind).length,
        is_primary: draft.isPrimary,
      });
    });

    for (const row of theirs) {
      if (claimedIds.has(row.id)) continue;
      if (
        known.has(row.id) ||
        knownValueKeys.has(`${kind}:${row.value.trim().toLowerCase()}`)
      ) {
        // The phone had this row on screen and the person removed it.
        deleteIds.push(row.id);
        continue;
      }
      if (ours.some((draft) => sameValue(draft.value, row.value))) {
        // Added elsewhere, but this edit already carries the same value.
        deleteIds.push(row.id);
        continue;
      }
      upserts.push({
        id: row.id,
        user_id: userId,
        person_id: personId,
        kind,
        value: row.value,
        label: row.label,
        position: upsertsOfKind(upserts, kind).length,
        is_primary: ours.length === 0 && !upsertsOfKind(upserts, kind).length,
      });
    }
  }

  return { upserts, deleteIds };
}

function upsertsOfKind(upserts: ContactMethodWrite[], kind: ContactMethodKind) {
  return upserts.filter((row) => row.kind === kind);
}
