import type { SupabaseClient } from "@supabase/supabase-js";
import {
  contactMethodKinds,
  normalizeContactDrafts,
  type ContactMethodDraft,
} from "@/lib/contact-methods";

type WriteError = { code?: string; message: string };

/** Migration 0013 may not have been applied yet; the app carries on with the
 * single columns on `people` until it has. */
function isMissingContactMethodsTable(error: WriteError | null) {
  return Boolean(
    error &&
      ["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code ?? ""),
  );
}

type ContactMethodRow = {
  id: string;
  user_id: string;
  person_id: string;
  kind: string;
  value: string;
  label: string | null;
  position: number;
  is_primary: boolean;
};

/** Only the table access this file needs, so a test can stand in a small fake. */
export type ContactMethodsClient = Pick<SupabaseClient, "from">;

function rowsFromDrafts(
  userId: string,
  personId: string,
  drafts: ContactMethodDraft[],
  existingIds: Set<string>,
): ContactMethodRow[] {
  const rows: ContactMethodRow[] = [];
  for (const kind of contactMethodKinds) {
    drafts
      .filter((draft) => draft.kind === kind)
      .forEach((draft, position) => {
        rows.push({
          // Reusing the id an existing row already has keeps created_at, so the
          // list does not reshuffle every time the person is saved.
          id:
            draft.id && existingIds.has(draft.id)
              ? draft.id
              : crypto.randomUUID(),
          user_id: userId,
          person_id: personId,
          kind,
          value: draft.value,
          label: draft.label,
          position,
          is_primary: draft.isPrimary,
        });
      });
  }
  return rows;
}

export type SaveContactMethodsResult = { available: boolean; error?: string };

/**
 * Replaces the whole set of contact rows for one person. Rows the person
 * removed in the form are deleted; everything else keeps its id. Reports
 * `available: false`, and changes nothing, until migration 0013 has run.
 */
export async function saveContactMethods(
  supabase: ContactMethodsClient,
  userId: string,
  personId: string,
  drafts: ContactMethodDraft[],
): Promise<SaveContactMethodsResult> {
  const normalized = normalizeContactDrafts(drafts);

  const existing = await supabase
    .from("person_contact_methods")
    .select("id")
    .eq("person_id", personId);

  if (existing.error) {
    if (isMissingContactMethodsTable(existing.error)) return { available: false };
    return { available: true, error: existing.error.message };
  }

  const existingIds = new Set((existing.data ?? []).map((row) => row.id));
  const rows = rowsFromDrafts(userId, personId, normalized, existingIds);

  if (rows.length > 0) {
    const upserted = await supabase
      .from("person_contact_methods")
      .upsert(rows, { onConflict: "id" });
    if (upserted.error) {
      if (isMissingContactMethodsTable(upserted.error)) {
        return { available: false };
      }
      return { available: true, error: upserted.error.message };
    }
  }

  const keptIds = new Set(rows.map((row) => row.id));
  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
  if (removedIds.length > 0) {
    const removed = await supabase
      .from("person_contact_methods")
      .delete()
      .eq("person_id", personId)
      .in("id", removedIds);
    if (removed.error) return { available: true, error: removed.error.message };
  }

  return { available: true };
}
