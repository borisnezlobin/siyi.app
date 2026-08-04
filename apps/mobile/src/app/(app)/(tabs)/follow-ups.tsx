import * as Haptics from "expo-haptics";
import {
  CalendarCheck,
  Check,
  CheckCircle,
  Funnel,
} from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { EmptyState, PressableCard, SectionHeading } from "@/components/surface";
import { colors, fontFamilies, radii } from "@/constants/theme";
import { getFollowUps, setFollowUpComplete } from "@/lib/data";
import { relativeDayLabel } from "@/lib/date-labels";
import type { FollowUp } from "@/lib/types";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useQuickCapture } from "@/providers/quick-capture-provider";

type StatusFilter = "open" | "completed" | "all";

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export default function FollowUpsScreen() {
  const router = useRouter();
  const quickCapture = useQuickCapture();
  const screenData = useRefreshableData(getFollowUps);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("open");

  useEffect(() => {
    if (quickCapture.revision > 0) void screenData.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCapture.revision]);

  const grouped = useMemo(() => {
    const now = new Date();
    const normalized = query.trim().toLowerCase();
    const visible = (screenData.data || []).filter((followUp) => {
      const completed = Boolean(followUp.completedAt);
      if (filter === "open" && completed) return false;
      if (filter === "completed" && !completed) return false;
      return [followUp.text, followUp.person?.fullName, followUp.person?.preferredName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });

    return {
      overdue: visible.filter(
        (item) =>
          !item.completedAt &&
          new Date(item.dueAt).getTime() < now.getTime() &&
          !isSameLocalDay(new Date(item.dueAt), now),
      ),
      today: visible.filter(
        (item) => !item.completedAt && isSameLocalDay(new Date(item.dueAt), now),
      ),
      upcoming: visible.filter(
        (item) =>
          !item.completedAt &&
          new Date(item.dueAt).getTime() >= now.getTime() &&
          !isSameLocalDay(new Date(item.dueAt), now),
      ),
      completed: visible.filter((item) => Boolean(item.completedAt)),
    };
  }, [filter, query, screenData.data]);

  if (screenData.loading && !screenData.data) {
    return <LoadingState label="Gathering your follow-ups…" />;
  }
  if (screenData.error && !screenData.data) {
    return (
      <ErrorState
        message={screenData.error}
        onRetry={() => void screenData.reload()}
      />
    );
  }

  async function toggleComplete(followUp: FollowUp) {
    try {
      await setFollowUpComplete(followUp.id, !followUp.completedAt);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      await screenData.reload();
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  const groups = [
    { key: "overdue", title: "Overdue", items: grouped.overdue },
    { key: "today", title: "Due today", items: grouped.today },
    { key: "upcoming", title: "Upcoming", items: grouped.upcoming },
    { key: "completed", title: "Completed", items: grouped.completed },
  ];
  const totalVisible = groups.reduce(
    (total, group) => total + group.items.length,
    0,
  );

  return (
    <Screen
      eyebrow="Promises to your future self"
      onRefresh={() => void screenData.refresh()}
      refreshing={screenData.refreshing}
      subtitle="Overdue items come first. Completing one is always a single tap."
      title="Follow-ups"
    >
      <View style={styles.controls}>
        <View style={styles.search}>
          <Funnel color={colors.inkMuted} size={19} />
          <TextInput
            accessibilityLabel="Filter follow-ups"
            onChangeText={setQuery}
            placeholder="Person or follow-up"
            placeholderTextColor={colors.inkMuted}
            selectionColor={colors.coral}
            style={styles.searchInput}
            value={query}
          />
        </View>
        <View style={styles.filters}>
          {(["open", "completed", "all"] as const).map((value) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: filter === value }}
              key={value}
              onPress={() => setFilter(value)}
              style={[
                styles.filter,
                filter === value && styles.filterSelected,
              ]}
            >
              <AppText
                style={filter === value ? styles.filterTextSelected : undefined}
                variant="caption"
              >
                {value === "open"
                  ? "Open"
                  : value === "completed"
                    ? "Completed"
                    : "All"}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {totalVisible === 0 ? (
        <EmptyState
          body={
            screenData.data!.length === 0
              ? "Use the coral plus button to attach a thoughtful next step to someone."
              : "Nothing matches this filter."
          }
          icon={filter === "completed" ? CheckCircle : CalendarCheck}
          title={
            screenData.data!.length === 0
              ? "No follow-ups yet"
              : "All clear here"
          }
        />
      ) : (
        groups.map((group) =>
          group.items.length > 0 ? (
            <View key={group.key} style={styles.section}>
              <SectionHeading
                detail={`${group.items.length}`}
                title={group.title}
              />
              <View style={styles.list}>
                {group.items.map((followUp) => (
                  <PressableCard
                    key={followUp.id}
                    onPress={() =>
                      router.push(`/people/${followUp.personId}`)
                    }
                    style={[
                      styles.row,
                      group.key === "overdue" && styles.overdueRow,
                    ]}
                  >
                    <Avatar
                      name={followUp.person?.fullName || "Someone"}
                      size={46}
                      uri={followUp.person?.profilePhotoUrl}
                    />
                    <View style={styles.copy}>
                      <AppText numberOfLines={2} variant="label">
                        {followUp.text}
                      </AppText>
                      <AppText
                        style={
                          group.key === "overdue"
                            ? styles.overdueText
                            : undefined
                        }
                        variant="caption"
                      >
                        {followUp.person?.preferredName ||
                          followUp.person?.fullName ||
                          "Someone"}{" "}
                        · {relativeDayLabel(followUp.dueAt)}
                      </AppText>
                    </View>
                    <Pressable
                      accessibilityLabel={
                        followUp.completedAt
                          ? "Mark as open"
                          : "Mark complete"
                      }
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: Boolean(followUp.completedAt),
                      }}
                      onPress={(event) => {
                        event.stopPropagation();
                        void toggleComplete(followUp);
                      }}
                      style={[
                        styles.checkbox,
                        followUp.completedAt && styles.checkboxCompleted,
                      ]}
                    >
                      <Check
                        color={
                          followUp.completedAt
                            ? colors.paper
                            : colors.sageStrong
                        }
                        size={19}
                        weight="bold"
                      />
                    </Pressable>
                  </PressableCard>
                ))}
              </View>
            </View>
          ) : null,
        )
      )}

      <Button
        icon={CalendarCheck}
        label="Add a follow-up"
        onPress={() => quickCapture.addFollowUp()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: 10,
  },
  search: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.mist,
    borderRadius: radii.medium,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 52,
    paddingHorizontal: 15,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 15,
  },
  filters: {
    flexDirection: "row",
    gap: 8,
  },
  filter: {
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterSelected: {
    backgroundColor: colors.ink,
  },
  filterTextSelected: {
    color: colors.paper,
  },
  section: {
    gap: 11,
  },
  list: {
    gap: 9,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  overdueRow: {
    backgroundColor: colors.coralSoft,
  },
  copy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  overdueText: {
    color: colors.coralStrong,
  },
  checkbox: {
    alignItems: "center",
    backgroundColor: colors.sage,
    borderRadius: radii.round,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  checkboxCompleted: {
    backgroundColor: colors.sageStrong,
  },
});
