import { CalendarBlank } from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { EmptyState } from "@/components/surface";
import { colors, radii } from "@/constants/theme";
import {
  formatTimeRange,
  scheduleForDay,
  weekdays,
  type PersonClass,
  type WeekdayKey,
} from "@/lib/classes";
import { getClasses } from "@/lib/classes-data";
import { getPeople } from "@/lib/data";
import type { Person } from "@/lib/types";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useAuth } from "@/providers/auth-provider";

const todayKey: WeekdayKey[] = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];

export default function ScheduleScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const screenData = useRefreshableData<{
    people: Person[];
    classes: PersonClass[];
  }>(async () => {
    const [people, classes] = await Promise.all([
      getPeople(),
      getClasses(session!.user.id),
    ]);
    return { people, classes };
  });

  const [day, setDay] = useState<WeekdayKey>(todayKey[new Date().getDay()]);

  const withClasses = useMemo(() => {
    if (!screenData.data) return [];
    const { people, classes } = screenData.data;
    return people
      .filter((person) => person.status !== "archived")
      .map((person) => ({
        id: person.id,
        name: person.preferredName || person.fullName,
        classes: classes.filter((entry) => entry.personId === person.id),
      }));
  }, [screenData.data]);

  const schedule = useMemo(() => scheduleForDay(withClasses, day), [day, withClasses]);
  const anyClasses = withClasses.some((person) => person.classes.length > 0);

  if (screenData.loading && !screenData.data) {
    return <LoadingState label="Reading everyone's week…" />;
  }
  if (screenData.error && !screenData.data) {
    return (
      <ErrorState message={screenData.error} onRetry={() => void screenData.reload()} />
    );
  }

  return (
    <Screen
      eyebrow="Your circle"
      onRefresh={() => void screenData.refresh()}
      refreshing={screenData.refreshing}
      subtitle="Built from the classes you have written down against each person."
      title="Where everyone is"
    >
      <ScrollView
        contentContainerStyle={styles.days}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {weekdays.map((entry) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: day === entry.key }}
            key={entry.key}
            onPress={() => setDay(entry.key)}
            style={[styles.day, day === entry.key && styles.daySelected]}
          >
            <AppText
              style={day === entry.key ? styles.dayTextSelected : undefined}
              variant="caption"
            >
              {entry.label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>

      {!anyClasses ? (
        <EmptyState
          body="Add a class on someone's profile and they will show up here. You can then search for everyone in a course, or with a professor."
          icon={CalendarBlank}
          title="No classes saved yet"
        />
      ) : schedule.length === 0 ? (
        <AppText variant="caption">Nobody has a class on this day.</AppText>
      ) : (
        <View style={styles.list}>
          {schedule.map((slot) => (
            <Pressable
              key={`${slot.personId}-${slot.entry.id}`}
              onPress={() => router.push(`/people/${slot.personId}`)}
              style={styles.row}
            >
              <AppText style={styles.time} variant="caption">
                {formatTimeRange(slot.entry.startsAt, slot.entry.endsAt)}
              </AppText>
              <View style={styles.rowBody}>
                <AppText variant="body">{slot.personName}</AppText>
                <AppText variant="caption">
                  {[slot.entry.courseCode, slot.entry.professor, slot.entry.location]
                    .filter(Boolean)
                    .join(" · ")}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  days: {
    gap: 8,
    paddingVertical: 2,
  },
  day: {
    backgroundColor: colors.mist,
    borderRadius: radii.small,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  daySelected: {
    backgroundColor: colors.ink,
  },
  dayTextSelected: {
    color: colors.paper,
  },
  list: {
    gap: 9,
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
    flexDirection: "row",
    gap: 14,
    padding: 14,
  },
  time: {
    width: 92,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
});
