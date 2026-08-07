import { CaretRight, Clock } from "phosphor-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { AppText } from "@/components/app-text";
import { colors, radii } from "@/constants/theme";
import { elapsedLabel } from "@/lib/date-labels";
import { overdueDays } from "@/lib/reminders";
import type { Person } from "@/lib/types";

export function PersonRow({
  person,
  onPress,
  trailing,
}: {
  person: Person;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  const overdue = overdueDays(person);

  return (
    <Pressable
      accessibilityLabel={`Open ${person.fullName}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar name={person.fullName} size={52} uri={person.profilePhotoUrl} />
      <View style={styles.copy}>
        <AppText numberOfLines={1} variant="heading">
          {person.preferredName || person.fullName}
        </AppText>
        <View style={styles.metaRow}>
          <Clock color={colors.inkMuted} size={13} />
          <AppText numberOfLines={1} variant="caption">
            {elapsedLabel(person.lastInteractionAt)}
          </AppText>
        </View>
        <AppText numberOfLines={1} style={styles.note} variant="caption">
          {person.generalNotes || person.major || "Add something worth remembering"}
        </AppText>
        {overdue > 0 ? (
          <View style={styles.overdueChip}>
            <AppText style={styles.overdueText} variant="caption">
              {overdue} day{overdue === 1 ? "" : "s"} overdue
            </AppText>
          </View>
        ) : null}
      </View>
      {trailing || <CaretRight color={colors.inkMuted} size={16} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderBottomColor: colors.mist,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 13,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.72,
  },
  copy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  note: {
    color: colors.ink,
  },
  overdueChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.coralSoft,
    borderRadius: radii.round,
    marginTop: 3,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  overdueText: {
    color: colors.coralStrong,
  },
});
