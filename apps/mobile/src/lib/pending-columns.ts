/**
 * Migrations are applied by hand, so a deploy can land before its migration
 * runs. Rather than failing every save until someone opens the SQL editor, a
 * write that names a column the database does not have yet is retried without
 * the columns that migration would add. The feature stays dark; nothing else
 * breaks.
 */

const columnsAwaitingMigration = [
  // 0008_relationship_labels.sql
  "relationship_label",
  "reminders_enabled",
  // 0009_custom_interaction_labels.sql
  "custom_label",
  "custom_icon",
  // 0012_person_slugs.sql
  "slug",
  // 0014_person_university.sql
  "university",
];

type WriteError = { code?: string; message: string };
type WriteResult<T> = { data: T | null; error: WriteError | null };

/**
 * A column the database does not have yet, as opposed to a network drop or a
 * row the reader is not allowed to see. Only the first is safe to treat as "the
 * feature is dark"; the other two have to be errors, because reading them as an
 * absence makes the caller act on data that was never fetched.
 */
export function isMissingColumn(error: WriteError | null) {
  return Boolean(error && ["42703", "PGRST204"].includes(error.code ?? ""));
}

export function droppingPendingColumns(row: Record<string, unknown>) {
  const trimmed: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) {
    if (!columnsAwaitingMigration.includes(column)) trimmed[column] = value;
  }
  return trimmed;
}

export async function writeTolerantOfPendingColumns<T>(
  row: Record<string, unknown>,
  write: (row: Record<string, unknown>) => PromiseLike<WriteResult<T>>,
): Promise<WriteResult<T>> {
  const result = await write(row);
  if (!isMissingColumn(result.error)) return result;

  const trimmed = droppingPendingColumns(row);
  if (Object.keys(trimmed).length === Object.keys(row).length) return result;
  return write(trimmed);
}
