import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { colors, radii } from "@/constants/theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { profileIntro } from "@/lib/profile-intro";
import { relationshipLabelFor } from "@/lib/relationship-labels";
import type { Person } from "@/lib/types";

/**
 * The avatar and name at the top of a person's screen, which arrive with a
 * short movement rather than simply appearing.
 *
 * The Reduce Motion setting reads back from a promise, so on the very first
 * person opened in a session the answer can land a tick after mount; the
 * effect below then snaps both values to rest instead of letting the movement
 * play out.
 */
export function PersonProfileHeader({ person }: { person: Person }) {
  const intro = profileIntro(useReduceMotion());
  const [avatarProgress] = useState(
    () => new Animated.Value(intro.animate ? 0 : 1),
  );
  const [nameProgress] = useState(
    () => new Animated.Value(intro.animate ? 0 : 1),
  );

  useEffect(() => {
    if (!intro.animate) {
      avatarProgress.setValue(1);
      nameProgress.setValue(1);
      return;
    }

    const entrance = Animated.parallel([
      Animated.timing(avatarProgress, {
        duration: intro.durationMs,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(nameProgress, {
        delay: intro.nameDelayMs,
        duration: intro.durationMs,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);
    entrance.start();

    return () => entrance.stop();
  }, [avatarProgress, intro, nameProgress]);

  return (
    <View style={styles.profileHeader}>
      <Animated.View
        style={{
          opacity: avatarProgress,
          transform: [
            {
              scale: avatarProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [intro.avatarFromScale, 1],
              }),
            },
          ],
        }}
        testID="person-profile-avatar"
      >
        <Avatar name={person.fullName} size={126} uri={person.profilePhotoUrl} />
      </Animated.View>
      <Animated.View
        style={[
          styles.profileCopy,
          {
            opacity: nameProgress,
            transform: [
              {
                translateY: nameProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [intro.nameFromTranslateY, 0],
                }),
              },
            ],
          },
        ]}
        testID="person-profile-name"
      >
        <AppText style={styles.name} variant="display">
          {person.preferredName || person.fullName}
        </AppText>
        {person.preferredName ? (
          <AppText style={styles.muted}>{person.fullName}</AppText>
        ) : null}
        <View style={styles.tagRow}>
          <View style={styles.strengthChip}>
            <AppText style={styles.strengthText} variant="caption">
              {relationshipLabelFor(person)}
            </AppText>
          </View>
          {person.tags.map((tag) => (
            <View key={tag.id} style={styles.tagChip}>
              <AppText variant="caption">{tag.name}</AppText>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: "center",
    gap: 14,
  },
  profileCopy: {
    alignItems: "center",
    gap: 4,
  },
  name: {
    textAlign: "center",
  },
  muted: {
    color: colors.inkMuted,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    justifyContent: "center",
    marginTop: 5,
  },
  strengthChip: {
    backgroundColor: colors.coralSoft,
    borderRadius: radii.round,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  strengthText: {
    color: colors.coralStrong,
  },
  tagChip: {
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
});
