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
  fontFamilies,
  radii,
} from "@/constants/theme";

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

export function PressableCard({ style, ...props }: PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={(state) => [
        styles.card,
        state.pressed && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    />
  );
}

export function SectionHeading({
  title,
  subtitle,
  detail,
  actions,
}: {
  title: string;
  subtitle?: string;
  detail?: string;
  /** Labelled buttons only — a bare glyph here is not readable. */
  actions?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionTitle}>
        <View style={styles.sectionTitleRow}>
          <AppText variant="heading">{title}</AppText>
          {detail ? (
            <AppText style={styles.sectionDetail} variant="caption">
              {detail}
            </AppText>
          ) : null}
        </View>
        {subtitle ? (
          <AppText style={styles.sectionSubtitle} variant="caption">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {actions ? <View style={styles.sectionActions}>{actions}</View> : null}
    </View>
  );
}

/** The one shape a section action takes, so two headings cannot disagree. */
export function SectionAction({
  icon: IconComponent,
  label,
  onPress,
}: {
  icon: Icon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}
    >
      <IconComponent color={colors.inkMuted} size={16} weight="fill" />
      <AppText style={styles.sectionActionLabel} variant="caption">
        {label}
      </AppText>
    </Pressable>
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
      <IconComponent color={colors.inkMuted} size={26} />
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
    // Centred, not top-aligned: the title is a tall display face, and actions
    // pinned to the top of its line box sit visibly above the words.
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  sectionTitle: {
    flex: 1,
    flexShrink: 1,
    gap: 3,
  },
  sectionTitleRow: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  sectionSubtitle: {
    color: colors.inkMuted,
  },
  sectionDetail: {
    flexShrink: 1,
  },
  sectionActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  sectionAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 8,
  },
  sectionActionLabel: {
    fontFamily: fontFamilies.bodySemibold,
  },
  empty: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  emptyCopy: {
    flex: 1,
    gap: 3,
  },
  muted: {
    color: colors.inkMuted,
  },
});
