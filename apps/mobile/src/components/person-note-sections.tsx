import * as Haptics from "expo-haptics";
import { ArrowDown, ArrowUp, Check, Plus, Trash } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { FormField } from "@/components/form-field";
import { colors, radii } from "@/constants/theme";
import {
  createPersonNote,
  deletePersonNote,
  movePersonNote,
  savePersonNote,
} from "@/lib/data";
import {
  maxNoteBodyLength,
  maxNoteHeadingLength,
  maxNoteSectionsPerPerson,
  normalizeNoteHeading,
  orderedNoteSections,
  suggestedNoteHeadings,
} from "@/lib/note-sections";
import type { PersonNote } from "@/lib/types";

type Draft = { heading: string; body: string };

/**
 * The named blocks of notes on one person: add, rename, reorder and delete.
 * Every action goes through the offline queue, so this works with no signal
 * and catches up on its own.
 */
export function PersonNoteSections({
  userId,
  personId,
  available,
  initialSections,
  headingsUsedElsewhere,
}: {
  userId: string;
  personId: string;
  available: boolean;
  initialSections: PersonNote[];
  headingsUsedElsewhere: string[];
}) {
  const [sections, setSections] = useState(() =>
    orderedNoteSections(initialSections),
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      initialSections.map((section) => [
        section.id,
        { heading: section.heading, body: section.body },
      ]),
    ),
  );
  const [newHeading, setNewHeading] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const suggestions = useMemo(
    () =>
      suggestedNoteHeadings({
        previouslyUsed: headingsUsedElsewhere,
        alreadyOnThisPerson: sections.map((section) => section.heading),
      }),
    [headingsUsedElsewhere, sections],
  );

  if (!available) return null;

  function draftFor(section: PersonNote): Draft {
    return (
      drafts[section.id] ?? { heading: section.heading, body: section.body }
    );
  }

  function isDirty(section: PersonNote) {
    const draft = draftFor(section);
    return (
      normalizeNoteHeading(draft.heading) !== section.heading ||
      draft.body !== section.body
    );
  }

  function updateDraft(sectionId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [sectionId]: { ...current[sectionId], ...patch },
    }));
  }

  async function addSection(heading: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await createPersonNote(userId, personId, heading);
      setSections((current) => orderedNoteSections([...current, created]));
      setDrafts((current) => ({
        ...current,
        [created.id]: { heading: created.heading, body: created.body },
      }));
      setNewHeading("");
      void Haptics.selectionAsync();
    } catch (addError) {
      setError(
        addError instanceof Error
          ? addError.message
          : "That section was not added.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveSection(section: PersonNote) {
    const draft = draftFor(section);
    setBusy(true);
    setError("");
    try {
      await savePersonNote(userId, section, draft);
      const heading = normalizeNoteHeading(draft.heading);
      setSections((current) =>
        current.map((existing) =>
          existing.id === section.id
            ? { ...existing, heading, body: draft.body }
            : existing,
        ),
      );
      updateDraft(section.id, { heading });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "That section was not saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function move(section: PersonNote, direction: "up" | "down") {
    setError("");
    const reordered = await movePersonNote(userId, section, direction);
    setSections(reordered);
    void Haptics.selectionAsync();
  }

  function requestDelete(section: PersonNote) {
    Alert.alert(
      "Delete this section?",
      `“${section.heading}” and everything written under it will be gone for good.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deletePersonNote(userId, section).then(() => {
              setSections((current) =>
                current.filter((existing) => existing.id !== section.id),
              );
            });
          },
        },
      ],
    );
  }

  const atSectionLimit = sections.length >= maxNoteSectionsPerPerson;

  return (
    <View style={styles.group}>
      {sections.map((section, index) => {
        const draft = draftFor(section);

        return (
          <View key={section.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.headingField}>
                <FormField
                  label="Section heading"
                  maxLength={maxNoteHeadingLength}
                  onChangeText={(heading) =>
                    updateDraft(section.id, { heading })
                  }
                  value={draft.heading}
                />
              </View>
              <Pressable
                accessibilityLabel={`Move ${section.heading} up`}
                accessibilityRole="button"
                disabled={index === 0}
                onPress={() => void move(section, "up")}
                style={[styles.iconButton, index === 0 && styles.disabled]}
              >
                <ArrowUp color={colors.inkMuted} size={16} />
              </Pressable>
              <Pressable
                accessibilityLabel={`Move ${section.heading} down`}
                accessibilityRole="button"
                disabled={index === sections.length - 1}
                onPress={() => void move(section, "down")}
                style={[
                  styles.iconButton,
                  index === sections.length - 1 && styles.disabled,
                ]}
              >
                <ArrowDown color={colors.inkMuted} size={16} />
              </Pressable>
              <Pressable
                accessibilityLabel={`Delete ${section.heading}`}
                accessibilityRole="button"
                onPress={() => requestDelete(section)}
                style={styles.iconButton}
              >
                <Trash color={colors.coralStrong} size={16} />
              </Pressable>
            </View>

            <FormField
              autoCapitalize="sentences"
              label={`${section.heading} notes`}
              maxLength={maxNoteBodyLength}
              multiline
              onChangeText={(body) => updateDraft(section.id, { body })}
              placeholder="What belongs under this heading?"
              value={draft.body}
            />

            {isDirty(section) ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void saveSection(section)}
                style={styles.saveButton}
              >
                <Check color={colors.paper} size={14} weight="bold" />
                <AppText style={styles.saveLabel} variant="caption">
                  Save section
                </AppText>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {atSectionLimit ? (
        <AppText variant="caption">
          That is as many sections as one person can hold.
        </AppText>
      ) : (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.headingField}>
              <FormField
                label="New section"
                maxLength={maxNoteHeadingLength}
                onChangeText={setNewHeading}
                placeholder="New heading, like Interests"
                value={newHeading}
              />
            </View>
            <Pressable
              accessibilityLabel="Add section"
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void addSection(newHeading)}
              style={styles.addButton}
            >
              <Plus color={colors.paper} size={16} weight="bold" />
            </Pressable>
          </View>

          {suggestions.length > 0 ? (
            <View style={styles.suggestions}>
              <AppText variant="caption">
                Headings you use on other people
              </AppText>
              <View style={styles.suggestionRow}>
                {suggestions.map((heading) => (
                  <Pressable
                    accessibilityRole="button"
                    key={heading}
                    onPress={() => void addSection(heading)}
                    style={styles.suggestion}
                  >
                    <AppText variant="caption">{heading}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}

      {error ? (
        <View style={styles.error}>
          <AppText style={styles.errorText} variant="caption">
            {error}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 14,
  },
  section: {
    backgroundColor: colors.porcelain,
    borderRadius: radii.medium,
    gap: 12,
    padding: 14,
  },
  sectionHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
  },
  headingField: {
    flex: 1,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
    height: 52,
    justifyContent: "center",
    width: 44,
  },
  disabled: {
    opacity: 0.4,
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.coral,
    borderRadius: radii.medium,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  saveButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.ink,
    borderRadius: radii.round,
    flexDirection: "row",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 15,
  },
  saveLabel: {
    color: colors.paper,
  },
  suggestions: {
    gap: 8,
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestion: {
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 13,
  },
  error: {
    backgroundColor: colors.coralSoft,
    borderRadius: radii.medium,
    padding: 13,
  },
  errorText: {
    color: colors.coralStrong,
  },
});
