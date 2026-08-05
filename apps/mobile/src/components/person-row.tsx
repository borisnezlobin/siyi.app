import { CaretRight, InstagramLogo } from "phosphor-react-native";
import { StyleSheet, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { AppText } from "@/components/app-text";
import { PressableCard } from "@/components/surface";
import { colors, radii } from "@/constants/theme";
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
  const supporting = [
    person.instagramUsername ? `@${person.instagramUsername}` : null,
    person.major,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PressableCard
      accessibilityLabel={`Open ${person.fullName}`}
      onPress={onPress}
      style={styles.row}
    >
      <Avatar
        name={person.fullName}
        size={52}
        uri={person.profilePhotoUrl}
      />
      <View style={styles.copy}>
        <AppText variant="heading">
          {person.preferredName || person.fullName}
        </AppText>
        {supporting ? (
          <View style={styles.supporting}>
            {person.instagramUsername ? (
              <InstagramLogo color={colors.inkMuted} size={14} />
            ) : null}
            <AppText numberOfLines={1} variant="caption">
              {supporting}
            </AppText>
          </View>
        ) : (
          <AppText variant="caption">
            {person.firstMetLocation
              ? `Met at ${person.firstMetLocation}`
              : "Ready for a first note"}
          </AppText>
        )}
        {overdue > 0 ? (
          <View style={styles.overdueChip}>
            <AppText style={styles.overdueText} variant="caption">
              {overdue} day{overdue === 1 ? "" : "s"} overdue
            </AppText>
          </View>
        ) : null}
      </View>
      {trailing || <CaretRight color={colors.inkMuted} size={18} />}
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
    padding: 14,
  },
  copy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  supporting: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
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
