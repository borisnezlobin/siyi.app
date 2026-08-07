import { Cake } from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { EmptyState } from "@/components/surface";
import { colors, radii } from "@/constants/theme";
import {
  birthdayCountdownLabel,
  birthdaysByMonth,
  upcomingBirthdays,
} from "@/lib/birthday-calendar";
import { getPeople } from "@/lib/data";
import type { Person } from "@/lib/types";
import { useRefreshableData } from "@/hooks/use-refreshable-data";

type BirthdayView = "upcoming" | "year";

export default function BirthdaysScreen() {
  const router = useRouter();
  const screenData = useRefreshableData<Person[]>(() => getPeople());
  const [view, setView] = useState<BirthdayView>("upcoming");

  const people = useMemo(
    () => (screenData.data ?? []).filter((person) => person.status !== "archived"),
    [screenData.data],
  );
  const months = useMemo(() => birthdaysByMonth(people), [people]);
  const upcoming = useMemo(() => upcomingBirthdays(people, new Date(), 120), [people]);
  const withBirthday = useMemo(
    () => people.filter((person) => person.birthday).length,
    [people],
  );

  if (screenData.loading && !screenData.data) {
    return <LoadingState label="Counting candles…" />;
  }
  if (screenData.error && !screenData.data) {
    return (
      <ErrorState message={screenData.error} onRetry={() => void screenData.reload()} />
    );
  }

  const currentMonth = new Date().getMonth();

  return (
    <Screen
      onRefresh={() => void screenData.refresh()}
      refreshing={screenData.refreshing}
      subtitle={`${withBirthday} of ${people.length} people have a birthday saved.`}
      title="Birthdays"
    >
      <View style={styles.toggle}>
        {(["upcoming", "year"] as const).map((option) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: view === option }}
            key={option}
            onPress={() => setView(option)}
            style={[styles.toggleOption, view === option && styles.toggleOptionSelected]}
          >
            <AppText
              style={view === option ? styles.toggleTextSelected : undefined}
              variant="caption"
            >
              {option === "upcoming" ? "Coming up" : "Whole year"}
            </AppText>
          </Pressable>
        ))}
      </View>

      {withBirthday === 0 ? (
        <EmptyState
          body="Add a birthday to someone's profile and it will show up here."
          icon={Cake}
          title="No birthdays saved yet"
        />
      ) : view === "upcoming" ? (
        upcoming.length === 0 ? (
          <AppText variant="caption">
            Nothing in the next four months. Switch to the whole year.
          </AppText>
        ) : (
          <View style={styles.groupedCard}>
            {upcoming.map((entry, index) => (
              <Pressable
                accessibilityRole="button"
                key={entry.person.id}
                onPress={() => router.push(`/people/${entry.person.id}`)}
                style={[
                  styles.row,
                  index < upcoming.length - 1 && styles.divider,
                ]}
              >
                <View style={styles.date}>
                  <AppText variant="caption">{monthShort(entry.month)}</AppText>
                  <AppText variant="heading">{entry.day}</AppText>
                </View>
                <View style={styles.rowBody}>
                  <AppText variant="label">
                    {entry.person.preferredName || entry.person.fullName}
                  </AppText>
                  <AppText variant="caption">
                    {birthdayCountdownLabel(entry.daysAway)}
                    {entry.turningAge ? ` · turning ${entry.turningAge}` : ""}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        )
      ) : (
        <View style={styles.months}>
          {months.map((month) => (
            <View key={month.month} style={styles.month}>
              <AppText
                style={month.month === currentMonth ? styles.monthNow : styles.monthLabel}
                variant="label"
              >
                {month.label}
              </AppText>
              {month.entries.length === 0 ? (
                <AppText style={styles.monthEmpty} variant="caption">
                  —
                </AppText>
              ) : (
                month.entries.map((entry) => (
                  <Pressable
                    key={entry.person.id}
                    onPress={() => router.push(`/people/${entry.person.id}`)}
                    style={styles.monthRow}
                  >
                    <AppText style={styles.monthDay} variant="caption">
                      {entry.day}
                    </AppText>
                    <AppText variant="body">
                      {entry.person.preferredName || entry.person.fullName}
                    </AppText>
                  </Pressable>
                ))
              )}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function monthShort(month: number) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    month
  ];
}

const styles = StyleSheet.create({
  toggle: {
    backgroundColor: colors.mist,
    borderRadius: radii.medium,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  toggleOption: {
    alignItems: "center",
    borderRadius: radii.small,
    flex: 1,
    paddingVertical: 9,
  },
  toggleOptionSelected: {
    backgroundColor: colors.paper,
  },
  toggleTextSelected: {
    color: colors.ink,
  },
  groupedCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    overflow: "hidden",
    paddingHorizontal: 14,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingVertical: 11,
  },
  divider: {
    borderBottomColor: colors.mist,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  date: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.small,
    minWidth: 54,
    paddingVertical: 8,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  months: {
    gap: 18,
  },
  month: {
    gap: 7,
  },
  monthLabel: {
    color: colors.inkMuted,
  },
  monthNow: {
    color: colors.coral,
  },
  monthEmpty: {
    color: colors.inkMuted,
  },
  monthRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  monthDay: {
    minWidth: 24,
  },
});
