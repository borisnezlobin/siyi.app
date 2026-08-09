import { Cake, CaretLeft, CaretRight } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { colors, radii } from "@/constants/theme";
import {
  buildCalendarDays,
  calendarScopes,
  calendarTitle,
  countOnDay,
  shiftAnchor,
  weekdayInitials,
  type BirthdayPerson,
  type CalendarDay,
  type CalendarReminder,
  type CalendarScope,
} from "@/lib/reminder-calendar";
import { dueDateLabel } from "@/lib/relative-time";

const scopeLabels: Record<CalendarScope, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

/**
 * Reminders and birthdays on a calendar rather than in a list.
 *
 * A month is for seeing where the weight falls, so it shows faces and cakes and
 * no words. A day is for reading what is on it, so it shows everything.
 */
export function ReminderCalendar({
  reminders,
  people,
  onOpenPerson,
  onEditReminder,
}: {
  reminders: CalendarReminder[];
  people: BirthdayPerson[];
  onOpenPerson: (personId: string) => void;
  onEditReminder: (reminderId: string) => void;
}) {
  const [scope, setScope] = useState<CalendarScope>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const now = useMemo(() => new Date(), []);
  const { width } = useWindowDimensions();
  // Seven across whatever the screen, minus the page's own margins.
  const cellSize = Math.floor((width - 40 - 6 * 3) / 7);

  const days = useMemo(
    () => buildCalendarDays({ scope, anchor, reminders, people, now }),
    [scope, anchor, reminders, people, now],
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={`Previous ${scope}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setAnchor((current) => shiftAnchor(scope, current, -1))}
          style={styles.step}
        >
          <CaretLeft color={colors.inkMuted} size={16} weight="bold" />
        </Pressable>
        <AppText style={styles.title} variant="label">
          {calendarTitle(scope, anchor)}
        </AppText>
        <Pressable
          accessibilityLabel={`Next ${scope}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setAnchor((current) => shiftAnchor(scope, current, 1))}
          style={styles.step}
        >
          <CaretRight color={colors.inkMuted} size={16} weight="bold" />
        </Pressable>
      </View>

      <View style={styles.scopes}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setAnchor(new Date())}
          style={styles.scope}
        >
          <AppText style={styles.scopeLabel} variant="caption">
            Today
          </AppText>
        </Pressable>
        {calendarScopes.map((option) => {
          const selected = scope === option;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option}
              onPress={() => setScope(option)}
              style={[styles.scope, selected && styles.scopeSelected]}
            >
              <AppText
                style={[styles.scopeLabel, selected && styles.scopeLabelSelected]}
                variant="caption"
              >
                {scopeLabels[option]}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {scope === "month" ? (
        <View>
          <View style={styles.weekdays}>
            {weekdayInitials.map((initial, index) => (
              <AppText
                key={`${initial}-${index}`}
                style={[styles.weekday, { width: cellSize }]}
                variant="caption"
              >
                {initial}
              </AppText>
            ))}
          </View>
          <View style={styles.grid}>
            {days.map((day) => (
              <MonthCell
                day={day}
                key={day.key}
                onPress={() => {
                  setAnchor(day.date);
                  setScope("day");
                }}
                size={cellSize}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.dayList}>
          {days.map((day) => (
            <DayCard
              day={day}
              key={day.key}
              onEditReminder={onEditReminder}
              onOpenPerson={onOpenPerson}
              showMonth={scope === "day"}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function MonthCell({
  day,
  size,
  onPress,
}: {
  day: CalendarDay;
  size: number;
  onPress: () => void;
}) {
  const faces = [
    ...day.birthdays.map((birthday) => ({
      key: `b-${birthday.personId}`,
      name: birthday.name,
      photoUrl: birthday.photoUrl,
      birthday: true,
    })),
    ...day.reminders.map((reminder) => ({
      key: `r-${reminder.id}`,
      name: reminder.person?.name ?? "Someone",
      photoUrl: reminder.person?.photoUrl,
      birthday: false,
    })),
  ];
  const total = countOnDay(day);

  return (
    <Pressable
      accessibilityLabel={`${day.date.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}, ${total} ${total === 1 ? "thing" : "things"}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.cell,
        { height: size + 14, width: size },
        !day.inScope && styles.cellOutside,
        day.isToday && styles.cellToday,
      ]}
    >
      <View style={styles.cellHead}>
        <AppText
          style={[
            styles.cellDay,
            day.isToday && styles.cellDayToday,
            !day.inScope && styles.cellDayOutside,
          ]}
          variant="caption"
        >
          {day.dayOfMonth}
        </AppText>
        {day.birthdays.length ? (
          <Cake color={colors.coralStrong} size={10} weight="fill" />
        ) : null}
      </View>

      <View style={styles.faces}>
        {faces.slice(0, 2).map((face) => (
          <View
            key={face.key}
            style={[styles.face, face.birthday && styles.faceBirthday]}
          >
            <Avatar name={face.name} size={18} uri={face.photoUrl} />
          </View>
        ))}
        {total > 2 ? (
          <AppText style={styles.moreCount} variant="caption">
            +{total - 2}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

function DayCard({
  day,
  showMonth,
  onOpenPerson,
  onEditReminder,
}: {
  day: CalendarDay;
  showMonth: boolean;
  onOpenPerson: (personId: string) => void;
  onEditReminder: (reminderId: string) => void;
}) {
  const empty = countOnDay(day) === 0;

  return (
    <View style={[styles.dayCard, day.isToday && styles.dayCardToday]}>
      <View style={styles.dayHead}>
        <AppText variant="label">
          {day.date.toLocaleDateString(
            undefined,
            showMonth
              ? { weekday: "long", day: "numeric", month: "long" }
              : { weekday: "long", day: "numeric" },
          )}
        </AppText>
        {day.isToday ? (
          <AppText style={styles.todayTag} variant="caption">
            Today
          </AppText>
        ) : null}
      </View>

      {empty ? (
        <AppText variant="caption">Nothing on.</AppText>
      ) : (
        <View style={styles.dayItems}>
          {day.birthdays.map((birthday) => (
            <Pressable
              accessibilityRole="button"
              key={`birthday-${birthday.personId}`}
              onPress={() => onOpenPerson(birthday.personId)}
              style={styles.dayItem}
            >
              <Avatar name={birthday.name} size={36} uri={birthday.photoUrl} />
              <View style={styles.flex}>
                <View style={styles.birthdayName}>
                  <Cake color={colors.coralStrong} size={13} weight="fill" />
                  <AppText variant="label">{birthday.name}</AppText>
                </View>
                <AppText variant="caption">
                  {birthday.turning === null
                    ? "Birthday"
                    : `Turns ${birthday.turning}`}
                </AppText>
              </View>
            </Pressable>
          ))}
          {day.reminders.map((reminder) => (
            <Pressable
              accessibilityRole="button"
              key={reminder.id}
              onPress={() => onEditReminder(reminder.id)}
              style={styles.dayItem}
            >
              <Avatar
                name={reminder.person?.name ?? "Someone"}
                size={36}
                uri={reminder.person?.photoUrl}
              />
              <View style={styles.flex}>
                <AppText
                  numberOfLines={2}
                  style={reminder.completedAt ? styles.doneText : undefined}
                  variant="label"
                >
                  {reminder.text}
                </AppText>
                <AppText numberOfLines={1} variant="caption">
                  {reminder.person?.name ?? "Someone"} ·{" "}
                  {dueDateLabel(reminder.dueAt)}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 14 },
  flex: { flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  step: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  title: { flex: 1, textAlign: "center" },
  scopes: { flexDirection: "row", gap: 6 },
  scope: {
    borderRadius: radii.round,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  scopeSelected: { backgroundColor: colors.ink },
  scopeLabel: { color: colors.inkMuted },
  scopeLabelSelected: { color: colors.paper },
  weekdays: { flexDirection: "row", gap: 3, marginBottom: 4 },
  weekday: { color: colors.inkMuted, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  cell: {
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
    padding: 4,
  },
  cellOutside: { opacity: 0.45 },
  cellToday: { borderColor: colors.coral, borderWidth: 2 },
  cellHead: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    justifyContent: "space-between",
  },
  cellDay: { color: colors.ink },
  cellDayToday: { color: colors.coralStrong },
  cellDayOutside: { color: colors.inkMuted },
  faces: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 2, marginTop: 3 },
  face: { borderRadius: radii.round },
  faceBirthday: {
    borderColor: colors.coral,
    borderWidth: 1,
    borderRadius: radii.round,
  },
  moreCount: { color: colors.inkMuted },
  dayList: { gap: 10 },
  dayCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    gap: 8,
    padding: 14,
  },
  dayCardToday: { borderColor: colors.coral, borderWidth: 2 },
  dayHead: { alignItems: "center", flexDirection: "row", gap: 8 },
  todayTag: { color: colors.coralStrong },
  dayItems: { gap: 10 },
  dayItem: { alignItems: "center", flexDirection: "row", gap: 10 },
  birthdayName: { alignItems: "center", flexDirection: "row", gap: 5 },
  doneText: { color: colors.inkMuted, textDecorationLine: "line-through" },
});
