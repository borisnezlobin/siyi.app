import { CaretRight, Clock } from "phosphor-react-native";
import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/avatar";
import {
  measureSharedRect,
  personAvatarSharedId,
  useSharedElement,
} from "@/components/shared-element";
import { AppText } from "@/components/app-text";
import { colors, radii } from "@/constants/theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { lastSeenLabel } from "@/lib/relative-time";
import { formatOverdueDuration, overdueDays } from "@/lib/reminders";
import type { Person } from "@/lib/types";

export function PersonRow({
  person,
  onPress,
  divider = true,
}: {
  person: Person;
  onPress: () => void;
  /** Off for the last row of a group, so a list never ends on a stray line. */
  divider?: boolean;
}) {
  const overdue = overdueDays(person);
  const shared = useSharedElement();
  const reduceMotion = useReduceMotion();
  const avatarRef = useRef<View | null>(null);

  // Measured as the row is tapped rather than on layout: a list scrolls, so
  // where the avatar was when it was drawn is not where it is when it is used.
  async function openWithTransition() {
    // Somebody who has asked the system for less movement should not get a
    // full-size avatar flying across the screen.
    if (!shared || reduceMotion) {
      onPress();
      return;
    }

    // Never let a measurement that does not come back swallow the tap: the
    // navigation matters and the animation does not.
    const from = await Promise.race([
      measureSharedRect(avatarRef.current),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 80)),
    ]);
    if (from) {
      shared.begin({
        id: personAvatarSharedId(person.id),
        from,
        render: (size) => (
          <Avatar name={person.fullName} size={size} uri={person.profilePhotoUrl} />
        ),
      });
    }
    onPress();
  }

  return (
    <Pressable
      accessibilityLabel={`Open ${person.fullName}`}
      accessibilityRole="button"
      onPress={() => void openWithTransition()}
      style={({ pressed }) => [
        styles.row,
        divider && styles.divided,
        pressed && styles.pressed,
      ]}
    >
      <View collapsable={false} ref={avatarRef}>
        <Avatar name={person.fullName} size={48} uri={person.profilePhotoUrl} />
      </View>
      <View style={styles.copy}>
        <AppText numberOfLines={1} variant="heading">
          {person.preferredName || person.fullName}
        </AppText>
        <View style={styles.metaRow}>
          <Clock color={colors.inkMuted} size={13} />
          <AppText numberOfLines={1} variant="caption">
            {lastSeenLabel(person.lastInteractionAt)}
          </AppText>
        </View>
        <AppText numberOfLines={1} style={styles.note} variant="caption">
          {person.generalNotes || person.major || "Add something worth remembering"}
        </AppText>
        {overdue > 0 ? (
          <View style={styles.overdueChip}>
            <AppText style={styles.overdueText} variant="caption">
              {formatOverdueDuration(overdue)}
            </AppText>
          </View>
        ) : null}
      </View>
      <CaretRight color={colors.inkMuted} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
    paddingVertical: 12,
  },
  divided: {
    borderBottomColor: colors.mist,
    borderBottomWidth: 1,
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
