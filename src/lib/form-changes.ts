export type FormValues = Record<string, string>;

export function changedFieldNames(
  initial: FormValues,
  current: FormValues,
): string[] {
  const fieldNames = new Set([
    ...Object.keys(initial),
    ...Object.keys(current),
  ]);
  return [...fieldNames].filter(
    (name) => (initial[name] ?? "").trim() !== (current[name] ?? "").trim(),
  );
}

export function hasUnsavedChanges(initial: FormValues, current: FormValues) {
  return changedFieldNames(initial, current).length > 0;
}
