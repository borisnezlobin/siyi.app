import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import {
  measureSharedRect,
  personAvatarSharedId,
  useSharedElement,
} from "@/components/shared-element";
import { colors, radii } from "@/constants/theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { profileIntro } from "@/lib/profile-intro";
import { relationshipLabelFor } from "@/lib/relationship-labels";
import type { Person } from "@/lib/types";

const avatarSize = 126;

/**
 * The avatar and name at the top of a person's screen.
 *
 * When the screen was opened from a people row, the avatar here is the landing
 * point of a real shared element: the row's copy flies up and grows into this
 * position while this one stays invisible, then swaps in. Opened any other way
 * — from search, from Today, from a notification — there is no row to fly from,
 * so it plays the small entrance instead. That fallback matters: a movement
 * aimed at a row which is not on screen looks wrong.
 */
export function PersonProfileHeader({ person }: { person: Person }) {
  const shared = useSharedElement();
  const sharedId = personAvatarSharedId(person.id);
  const avatarRef = useRef<View | null>(null);
  const [arriving, setArriving] = useState(() =>
    Boolean(shared?.isFlying(sharedId)),
  );

  const intro = profileIntro(useReduceMotion());
  const [avatarProgress] = useState(
    () => new Animated.Value(intro.animate && !arriving ? 0 : 1),
  );
  const [nameProgress] = useState(
    () => new Animated.Value(intro.animate ? 0 : 1),
  );

  // Hand this screen's rectangle to the flight, so the copy knows where to
  // land. Measured after layout, which is why it is an effect rather than a
  // value read during render.
  useEffect(() => {
    if (!arriving || !shared) return;
    let cancelled = false;

    const reveal = () => {
      if (cancelled) return;
      setArriving(false);
      avatarProgress.setValue(1);
    };

    const handle = requestAnimationFrame(() => {
      void measureSharedRect(avatarRef.current).then((to) => {
        if (cancelled) return;
        if (to) {
          // Revealed by the flight, when the copy actually lands.
          shared.arriveAt(sharedId, to, reveal);
        } else {
          shared.cancel(sharedId);
          reveal();
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
  }, [arriving, avatarProgress, shared, sharedId]);

  useEffect(() => {
    if (!intro.animate) {
      avatarProgress.setValue(1);
      nameProgress.setValue(1);
      return;
    }

    const entrance = Animated.parallel([
      // The avatar only plays the substitute entrance when nothing flew here.
      ...(arriving
        ? []
        : [
            Animated.timing(avatarProgress, {
              duration: intro.durationMs,
              easing: Easing.out(Easing.cubic),
              toValue: 1,
              useNativeDriver: true,
            }),
          ]),
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
  }, [arriving, avatarProgress, intro, nameProgress]);

  return (
    <View style={styles.profileHeader}>
      <Animated.View
        collapsable={false}
        ref={avatarRef}
        style={{
          // Held invisible while the copy is in the air, so there is never two
          // of the same avatar on screen at once.
          opacity: arriving ? 0 : avatarProgress,
          transform: [
            {
              scale: arriving
                ? 1
                : avatarProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [intro.avatarFromScale, 1],
                  }),
            },
          ],
        }}
        testID="person-profile-avatar"
      >
        <Avatar name={person.fullName} size={avatarSize} uri={person.profilePhotoUrl} />
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
