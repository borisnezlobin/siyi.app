import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewProps,
} from "react-native";
import type { Icon } from "phosphor-react-native";
import { AppText } from "@/components/app-text";
import {
  cardShadow,
  colors,
  radii,
} from "@/constants/theme";

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

export function PressableCard({ style, ...props }: PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        typeof style === "function" ? style({ pressed }) : style,
      ]}
      {...props}
    />
  );
}

export function SectionHeading({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <AppText variant="heading">{title}</AppText>
      {detail ? <AppText variant="caption">{detail}</AppText> : null}
    </View>
  );
}

export function EmptyState({
  icon: IconComponent,
  title,
  body,
}: {
  icon: Icon;
  title: string;
  body: string;
}) {
  return (
    <Card style={styles.empty}>
      <View style={styles.emptyIcon}>
        <IconComponent color={colors.sageStrong} size={24} weight="duotone" />
      </View>
      <View style={styles.emptyCopy}>
        <AppText variant="heading">{title}</AppText>
        <AppText style={styles.muted}>{body}</AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardShadow,
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    padding: 18,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  sectionHeading: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  empty: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.sage,
    borderRadius: radii.round,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  emptyCopy: {
    flex: 1,
    gap: 3,
  },
  muted: {
    color: colors.inkMuted,
  },
});
