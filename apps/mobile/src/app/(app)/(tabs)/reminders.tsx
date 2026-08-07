import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Check, ClockCountdown, MagnifyingGlass } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { colors, fontFamilies, radii } from "@/constants/theme";
import { getReminders, setReminderComplete } from "@/lib/data";
import {
  countsByBucket,
  reminderBucketEmptyLabels,
  reminderBucketLabels,
  reminderBucketOrder,
  reminderDueLabel,
  groupRemindersByBucket,
  type ReminderBucket,
} from "@/lib/reminder-buckets";
import type { Reminder } from "@/lib/types";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useQuickCapture } from "@/providers/quick-capture-provider";

export default function RemindersScreen() {
  const router = useRouter();
  const quickCapture = useQuickCapture();
  const screenData = useRefreshableData(getReminders);
  const [query, setQuery] = useState("");
  const [focusedBucket, setFocusedBucket] = useState<ReminderBucket | null>(
    null,
  );
  const [showCompleted, setShowCompleted] = useState(false);

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
    const bucketed = groupRemindersByBucket(visible);
    return { ...bucketed, counts: countsByBucket(bucketed.groups) };
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

      <View style={styles.search}>
        <MagnifyingGlass color={colors.inkMuted} size={18} />
        <TextInput
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

      {openTotal === 0 && !showCompleted ? (
        <View style={styles.empty}>
          <ClockCountdown color={colors.inkMuted} size={28} />
          <AppText variant="heading">
            {(screenData.data || []).length === 0
              ? "No reminders yet"
              : "Nothing is waiting"}
          </AppText>
          <AppText style={styles.emptyBody}>
            {(screenData.data || []).length === 0
              ? "Use the coral plus button to attach a thoughtful next step to someone."
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
                  onToggle={() => void toggleComplete(reminder)}
                  overdue={bucket === "overdue"}
                />
              ))
            )}
          </View>
        ))
      )}

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

      {showCompleted ? (
        <View style={styles.section}>
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
                onToggle={() => void toggleComplete(reminder)}
              />
            ))
          )}
        </View>
      ) : null}

      <Button
        icon={ClockCountdown}
        label="Add a reminder"
        onPress={() => quickCapture.addReminder()}
      />
    </Screen>
  );
}

function ReminderRow({
  reminder,
  onOpen,
  onToggle,
  overdue = false,
}: {
  reminder: Reminder;
  onOpen: () => void;
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
          {done ? "" : ` · ${reminderDueLabel(reminder.dueAt)}`}
        </AppText>
      </View>
      <Pressable
        accessibilityLabel={done ? "Mark as open" : "Mark complete"}
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
  search: {
    alignItems: "center",
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
    alignSelf: "flex-start",
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
