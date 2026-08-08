import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import {
  measureSharedRect,
  personAvatarSharedId,
  profileAvatarSize,
  useSharedElement,
} from "@/components/shared-element";
import { colors, radii } from "@/constants/theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { profileIntro } from "@/lib/profile-intro";
import { relationshipLabelFor } from "@/lib/relationship-labels";
import type { Person } from "@/lib/types";

const avatarSize = profileAvatarSize;

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
  const nameRef = useRef<View | null>(null);
  const [arriving, setArriving] = useState(() =>
    Boolean(shared?.isFlying(sharedId)),
  );
  // Frozen at mount: the entrance decision must not change when the flight
  // finishes, or it plays again.
  const [arrivingAtMount] = useState(arriving);

  const intro = profileIntro(useReduceMotion());
  const [avatarProgress] = useState(
    () => new Animated.Value(intro.animate && !arriving ? 0 : 1),
  );
  const [nameProgress] = useState(
    () => new Animated.Value(intro.animate ? 0 : 1),
  );

  // Hand this screen's rectangles to the flight, so the copies know where to
  // land. Measured after layout, which is why this is an effect.
  useEffect(() => {
    if (!arriving || !shared) return;
    let cancelled = false;

    const reveal = () => {
      if (cancelled) return;
      setArriving(false);
      avatarProgress.setValue(1);
      nameProgress.setValue(1);
    };

    const handle = requestAnimationFrame(() => {
      void Promise.all([
        measureSharedRect(avatarRef.current),
        measureSharedRect(nameRef.current),
      ]).then(([avatarTo, nameTo]) => {
        if (cancelled) return;
        const to: Record<string, { x: number; y: number; width: number; height: number }> = {};
        if (avatarTo) to.avatar = avatarTo;
        if (nameTo) to.name = nameTo;

        if (Object.keys(to).length > 0) {
          // Revealed by the flight, when the copies actually land.
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
    // Runs once for the arrival: adding the animated values would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exactly once per mount. Depending on `arriving` replayed the whole
  // entrance the moment the flight finished, and React re-invoking effects in
  // development doubled that again — which is why the name slid in repeatedly.
  const playedEntrance = useRef(false);

  useEffect(() => {
    if (playedEntrance.current) return;
    playedEntrance.current = true;

    // Nothing flew here, so the header arrives under its own steam.
    if (!intro.animate || arrivingAtMount) {
      if (!arrivingAtMount) {
        avatarProgress.setValue(1);
        nameProgress.setValue(1);
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            opacity: arriving ? 0 : nameProgress,
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
        {/* Measured on its own: the block around it carries the second name
            and the tag chips, which are not travelling. */}
        <View collapsable={false} ref={nameRef}>
          <AppText style={styles.name} variant="display">
            {person.preferredName || person.fullName}
          </AppText>
        </View>
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
