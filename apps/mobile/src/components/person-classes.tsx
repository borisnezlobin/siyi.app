import { Plus, X } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import { colors, radii } from "@/constants/theme";
import type { PersonClass } from "@/lib/classes";
import { addClass, removeClass } from "@/lib/classes-data";

const emptyDraft = { courseCode: "", professor: "" };

/**
 * The classes somebody is taking. Same shape as the web editor so the two apps
 * do not drift: a course, who teaches it, which days and when.
 */
export function PersonClasses({
  personId,
  userId,
  classes,
  onChanged,
}: {
  personId: string;
  userId: string;
  classes: PersonClass[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  async function save() {
    if (!draft.courseCode.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addClass(userId, {
        personId,
        courseCode: draft.courseCode,
        courseTitle: null,
        professor: draft.professor || null,
        term: null,
        days: null,
        startsAt: null,
        endsAt: null,
        location: null,
      });
      setDraft(emptyDraft);
      setAdding(false);
      onChanged();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "That class could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.group}>
      {classes.length === 0 ? (
        <AppText variant="caption">No classes saved yet.</AppText>
      ) : (
        classes.map((entry) => (
          <View key={entry.id} style={styles.row}>
            <View style={styles.rowBody}>
              <AppText variant="body">
                {entry.courseCode}
              </AppText>
              <AppText variant="caption">
                {entry.professor ?? "No professor saved"}
              </AppText>
            </View>
            <Pressable
              accessibilityLabel={`Remove ${entry.courseCode}`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                void removeClass(userId, entry.id).then(onChanged);
              }}
            >
              <X color={colors.inkMuted} size={16} weight="bold" />
            </Pressable>
          </View>
        ))
      )}

      {adding ? (
        <View style={styles.form}>
          <FormField
            label="Course"
            onChangeText={(value) => setDraft({ ...draft, courseCode: value })}
            placeholder="DATA 8"
            value={draft.courseCode}
          />
          <FormField
            label="Professor"
            onChangeText={(value) => setDraft({ ...draft, professor: value })}
            placeholder="DeNero"
            value={draft.professor}
          />

          {error ? (
            <AppText style={styles.error} variant="caption">
              {error}
            </AppText>
          ) : null}

          <Button
            disabled={saving || !draft.courseCode.trim()}
            label="Add class"
            onPress={() => void save()}
          />
          <Button
            label="Cancel"
            onPress={() => setAdding(false)}
            variant="secondary"
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setAdding(true)}
          style={styles.addRow}
        >
          <Plus color={colors.coralStrong} size={14} weight="bold" />
          <AppText style={styles.addLabel} variant="caption">
            Add a class
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 9,
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.porcelain,
    borderRadius: radii.medium,
    flexDirection: "row",
    gap: 12,
    padding: 13,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  form: {
    // Deliberately flat: this sits inside a card already, and a card within a
    // card reads as clutter.
    borderTopColor: colors.mist,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
    paddingTop: 14,
  },
  addRow: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    minHeight: 32,
  },
  addLabel: {
    color: colors.coralStrong,
  },
  error: {
    color: colors.coralStrong,
  },
});
