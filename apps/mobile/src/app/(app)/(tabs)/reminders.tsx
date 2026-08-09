import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Bell, Check, MagnifyingGlass, NotePencil } from "phosphor-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { RevealingTextInput } from "@/components/focus-scroll";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { colors, fontFamilies, radii } from "@/constants/theme";
import { getReminders, setReminderComplete } from "@/lib/data";
import {
  countsByBucket,
  reminderBucketEmptyLabels,
  reminderBucketLabels,
  reminderBucketOrder,
  groupRemindersByBucket,
  type ReminderBucket,
} from "@/lib/reminder-buckets";
import { dueDateLabel } from "@/lib/relative-time";
import type { Reminder } from "@/lib/types";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useQuickCapture } from "@/providers/quick-capture-provider";

export default function RemindersScreen() {
  const router = useRouter();
  const quickCapture = useQuickCapture();
  const screenData = useRefreshableData(getReminders);
  // A person page links here for one person, which arrives as a filled-in
  // search rather than a second, phone-only filter control.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(q ?? "");
  const [focusedBucket, setFocusedBucket] = useState<ReminderBucket | null>(
    null,
  );
  const [showCompleted, setShowCompleted] = useState(false);

  // A reminder completed in this session keeps its place in the list so it
  // never jumps out from under the tap that completed it.
  const settledIds = useRef(new Set<string>());

  useEffect(() => {
    if (q) setQuery(q);
  }, [q]);

  useEffect(() => {
    if (quickCapture.revision > 0) void screenData.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCapture.revision]);

  const { groups, completed, counts } = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visible = (screenData.data || []).filter((reminder) =>
      [
        reminder.text,
        reminder.person?.fullName,
        reminder.person?.preferredName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
    const stayingInPlace = visible.filter(
      (reminder) => !reminder.completedAt || settledIds.current.has(reminder.id),
    );
    const bucketed = groupRemindersByBucket(
      stayingInPlace.map((reminder) => ({ ...reminder, completedAt: null })),
    );
    const byId = new Map(visible.map((reminder) => [reminder.id, reminder]));
    const restored = {} as Record<ReminderBucket, Reminder[]>;
    for (const bucket of reminderBucketOrder) {
      restored[bucket] = bucketed.groups[bucket].map(
        (reminder) => byId.get(reminder.id)!,
      );
    }
    return {
      groups: restored,
      completed: visible.filter(
        (reminder) =>
          reminder.completedAt && !settledIds.current.has(reminder.id),
      ),
      counts: countsByBucket({
        overdue: restored.overdue.filter((item) => !item.completedAt),
        today: restored.today.filter((item) => !item.completedAt),
        week: restored.week.filter((item) => !item.completedAt),
        later: restored.later.filter((item) => !item.completedAt),
      }),
    };
  }, [query, screenData.data]);

  if (screenData.loading && !screenData.data) {
    return <LoadingState label="Gathering your reminders…" />;
  }
  if (screenData.error && !screenData.data) {
    return (
      <ErrorState
        message={screenData.error}
        onRetry={() => void screenData.reload()}
      />
    );
  }

  async function toggleComplete(reminder: Reminder) {
    try {
      settledIds.current.add(reminder.id);
      await setReminderComplete(reminder.id, !reminder.completedAt);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await screenData.reload();
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  const shownBuckets = focusedBucket ? [focusedBucket] : reminderBucketOrder;
  const openTotal = reminderBucketOrder.reduce(
    (total, bucket) => total + counts[bucket],
    0,
  );

  return (
    <Screen
      onRefresh={() => void screenData.refresh()}
      refreshing={screenData.refreshing}
      subtitle="What is coming up, and when it lands."
      title="Reminders"
    >
      <View style={styles.distribution}>
        {reminderBucketOrder.map((bucket, index) => {
          const focused = focusedBucket === bucket;
          return (
            <Pressable
              accessibilityHint="Shows only this part of the list"
              accessibilityLabel={`${reminderBucketLabels[bucket]}: ${counts[bucket]}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={bucket}
              onPress={() => {
                setFocusedBucket(focused ? null : bucket);
                void Haptics.selectionAsync();
              }}
              style={[
                styles.distributionCell,
                index > 0 && styles.distributionDivider,
                focused && styles.distributionCellFocused,
              ]}
            >
              <AppText
                style={[
                  styles.distributionCount,
                  counts[bucket] === 0 && styles.distributionCountEmpty,
                  bucket === "overdue" &&
                    counts[bucket] > 0 &&
                    styles.overdueText,
                ]}
              >
                {counts[bucket]}
              </AppText>
              <AppText style={styles.distributionLabel} variant="caption">
                {reminderBucketLabels[bucket]}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.filters}>
        <View style={styles.search}>
          <MagnifyingGlass color={colors.inkMuted} size={18} />
          <RevealingTextInput
            accessibilityLabel="Filter reminders"
            onChangeText={setQuery}
            onSubmitEditing={() => Keyboard.dismiss()}
            placeholder="Person or reminder"
            placeholderTextColor={colors.inkMuted}
            returnKeyType="search"
            selectionColor={colors.coral}
            style={styles.searchInput}
            value={query}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showCompleted }}
          onPress={() => setShowCompleted((value) => !value)}
          style={styles.doneToggle}
        >
          <AppText style={styles.doneToggleText} variant="label">
            {showCompleted ? "Hide done" : `Done (${completed.length})`}
          </AppText>
        </Pressable>
      </View>

      {openTotal === 0 && !showCompleted ? (
        <View style={styles.empty}>
          <Bell color={colors.inkMuted} size={28} />
          <AppText variant="heading">
            {(screenData.data || []).length === 0
              ? "No reminders yet"
              : "Nothing is waiting"}
          </AppText>
          <AppText style={styles.emptyBody}>
            {(screenData.data || []).length === 0
              ? "Add a reminder and it will show up here."
              : "Everything here is either done or filtered out."}
          </AppText>
        </View>
      ) : (
        shownBuckets.map((bucket) => (
          <View key={bucket} style={styles.section}>
            <View style={styles.sectionHeading}>
              <AppText
                style={
                  bucket === "overdue" && counts[bucket] > 0
                    ? styles.overdueText
                    : undefined
                }
                variant="heading"
              >
                {reminderBucketLabels[bucket]}
              </AppText>
              <AppText style={styles.sectionCount} variant="caption">
                {counts[bucket]}
              </AppText>
            </View>
            {groups[bucket].length === 0 ? (
              <AppText style={styles.sectionEmpty} variant="caption">
                {reminderBucketEmptyLabels[bucket]}
              </AppText>
            ) : (
              groups[bucket].map((reminder) => (
                <ReminderRow
                  reminder={reminder}
                  key={reminder.id}
                  onOpen={() => router.push(`/people/${reminder.personId}`)}
                  onEdit={() => quickCapture.editReminder(reminder)}
                  onToggle={() => void toggleComplete(reminder)}
                  overdue={bucket === "overdue"}
                />
              ))
            )}
          </View>
        ))
      )}

      {showCompleted ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <AppText variant="heading">Done</AppText>
            <AppText style={styles.sectionCount} variant="caption">
              {completed.length}
            </AppText>
          </View>
          {completed.length === 0 ? (
            <AppText style={styles.sectionEmpty} variant="caption">
              Nothing finished yet.
            </AppText>
          ) : (
            completed.map((reminder) => (
              <ReminderRow
                reminder={reminder}
                key={reminder.id}
                onOpen={() => router.push(`/people/${reminder.personId}`)}
                onEdit={() => quickCapture.editReminder(reminder)}
                onToggle={() => void toggleComplete(reminder)}
              />
            ))
          )}
        </View>
      ) : null}

      <Button
        icon={Bell}
        label="Add a reminder"
        onPress={() => quickCapture.addReminder()}
      />
    </Screen>
  );
}

function ReminderRow({
  reminder,
  onOpen,
  onEdit,
  onToggle,
  overdue = false,
}: {
  reminder: Reminder;
  onOpen: () => void;
  onEdit: () => void;
  onToggle: () => void;
  overdue?: boolean;
}) {
  const done = Boolean(reminder.completedAt);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Avatar
        name={reminder.person?.fullName || "Someone"}
        size={40}
        uri={reminder.person?.profilePhotoUrl}
      />
      <View style={styles.rowCopy}>
        <AppText
          numberOfLines={2}
          style={done ? styles.doneText : undefined}
          variant="label"
        >
          {reminder.text}
        </AppText>
        <AppText numberOfLines={1} variant="caption">
          {reminder.person?.preferredName ||
            reminder.person?.fullName ||
            "Someone"}
          {done ? "" : ` · ${dueDateLabel(reminder.dueAt)}`}
        </AppText>
      </View>
      <Pressable
        accessibilityLabel={`Edit “${reminder.text}”`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={(event) => {
          event.stopPropagation();
          onEdit();
        }}
        style={styles.rowAction}
      >
        <NotePencil color={colors.inkMuted} size={18} />
      </Pressable>
      <Pressable
        accessibilityLabel={
          done
            ? `Mark “${reminder.text}” incomplete`
            : `Mark “${reminder.text}” complete`
        }
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        hitSlop={10}
        onPress={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        style={[styles.check, done && styles.checkDone]}
      >
        <Check
          color={done ? colors.paper : overdue ? colors.coralStrong : colors.inkMuted}
          size={17}
          weight="bold"
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  distribution: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.mist,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
  distributionCell: {
    flex: 1,
    gap: 3,
    paddingBottom: 14,
    paddingTop: 14,
  },
  distributionDivider: {
    borderLeftColor: colors.mist,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
  },
  distributionCellFocused: {
    borderBottomColor: colors.ink,
    borderBottomWidth: 2,
  },
  distributionCount: {
    color: colors.ink,
    fontFamily: fontFamilies.display,
    fontSize: 30,
    letterSpacing: -1,
    lineHeight: 32,
  },
  distributionCountEmpty: {
    color: colors.inkMuted,
    opacity: 0.5,
  },
  distributionLabel: {
    fontFamily: fontFamilies.bodySemibold,
  },
  overdueText: {
    color: colors.coralStrong,
  },
  filters: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  search: {
    alignItems: "center",
    flex: 1,
    backgroundColor: colors.paper,
    borderColor: colors.mist,
    borderRadius: radii.medium,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 15,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 15,
  },
  section: {
    gap: 2,
  },
  sectionHeading: {
    alignItems: "baseline",
    borderBottomColor: colors.mist,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 7,
  },
  sectionCount: {
    fontFamily: fontFamilies.bodySemibold,
  },
  sectionEmpty: {
    paddingVertical: 14,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.mist,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowAction: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  doneText: {
    color: colors.inkMuted,
    textDecorationLine: "line-through",
  },
  check: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  checkDone: {
    backgroundColor: colors.sageStrong,
  },
  doneToggle: {
    paddingVertical: 4,
  },
  doneToggleText: {
    color: colors.inkMuted,
    textDecorationLine: "underline",
  },
  empty: {
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 28,
  },
  emptyBody: {
    color: colors.inkMuted,
    maxWidth: 340,
  },
});
